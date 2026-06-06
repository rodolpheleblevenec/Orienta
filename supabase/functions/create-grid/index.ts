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
    grant_id?: string | null
  }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { user_id, difficulty, clues, placements, decoy_card_id, creator_time_seconds, grant_id } = body

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

  // ── Mode « grant » : le gagnant d'un jour crée la grille du jour de J+3 ──
  // Déclenché par grant_id → bypass quota + déblocage de difficulté ; date verrouillée sur target_date.
  let grant: { id: string; target_date: string } | null = null
  if (grant_id) {
    const { data: g } = await supabase
      .from('orienta_grid_grants')
      .select('id, winner_user_id, target_date, status')
      .eq('id', grant_id)
      .maybeSingle()
    if (!g) return json({ error: 'grant not found' }, 404)
    if (g.winner_user_id !== user_id) return json({ error: 'grant not yours' }, 403)
    if (g.status !== 'pending') return json({ error: 'grant already used' }, 409)
    // Gate autoritaire basé sur la DATE (heure de Paris) : impossible de créer une fois le jour arrivé.
    const todayParis = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })
    if (g.target_date <= todayParis) return json({ error: 'grant expired' }, 409)
    // Sécurité : rien ne doit déjà occuper la date (sinon violation UNIQUE(daily_date)).
    const { data: occupied } = await supabase
      .from('orienta_grids').select('id').eq('daily_date', g.target_date).maybeSingle()
    if (occupied) return json({ error: 'target date already filled' }, 409)
    grant = { id: g.id, target_date: g.target_date }
  } else {
    // ── Limite quotidienne (1 grille communautaire / jour) ──
    const today = new Date().toISOString().split('T')[0]
    const { count: todayCount } = await supabase
      .from('orienta_grids')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', user_id)
      .is('daily_date', null)
      .is('daily_status', null)
      .gte('created_at', today + 'T00:00:00')
    if ((todayCount ?? 0) > 0) return json({ error: 'daily limit reached' }, 403)

    // ── Difficulté débloquée ? (facile → moyen → difficile) ──
    if (difficulty !== 'facile') {
      const { data: prior } = await supabase
        .from('orienta_grids').select('difficulty')
        .eq('creator_id', user_id).is('daily_date', null).is('daily_status', null).eq('status', 'published')
      const set = new Set((prior ?? []).map(g => g.difficulty))
      if (difficulty === 'moyen' && !set.has('facile')) return json({ error: 'moyen locked' }, 403)
      if (difficulty === 'difficile' && !set.has('moyen')) return json({ error: 'difficile locked' }, 403)
    }
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

  const gridRow = grant
    ? {
        // Grille du jour créée par le gagnant : datée J+3, piste quotidienne 'scheduled'
        // (le rollover la passera 'published' + numéro d'édition le jour venu).
        creator_id: user_id,
        status: 'published',
        daily_status: 'scheduled',
        daily_date: grant.target_date,
        difficulty,
        clue_top: c.top, clue_right: c.right, clue_bottom: c.bottom, clue_left: c.left,
        creator_time_seconds: creatorTime,
      }
    : {
        // Grille communautaire : visible 48h.
        creator_id: user_id,
        status: 'published',
        difficulty,
        clue_top: c.top, clue_right: c.right, clue_bottom: c.bottom, clue_left: c.left,
        creator_time_seconds: creatorTime,
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      }
  const { data: grid, error: gridErr } = await supabase.from('orienta_grids').insert(gridRow).select('id').single()
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

  // Mode grant : on consomme le droit (claimed). Le check status='pending' plus haut garde l'idempotence.
  if (grant) {
    await supabase.from('orienta_grid_grants')
      .update({ status: 'claimed', created_grid_id: grid.id })
      .eq('id', grant.id)
    return json({ grid_id: grid.id, daily: true, target_date: grant.target_date })
  }

  return json({ grid_id: grid.id })
})
