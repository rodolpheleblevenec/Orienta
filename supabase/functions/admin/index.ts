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
//   - verify : confirme le secret (contrôle d'entrée admin)
//   - get-stats : statistiques admin (KPIs + séries + packs)
//   - save-daily-grid : créer/mettre à jour la grille du jour + ses cartes
//   - delete-daily-grid : supprimer une grille du jour + ses cartes
//   - list-suggestions / set-suggestion-status
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: {
    admin_secret?: string; action?: string
    creator_id?: string; date?: string; grid_id?: string
    clues?: { top?: string; right?: string; bottom?: string; left?: string }
    placements?: Placement[]
    id?: string; status?: string
    difficulty?: string; order?: string[]
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

  // ─── Vérification simple du secret (contrôle à l'entrée de l'admin) ───
  if (action === 'verify') return json({ ok: true })

  // ─── Statistiques admin (KPIs + séries journalières + packs détaillés) ───
  if (action === 'get-stats') {
    const [usersRes, activeRes, gridsRes, playsRes, attemptsRes, upvotesRes, suggRes] = await Promise.all([
      supabase.from('orienta_users').select('id, created_at, streak_current, streak_best, selected_skin, tutorial_modal_done').eq('is_system', false),
      supabase.from('orienta_daily_active').select('user_id, active_date'),
      supabase.from('orienta_grids').select('id, created_at, daily_date, daily_status, upvotes_count, edition_number, status'),
      supabase.from('orienta_plays').select('id, grid_id, player_id, started_at, completed_at, time_seconds, attempts_count, success, comment'),
      supabase.from('orienta_play_attempts').select('correct_full, correct_rotation, neither'),
      supabase.from('orienta_grid_upvotes').select('created_at'),
      supabase.from('orienta_suggestions').select('created_at, status'),
    ])
    const users = usersRes.data ?? []
    const active = activeRes.data ?? []
    const grids = gridsRes.data ?? []
    const plays = playsRes.data ?? []
    const attempts = attemptsRes.data ?? []
    const upvotes = upvotesRes.data ?? []
    const suggestions = suggRes.data ?? []

    // ── helpers ──
    const dayOf = (v: string) => String(v).slice(0, 10) // 'YYYY-MM-DD' (timestamp ou date)
    const today = new Date().toISOString().slice(0, 10)
    const addDays = (iso: string, n: number) =>
      new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
    const median = (arr: number[]) => {
      if (!arr.length) return 0
      const s = [...arr].sort((a, b) => a - b)
      const m = Math.floor(s.length / 2)
      return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
    }
    // Comble les jours manquants d'une série (du 1er jour connu à aujourd'hui).
    const fillSeries = <T extends { date: string }>(entries: T[], makeEmpty: (d: string) => T): T[] => {
      if (!entries.length) return []
      const byDate = new Map(entries.map(e => [e.date, e]))
      const out: T[] = []
      for (let t = Date.parse(entries[0].date + 'T00:00:00Z'); t <= Date.parse(today + 'T00:00:00Z'); t += 86400000) {
        const d = new Date(t).toISOString().slice(0, 10)
        out.push(byDate.get(d) ?? makeEmpty(d))
      }
      return out
    }

    // ===== Vue d'ensemble : série activité + KPIs =====
    type Day = { date: string; active: number; new_users: number; grids_daily: number; grids_community: number }
    const map = new Map<string, Day>()
    const ensure = (d: string): Day => {
      let row = map.get(d)
      if (!row) { row = { date: d, active: 0, new_users: 0, grids_daily: 0, grids_community: 0 }; map.set(d, row) }
      return row
    }
    for (const u of users) if (u.created_at) ensure(dayOf(u.created_at)).new_users++
    for (const a of active) if (a.active_date) ensure(dayOf(a.active_date)).active++
    for (const g of grids) {
      if (!g.created_at) continue
      const row = ensure(dayOf(g.created_at))
      // « Piste quotidienne » = daily_status non null (réserve / programmée / publiée).
      if (g.daily_status) row.grids_daily++; else row.grids_community++
    }
    const series = fillSeries(
      [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
      (d) => ({ date: d, active: 0, new_users: 0, grids_daily: 0, grids_community: 0 }),
    )

    const weekAgo = addDays(today, -6)
    const active7d = new Set(active.filter(a => a.active_date && dayOf(a.active_date) >= weekAgo).map(a => a.user_id)).size
    const successPlays = plays.filter(p => p.success).length
    const kpis = {
      total_users: users.length,
      active_7d: active7d,
      total_grids: grids.length,
      total_plays: plays.length,
      success_rate: plays.length ? Math.round((100 * successPlays) / plays.length) : 0,
    }

    // ===== Pack 1 : difficulté & grilles =====
    const playsByGrid = new Map<string, typeof plays>()
    for (const p of plays) {
      if (!p.grid_id) continue
      if (!playsByGrid.has(p.grid_id)) playsByGrid.set(p.grid_id, [])
      playsByGrid.get(p.grid_id)!.push(p)
    }
    const gridLabel = (g: typeof grids[number]) =>
      g.daily_date ? dayOf(g.daily_date)
        : g.daily_status === 'reserve' ? 'Réserve'
        : (g.edition_number ? `#${g.edition_number}` : 'Communauté')
    const gridStats = (g: typeof grids[number]) => {
      const ps = playsByGrid.get(g.id) ?? []
      const total = ps.length
      const succ = ps.filter(p => p.success).length
      const abandoned = ps.filter(p => !p.completed_at).length
      const times = ps.filter(p => p.completed_at && p.time_seconds != null).map(p => p.time_seconds as number)
      const att = ps.filter(p => p.attempts_count != null).map(p => p.attempts_count as number)
      return {
        grid_id: g.id, label: gridLabel(g), date: g.daily_date ?? null,
        players: total,
        success_rate: total ? Math.round((100 * succ) / total) : 0,
        median_time: median(times),
        avg_attempts: att.length ? Math.round((10 * att.reduce((a, b) => a + b, 0)) / att.length) / 10 : 0,
        abandon_rate: total ? Math.round((100 * abandoned) / total) : 0,
      }
    }
    const grids_difficulty = grids
      .filter(g => g.daily_date)
      .sort((a, b) => (a.daily_date! < b.daily_date! ? 1 : -1))
      .slice(0, 21)
      .map(gridStats)

    let eFull = 0, eRot = 0, eNeither = 0
    for (const a of attempts) { eFull += a.correct_full || 0; eRot += a.correct_rotation || 0; eNeither += a.neither || 0 }
    const error_breakdown = { full: eFull, rotation: eRot, neither: eNeither }

    // ===== Pack 2 : rétention & engagement =====
    const firstActive = new Map<string, string>()
    const activeDatesByUser = new Map<string, Set<string>>()
    for (const a of active) {
      if (!a.user_id || !a.active_date) continue
      const d = dayOf(a.active_date)
      if (!activeDatesByUser.has(a.user_id)) activeDatesByUser.set(a.user_id, new Set())
      activeDatesByUser.get(a.user_id)!.add(d)
      if (!firstActive.has(a.user_id) || d < firstActive.get(a.user_id)!) firstActive.set(a.user_id, d)
    }
    let j1Elig = 0, j1Ret = 0, j7Elig = 0, j7Ret = 0
    for (const [uid, first] of firstActive) {
      const set = activeDatesByUser.get(uid)!
      if (addDays(first, 1) <= today) { j1Elig++; if (set.has(addDays(first, 1))) j1Ret++ }
      if (addDays(first, 7) <= today) { j7Elig++; if (set.has(addDays(first, 7))) j7Ret++ }
    }
    const dau = new Set(active.filter(a => dayOf(a.active_date) === today).map(a => a.user_id)).size
    const wau = active7d
    const retention = {
      j1: j1Elig ? Math.round((100 * j1Ret) / j1Elig) : null,
      j7: j7Elig ? Math.round((100 * j7Ret) / j7Elig) : null,
      j1_base: j1Elig, j7_base: j7Elig,
      dau, wau, stickiness: wau ? Math.round((100 * dau) / wau) : 0,
    }

    const streakBucket = (s: number) => s >= 7 ? '7+ j' : s >= 4 ? '4-6 j' : s >= 2 ? '2-3 j' : s >= 1 ? '1 j' : '0 j'
    const streakOrder = ['0 j', '1 j', '2-3 j', '4-6 j', '7+ j']
    const streakCounts = new Map(streakOrder.map(l => [l, 0]))
    for (const u of users) { const b = streakBucket(u.streak_current || 0); streakCounts.set(b, (streakCounts.get(b) || 0) + 1) }
    const streak_buckets = streakOrder.map(label => ({ label, count: streakCounts.get(label) || 0 }))

    const daysBucket = (n: number) => n >= 7 ? '7+ j' : n >= 5 ? '5-6 j' : n >= 3 ? '3-4 j' : n >= 2 ? '2 j' : '1 j'
    const daysOrder = ['1 j', '2 j', '3-4 j', '5-6 j', '7+ j']
    const daysCounts = new Map(daysOrder.map(l => [l, 0]))
    for (const [, set] of activeDatesByUser) { const b = daysBucket(set.size); daysCounts.set(b, (daysCounts.get(b) || 0) + 1) }
    const days_active_buckets = daysOrder.map(label => ({ label, count: daysCounts.get(label) || 0 }))

    // ===== Pack 3 : onboarding & funnel =====
    const playersSet = new Set(plays.filter(p => p.player_id).map(p => p.player_id))
    const tutoDone = users.filter(u => u.tutorial_modal_done).length
    const returned = [...activeDatesByUser.values()].filter(s => s.size >= 2).length
    const funnel = [
      { label: 'Inscrits', count: users.length },
      { label: 'Tuto terminé', count: tutoDone },
      { label: 'Ont joué', count: playersSet.size },
      { label: 'Revenus (2 j+)', count: returned },
    ]
    const playDays = new Set<string>()
    for (const p of plays) if (p.player_id && p.started_at) playDays.add(p.player_id + '|' + dayOf(p.started_at))
    let playedSignup = 0
    for (const u of users) if (playDays.has(u.id + '|' + dayOf(u.created_at))) playedSignup++
    const played_signup_rate = users.length ? Math.round((100 * playedSignup) / users.length) : 0

    // ===== Pack 4 : communauté & contenu =====
    const futureFilled = new Set(grids.filter(g => g.daily_date && dayOf(g.daily_date) >= today).map(g => dayOf(g.daily_date)))
    let runway = 0
    while (futureFilled.has(addDays(today, runway))) runway++
    const lastFilled = [...futureFilled].sort().pop() ?? null
    // Tampon réel du modèle « réserve » : nb de grilles de secours non datées.
    const reserveCount = grids.filter(g => g.daily_status === 'reserve').length
    const calendar_coverage = { runway, last_date: lastFilled, future_count: futureFilled.size, reserve_count: reserveCount, today }

    const socialMap = new Map<string, { date: string; upvotes: number; comments: number }>()
    const ensureSocial = (d: string) => {
      let r = socialMap.get(d)
      if (!r) { r = { date: d, upvotes: 0, comments: 0 }; socialMap.set(d, r) }
      return r
    }
    for (const uv of upvotes) if (uv.created_at) ensureSocial(dayOf(uv.created_at)).upvotes++
    for (const p of plays) if (p.comment && p.comment.trim()) ensureSocial(dayOf(p.completed_at ?? p.started_at)).comments++
    const social_series = fillSeries(
      [...socialMap.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
      (d) => ({ date: d, upvotes: 0, comments: 0 }),
    )

    const top_grids = [...grids]
      .sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0))
      .slice(0, 6)
      .map(g => { const st = gridStats(g); return { label: gridLabel(g), date: g.daily_date ?? null, upvotes: g.upvotes_count || 0, success_rate: st.success_rate, players: st.players } })

    const sugCounts = new Map(SUGGESTION_STATUSES.map(s => [s, 0]))
    for (const s of suggestions) sugCounts.set(s.status, (sugCounts.get(s.status) || 0) + 1)
    const suggestions_by_status = SUGGESTION_STATUSES.map(status => ({ status, count: sugCounts.get(status) || 0 }))
    const sugSeriesMap = new Map<string, number>()
    for (const s of suggestions) if (s.created_at) { const d = dayOf(s.created_at); sugSeriesMap.set(d, (sugSeriesMap.get(d) || 0) + 1) }
    const suggestions_series = fillSeries(
      [...sugSeriesMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, count]) => ({ date, count })),
      (d) => ({ date: d, count: 0 }),
    )

    const skinCounts = new Map<number, number>()
    for (const u of users) { const s = u.selected_skin || 1; skinCounts.set(s, (skinCounts.get(s) || 0) + 1) }
    const skins = [...skinCounts.entries()].sort((a, b) => a[0] - b[0]).map(([skin, count]) => ({ label: `Skin ${skin}`, skin, count }))

    return json({
      kpis, series,
      grids_difficulty, error_breakdown,
      retention, streak_buckets, days_active_buckets,
      funnel, played_signup_rate,
      calendar_coverage, social_series, top_grids, suggestions_by_status, suggestions_series, skins,
    })
  }

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
    const { date, grid_id, clues, placements } = body
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'invalid date' }, 400)

    // Les grilles du jour appartiennent TOUJOURS au compte système "Orienta"
    // (jamais à un joueur réel) : pas d'XP créateur, pas de notif de jeu, et
    // le créateur est exclu du classement. On ignore tout creator_id client.
    const { data: systemUser } = await supabase
      .from('orienta_users').select('id').eq('is_system', true).order('created_at').limit(1).maybeSingle()
    if (!systemUser) return json({ error: 'system account missing' }, 500)
    const creator_id = systemUser.id

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

  // ─── Création / mise à jour d'une grille de RÉSERVE (sans date, priorisée) ───
  if (action === 'save-reserve-grid') {
    const { grid_id, clues, placements } = body
    const diff = body.difficulty && ['facile', 'moyen', 'difficile'].includes(body.difficulty) ? body.difficulty : 'facile'

    const { data: systemUser } = await supabase
      .from('orienta_users').select('id').eq('is_system', true).order('created_at').limit(1).maybeSingle()
    if (!systemUser) return json({ error: 'system account missing' }, 500)

    const c = {
      top: (clues?.top ?? '').trim(), right: (clues?.right ?? '').trim(),
      bottom: (clues?.bottom ?? '').trim(), left: (clues?.left ?? '').trim(),
    }
    if (!c.top || !c.right || !c.bottom || !c.left) return json({ error: 'all clues required' }, 400)
    if ([c.top, c.right, c.bottom, c.left].some(v => v.length > MAX_CLUE_LENGTH)) return json({ error: 'clue too long' }, 400)
    if (!Array.isArray(placements) || placements.length !== 4) return json({ error: 'exactly 4 placements required' }, 400)
    if (placements.map(p => p.position).sort().join(',') !== '0,1,2,3') return json({ error: 'positions must be 0..3' }, 400)
    for (const p of placements) {
      if (!p.card_id || !ROTATIONS.includes(norm(p.rotation))) return json({ error: 'invalid placement' }, 400)
    }
    const cardIds = placements.map(p => p.card_id)
    const { data: cards } = await supabase.from('orienta_word_cards').select('id').in('id', cardIds)
    if (!cards || cards.length !== cardIds.length) return json({ error: 'invalid cards' }, 400)

    const base = {
      creator_id: systemUser.id, status: 'published', daily_status: 'reserve', daily_date: null,
      difficulty: diff,
      clue_top: c.top, clue_right: c.right, clue_bottom: c.bottom, clue_left: c.left,
    }

    let gid = grid_id
    if (grid_id) {
      // Édition : on conserve la priorité existante.
      await supabase.from('orienta_grids').update(base).eq('id', grid_id)
      await supabase.from('orienta_grid_cards').delete().eq('grid_id', grid_id)
    } else {
      // Nouvelle grille : priorité en fin de file (max + 1).
      const { data: last } = await supabase
        .from('orienta_grids').select('reserve_priority')
        .eq('daily_status', 'reserve').order('reserve_priority', { ascending: false }).limit(1).maybeSingle()
      const nextPriority = ((last?.reserve_priority as number | undefined) ?? 0) + 1
      const { data: newGrid, error } = await supabase.from('orienta_grids')
        .insert({ ...base, reserve_priority: nextPriority }).select('id').single()
      if (error || !newGrid) return json({ error: 'could not create reserve grid' }, 500)
      gid = newGrid.id
    }

    const rows = placements.map(p => ({
      grid_id: gid, card_id: p.card_id, position: p.position, rotation: norm(p.rotation),
    }))
    const { error: cardsErr } = await supabase.from('orienta_grid_cards').insert(rows)
    if (cardsErr) return json({ error: 'could not insert grid cards' }, 500)
    return json({ ok: true, grid_id: gid })
  }

  // ─── Réordonner la réserve (priorité d'utilisation : ordre du tableau = ordre de pioche) ───
  if (action === 'reorder-reserve') {
    const { order } = body
    if (!Array.isArray(order) || order.some(id => typeof id !== 'string')) return json({ error: 'invalid order' }, 400)
    for (let i = 0; i < order.length; i++) {
      await supabase.from('orienta_grids')
        .update({ reserve_priority: i + 1 }).eq('id', order[i]).eq('daily_status', 'reserve')
    }
    return json({ ok: true, count: order.length })
  }

  return json({ error: 'unknown action' }, 400)
})
