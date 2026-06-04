import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const ROTATIONS = [0, 90, 180, 270]
const MAX_CLUE_LENGTH = 80
const SUGGESTION_STATUSES = ['nouveau', 'vu', 'traite', 'rejete']
const norm = (r: number) => (((r % 360) + 360) % 360)

type Placement = { card_id: string; position: number; rotation: number }

// Comparaison à temps ~constant pour éviter une fuite par timing.
function secretMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Opérations ADMIN — protégées par un secret serveur (hash SHA-256 stocké dans
// orienta_admin_config), et NON par le pseudo client (trivialement contournable).
//   - save-daily-grid : créer/mettre à jour la grille du jour + ses cartes
//   - delete-daily-grid : supprimer une grille du jour + ses cartes
//   - set-suggestion-status : changer le statut d'une suggestion
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: {
    admin_secret?: string; action?: string
    creator_id?: string; date?: string; grid_id?: string
    clues?: { top?: string; right?: string; bottom?: string; left?: string }
    placements?: Placement[]
    id?: string; status?: string
  }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Garde-fou : on compare le SHA-256 du secret fourni au hash stocké dans
  // orienta_admin_config (table protégée par RLS, lisible seulement en
  // service_role). Refus total si non configuré ou non correspondant.
  const { data: cfg } = await supabase
    .from('orienta_admin_config').select('value').eq('key', 'admin_secret_sha256').maybeSingle()
  const expectedHash = cfg?.value
  const provided = body.admin_secret ?? ''
  const providedHash = provided ? await sha256Hex(provided) : ''
  if (!expectedHash || !provided || !secretMatches(providedHash, expectedHash)) {
    return json({ error: 'unauthorized' }, 403)
  }

  const { action } = body

  // ─── Liste des suggestions (lecture admin ; la table n'est plus lisible par anon) ───
  if (action === 'list-suggestions') {
    const { data } = await supabase
      .from('orienta_suggestions').select('*').order('created_at', { ascending: false })
    return json({ suggestions: data ?? [] })
  }

  // ─── Statut d'une suggestion ───
  if (action === 'set-suggestion-status') {
    const { id, status } = body
    if (!id || !status || !SUGGESTION_STATUSES.includes(status)) return json({ error: 'invalid status' }, 400)
    await supabase.from('orienta_suggestions').update({ status }).eq('id', id)
    return json({ ok: true })
  }

  // ─── Suppression d'une grille du jour ───
  if (action === 'delete-daily-grid') {
    const { grid_id } = body
    if (!grid_id) return json({ error: 'grid_id required' }, 400)
    await supabase.from('orienta_grid_cards').delete().eq('grid_id', grid_id)
    await supabase.from('orienta_grids').delete().eq('id', grid_id)
    return json({ ok: true })
  }

  // ─── Création / mise à jour d'une grille du jour ───
  if (action === 'save-daily-grid') {
    const { creator_id, date, grid_id, clues, placements } = body
    if (!creator_id) return json({ error: 'creator_id required' }, 400)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'invalid date' }, 400)

    const c = {
      top: (clues?.top ?? '').trim(),
      right: (clues?.right ?? '').trim(),
      bottom: (clues?.bottom ?? '').trim(),
      left: (clues?.left ?? '').trim(),
    }
    if (!c.top || !c.right || !c.bottom || !c.left) return json({ error: 'all clues required' }, 400)
    if ([c.top, c.right, c.bottom, c.left].some(v => v.length > MAX_CLUE_LENGTH)) return json({ error: 'clue too long' }, 400)

    if (!Array.isArray(placements) || placements.length !== 4) return json({ error: 'exactly 4 placements required' }, 400)
    if (placements.map(p => p.position).sort().join(',') !== '0,1,2,3') return json({ error: 'positions must be 0..3' }, 400)
    for (const p of placements) {
      if (!p.card_id || !ROTATIONS.includes(norm(p.rotation))) return json({ error: 'invalid placement' }, 400)
    }

    // Intégrité des cartes
    const cardIds = placements.map(p => p.card_id)
    const { data: cards } = await supabase.from('orienta_word_cards').select('id').in('id', cardIds)
    if (!cards || cards.length !== cardIds.length) return json({ error: 'invalid cards' }, 400)

    const gridData = {
      creator_id,
      clue_top: c.top, clue_right: c.right, clue_bottom: c.bottom, clue_left: c.left,
      daily_date: date,
      status: 'published',
      difficulty: 'facile',
      expires_at: new Date(new Date(date).getTime() + 48 * 3600 * 1000).toISOString(),
    }

    let gid = grid_id
    if (grid_id) {
      await supabase.from('orienta_grids').update(gridData).eq('id', grid_id)
      await supabase.from('orienta_grid_cards').delete().eq('grid_id', grid_id)
    } else {
      const { data: newGrid, error } = await supabase.from('orienta_grids').insert(gridData).select('id').single()
      if (error || !newGrid) return json({ error: 'could not create grid' }, 500)
      gid = newGrid.id
    }

    const rows = placements.map(p => ({
      grid_id: gid, card_id: p.card_id, position: p.position, rotation: norm(p.rotation),
    }))
    const { error: cardsErr } = await supabase.from('orienta_grid_cards').insert(rows)
    if (cardsErr) return json({ error: 'could not insert grid cards' }, 500)

    return json({ ok: true, grid_id: gid })
  }

  return json({ error: 'unknown action' }, 400)
})
