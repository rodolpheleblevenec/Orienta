import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const DIFFICULTIES = ['facile', 'moyen', 'difficile']
const ROTATIONS = [0, 90, 180, 270]
const MAX_CLUE_LENGTH = 80
const norm = (r: number) => (((r % 360) + 360) % 360)

type Placement = { card_id: string; position: number; rotation: number }

// Création d'une grille communautaire — entièrement validée côté serveur :
// limite quotidienne, difficulté débloquée, intégrité des cartes, conflit de mot.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: {
    user_id?: string; difficulty?: string
    clues?: { top?: string; right?: string; bottom?: string; left?: string }
    placements?: Placement[]; decoy_card_id?: string | null; creator_time_seconds?: number | null
  }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { user_id, difficulty, clues, placements, decoy_card_id, creator_time_seconds } = body

  // ── Validation de base ──
  if (!user_id) return json({ error: 'user_id required' }, 400)
  if (!difficulty || !DIFFICULTIES.includes(difficulty)) return json({ error: 'invalid difficulty' }, 400)

  const c = {
    top: (clues?.top ?? '').trim(),
    right: (clues?.right ?? '').trim(),
    bottom: (clues?.bottom ?? '').trim(),
    left: (clues?.left ?? '').trim(),
  }
  if (!c.top || !c.right || !c.bottom || !c.left) return json({ error: 'all clues required' }, 400)
  if ([c.top, c.right, c.bottom, c.left].some(v => v.length > MAX_CLUE_LENGTH)) return json({ error: 'clue too long' }, 400)

  if (!Array.isArray(placements) || placements.length !== 4) return json({ error: 'exactly 4 placements required' }, 400)
  const positions = placements.map(p => p.position).sort()
  if (positions.join(',') !== '0,1,2,3') return json({ error: 'positions must be 0..3' }, 400)
  for (const p of placements) {
    if (!p.card_id || !ROTATIONS.includes(norm(p.rotation))) return json({ error: 'invalid placement' }, 400)
  }
  if (difficulty === 'difficile' && !decoy_card_id) return json({ error: 'decoy required for difficile' }, 400)

  // ── L'utilisateur existe ? ──
  const { data: user } = await supabase.from('orienta_users').select('id').eq('id', user_id).single()
  if (!user) return json({ error: 'user not found' }, 404)

  // ── Limite quotidienne (1 grille communautaire / jour) ──
  const today = new Date().toISOString().split('T')[0]
  const { count: todayCount } = await supabase
    .from('orienta_grids')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', user_id)
    .is('daily_date', null)
    .gte('created_at', today + 'T00:00:00')
  if ((todayCount ?? 0) > 0) return json({ error: 'daily limit reached' }, 403)

  // ── Difficulté débloquée ? (facile → moyen → difficile) ──
  if (difficulty !== 'facile') {
    const { data: prior } = await supabase
      .from('orienta_grids').select('difficulty')
      .eq('creator_id', user_id).is('daily_date', null).eq('status', 'published')
    const set = new Set((prior ?? []).map(g => g.difficulty))
    if (difficulty === 'moyen' && !set.has('facile')) return json({ error: 'moyen locked' }, 403)
    if (difficulty === 'difficile' && !set.has('moyen')) return json({ error: 'difficile locked' }, 403)
  }

  // ── Intégrité des cartes + conflit de mot ──
  const cardIds = [...placements.map(p => p.card_id), ...(decoy_card_id ? [decoy_card_id] : [])]
  const { data: cards } = await supabase
    .from('orienta_word_cards')
    .select('id, word_top, word_right, word_bottom, word_left')
    .in('id', cardIds)
  if (!cards || cards.length !== cardIds.length) return json({ error: 'invalid cards' }, 400)

  const words = new Set<string>()
  for (const card of cards) {
    for (const w of [card.word_top, card.word_right, card.word_bottom, card.word_left]) {
      if (w) words.add(String(w).toLowerCase().trim())
    }
  }
  for (const val of [c.top, c.right, c.bottom, c.left]) {
    if (words.has(val.toLowerCase())) return json({ error: 'clue conflict: word used on a card' }, 400)
  }

  // ── Insertion ──
  const creatorTime = difficulty === 'facile'
    ? null
    : (typeof creator_time_seconds === 'number' ? Math.max(0, Math.min(90, Math.round(creator_time_seconds))) : null)

  const { data: grid, error: gridErr } = await supabase.from('orienta_grids').insert({
    creator_id: user_id,
    status: 'published',
    difficulty,
    clue_top: c.top, clue_right: c.right, clue_bottom: c.bottom, clue_left: c.left,
    creator_time_seconds: creatorTime,
    expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  }).select('id').single()
  if (gridErr || !grid) return json({ error: 'could not create grid' }, 500)

  const rows = placements.map(p => ({
    grid_id: grid.id, card_id: p.card_id, position: p.position, rotation: norm(p.rotation),
  }))
  if (difficulty === 'difficile' && decoy_card_id) {
    rows.push({ grid_id: grid.id, card_id: decoy_card_id, position: -1, rotation: 0 })
  }
  const { error: cardsErr } = await supabase.from('orienta_grid_cards').insert(rows)
  if (cardsErr) {
    // rollback de la grille pour ne pas laisser une grille sans cartes
    await supabase.from('orienta_grids').delete().eq('id', grid.id)
    return json({ error: 'could not insert grid cards' }, 500)
  }

  return json({ grid_id: grid.id })
})
