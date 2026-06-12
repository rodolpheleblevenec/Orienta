import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { evaluateAttempt } from '../_shared/scoring.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// ── Mode RAID — autorité serveur, sollicitée RAREMENT ────────────────
// L'interaction temps réel (roster/rôles/prêt, cartes, chat) passe par Supabase
// Realtime (Presence + Broadcast) côté client → instantané. Cette fonction ne
// gère que ce qui doit être autoritaire/secret et n'arrive que quelques fois :
//   find (trouver l'arène) · open-test (ouvrir) · start (lancer) · view (vue
//   scoped d'un organe) · validate (évaluer un essai) · timeout.
// La solution ne sort jamais ; le client ne voit que des HANDLES (c0..c3) ;
// card_map (handle→card_id) vit dans orienta_raid_session_secrets (RLS sans SELECT).
// Capacités mirror : src/lib/raid.js.

const MAX_ATTEMPTS = 3
const ASSAULT_SECONDS = 240
const START_LIVES = 2
const HP_PER_ASSAULT = 100
const ROTATIONS = [0, 90, 180, 270]

const LADDER: Record<number, string[]> = {
  3: ['oeil', 'main', 'capitaine'],
  4: ['oeil', 'timonier', 'mecanicien', 'capitaine'],
  5: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine'],
  6: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine', 'navigateur'],
  7: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine', 'navigateur', 'sonar'],
  8: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine', 'navigateur', 'sonar', 'horloger'],
}
const MIN_PLAYERS = 3
const organsForTier = (n: number) => LADDER[Math.max(MIN_PLAYERS, Math.min(8, n))]

const canSeeClues    = (r: string) => ['oeil', 'vigie'].includes(r)
const canSeeWords    = (r: string) => ['oeil', 'cartographe'].includes(r)
const canSeeFeedback = (r: string) => r === 'capitaine'
const canValidate    = (r: string) => r === 'capitaine'

const BOSSES = [
  { key: 'meduse', assault_count: 3 }, { key: 'crabe', assault_count: 3 },
  { key: 'pieuvre', assault_count: 3 }, { key: 'requin', assault_count: 3 },
  { key: 'leviathan', assault_count: 4 },
]

// ── Secret admin (copie de admin/index.ts) ───────────────────────────
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
// deno-lint-ignore no-explicit-any
async function verifyAdmin(supabase: any, provided: string): Promise<boolean> {
  const { data: cfg } = await supabase.from('orienta_admin_config').select('value').eq('key', 'admin_secret_sha256').maybeSingle()
  const expected = cfg?.value
  if (!expected || !provided) return false
  return secretMatches(await sha256Hex(provided), expected)
}

const shuffle = <T>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[r[i], r[j]] = [r[j], r[i]] } return r }
const nowIso = () => new Date().toISOString()

// deno-lint-ignore no-explicit-any
function publicSession(s: any) {
  return {
    id: s.id, boss_key: s.boss_key, status: s.status, tier: s.tier,
    assault_index: s.assault_index, assault_count: s.assault_count,
    attempts_remaining: s.attempts_remaining, assault_deadline: s.assault_deadline,
    lives: s.lives, max_hp: s.max_hp, current_hp: s.current_hp,
    card_order: s.card_order, is_test: s.is_test, sonar_used: s.sonar_used,
  }
}

// Prépare un assaut : ordre neutre (handles c0..c3) + card_map (handle→card_id).
// `deterministic` (arènes de test/dev) : pas de mélange → même disposition à chaque assaut.
// deno-lint-ignore no-explicit-any
async function buildAssault(supabase: any, gridId: string, deterministic = false) {
  const { data: gc } = await supabase.from('orienta_grid_cards').select('card_id').eq('grid_id', gridId).order('card_id')
  const ids0 = (gc ?? []).map((g: { card_id: string }) => g.card_id)
  const ids = (deterministic ? ids0 : shuffle(ids0)).slice(0, 4)
  const handles = ids.map((_: string, i: number) => `c${i}`)
  const card_map: Record<string, string> = {}
  ids.forEach((id: string, i: number) => { card_map[handles[i]] = id })
  return { card_order: handles, card_map }
}

// Vue SCOPED pour l'organe appelant (cœur anti-triche).
// deno-lint-ignore no-explicit-any
async function scopedView(supabase: any, session: any, secrets: any, role: string | null) {
  const view: Record<string, unknown> = {}
  if (!role || session.status !== 'active' || !secrets) return view
  const gridId = (secrets.grid_ids ?? [])[session.assault_index]
  if (!gridId) return view
  if (canSeeClues(role)) {
    const { data: grid } = await supabase.from('orienta_grids').select('clue_top, clue_right, clue_bottom, clue_left').eq('id', gridId).single()
    if (grid) view.clues = { top: grid.clue_top, right: grid.clue_right, bottom: grid.clue_bottom, left: grid.clue_left }
  }
  if (canSeeWords(role)) {
    const map = secrets.card_map ?? {}
    const { data: cards } = await supabase.from('orienta_word_cards').select('id, word_top, word_right, word_bottom, word_left').in('id', Object.values(map) as string[])
    const byId: Record<string, unknown> = {}
    for (const c of (cards ?? [])) byId[c.id] = { top: c.word_top, right: c.word_right, bottom: c.word_bottom, left: c.word_left }
    const words: Record<string, unknown> = {}
    for (const [handle, id] of Object.entries(map)) words[handle] = byId[id as string]
    view.words = words
  }
  if (canSeeFeedback(role)) view.feedback = secrets.last_feedback ?? null
  return view
}

// deno-lint-ignore no-explicit-any
async function buildView(supabase: any, sessionId: string, playerId: string) {
  const { data: session } = await supabase.from('orienta_raid_sessions').select('*').eq('id', sessionId).single()
  if (!session) return null
  const { data: roster } = await supabase.from('orienta_raid_participants').select('user_id, pseudo, role').eq('session_id', sessionId).order('joined_at')
  const me = (roster ?? []).find((p: { user_id: string }) => p.user_id === playerId) ?? null
  const { data: secrets } = await supabase.from('orienta_raid_session_secrets').select('*').eq('session_id', sessionId).maybeSingle()
  const view = await scopedView(supabase, session, secrets, me?.role ?? null)
  return { session: publicSession(session), roster: roster ?? [], me, view }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const action = String(body.action ?? '')
  const playerId = body.player_id ? String(body.player_id) : ''
  const sessionId = body.session_id ? String(body.session_id) : ''

  // ── find : l'arène ouverte du moment (waiting OU active). Aucun effet. ──
  if (action === 'find') {
    const { data: open } = await supabase.from('orienta_raid_sessions')
      .select('*').in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!open) return json({ session: null })
    return json({ session: publicSession(open) })
  }

  // ── open-test (admin OU compte testeur) : ouvre une arène hors fenêtre. ──
  if (action === 'open-test') {
    let allowed = await verifyAdmin(supabase, String(body.admin_secret ?? ''))
    if (!allowed && playerId) {
      const { data: u } = await supabase.from('orienta_users').select('pseudo').eq('id', playerId).maybeSingle()
      if (u && /^testeur\s*[1-4]$/i.test(String(u.pseudo ?? '').trim())) allowed = true
    }
    if (!allowed) return json({ error: 'unauthorized' }, 403)

    const { data: existing } = await supabase.from('orienta_raid_sessions')
      .select('id').eq('is_test', true).in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (existing) return json({ session_id: existing.id, reused: true })

    const { data: prog } = await supabase.from('orienta_collective_progress').select('boss_index_cleared').eq('id', 1).maybeSingle()
    const boss = BOSSES[(prog?.boss_index_cleared ?? 0) % BOSSES.length]
    // DEV : une arène de test (open-test) utilise TOUJOURS la même grille, et la
    // même à chaque assaut, pour tester sans avoir à re-résoudre. Épinglable via
    // RAID_DEV_GRID_ID ; sinon 1ère grille publiée facile/moyen (déterministe par id).
    // (Les vraies arènes publiques, via raid-spawn, utiliseront la sélection 60–85%.)
    const { data: candidates } = await supabase.from('orienta_grids')
      .select('id').eq('status', 'published').in('difficulty', ['facile', 'moyen']).order('id').limit(400)
    const candIds = (candidates ?? []).map((g: { id: string }) => g.id)
    if (candIds.length < 1) return json({ error: 'no grids available' }, 409)
    const devGrid = Deno.env.get('RAID_DEV_GRID_ID') || candIds[0]
    const gridIds = Array(boss.assault_count).fill(devGrid)
    const maxHp = gridIds.length * HP_PER_ASSAULT

    const { data: session, error } = await supabase.from('orienta_raid_sessions').insert({
      boss_key: boss.key, status: 'waiting', assault_count: gridIds.length,
      max_hp: maxHp, current_hp: maxHp, is_test: true,
      window_opens_at: nowIso(), window_closes_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
    }).select('id').single()
    if (error || !session) return json({ error: 'could not open arena' }, 500)
    await supabase.from('orienta_raid_session_secrets').insert({ session_id: session.id, grid_ids: gridIds })
    return json({ session_id: session.id })
  }

  if (!sessionId) return json({ error: 'session_id required' }, 400)
  if (!playerId) return json({ error: 'player_id required' }, 400)

  // ── start : lance le combat. Le client (lobby en Presence) envoie le roster. ──
  if (action === 'start') {
    const { data: session } = await supabase.from('orienta_raid_sessions').select('*').eq('id', sessionId).single()
    if (!session) return json({ error: 'session not found' }, 404)
    if (session.status === 'active') return json(await buildView(supabase, sessionId, playerId)) // idempotent
    if (session.status !== 'waiting') return json({ error: 'closed' }, 409)

    const roster = (body.roster ?? []) as { user_id: string; pseudo?: string; role: string }[]
    const count = roster.length
    const roles = roster.map(r => r.role)
    const required = count >= MIN_PLAYERS ? organsForTier(count) : []
    const ok = count >= MIN_PLAYERS && count <= 8
      && new Set(roles).size === count
      && required.length === count
      && required.every(r => roles.includes(r))
    if (!ok) return json({ error: 'invalid_roster' }, 400)

    // Persiste le roster (sert aux notifs de victoire + à l'autorité des rôles).
    await supabase.from('orienta_raid_participants').delete().eq('session_id', sessionId)
    await supabase.from('orienta_raid_participants').insert(
      roster.map(r => ({ session_id: sessionId, user_id: r.user_id, pseudo: r.pseudo ?? '', role: r.role }))
    )
    const { data: secrets } = await supabase.from('orienta_raid_session_secrets').select('grid_ids').eq('session_id', sessionId).single()
    let gridIds: string[] = secrets?.grid_ids ?? []
    // DEV : au lancement d'une arène de test, on (re)fixe la grille de dev — même
    // pour une arène ouverte avant ce changement.
    if (session.is_test) {
      const { data: dg } = await supabase.from('orienta_grids')
        .select('id').eq('status', 'published').in('difficulty', ['facile', 'moyen']).order('id').limit(1)
      const devGrid = Deno.env.get('RAID_DEV_GRID_ID') || dg?.[0]?.id
      if (devGrid) {
        gridIds = Array(session.assault_count).fill(devGrid)
        await supabase.from('orienta_raid_session_secrets').update({ grid_ids: gridIds }).eq('session_id', sessionId)
      }
    }
    const { card_order, card_map } = await buildAssault(supabase, gridIds[0], session.is_test)
    await supabase.from('orienta_raid_session_secrets').update({ card_map, last_feedback: null, updated_at: nowIso() }).eq('session_id', sessionId)
    await supabase.from('orienta_raid_sessions').update({
      status: 'active', tier: count, card_order, assault_index: 0,
      attempts_remaining: MAX_ATTEMPTS, lives: START_LIVES, current_hp: session.max_hp, sonar_used: false,
      assault_deadline: new Date(Date.now() + ASSAULT_SECONDS * 1000).toISOString(), started_at: nowIso(),
    }).eq('id', sessionId)
    return json(await buildView(supabase, sessionId, playerId))
  }

  // ── view : état + vue scoped pour l'organe appelant. ──
  if (action === 'view') {
    const v = await buildView(supabase, sessionId, playerId)
    if (!v) return json({ error: 'session not found' }, 404)
    return json(v)
  }

  // ── validate : le Capitaine soumet le plateau (reçu en body, pas en base). ──
  if (action === 'validate') {
    const { data: session } = await supabase.from('orienta_raid_sessions').select('*').eq('id', sessionId).single()
    if (!session) return json({ error: 'session not found' }, 404)
    if (session.status !== 'active') return json({ error: 'not_active' }, 409)
    const { data: me } = await supabase.from('orienta_raid_participants').select('role').eq('session_id', sessionId).eq('user_id', playerId).maybeSingle()
    if (!me?.role || !canValidate(me.role)) return json({ error: 'forbidden' }, 403)

    if (session.assault_deadline && Date.now() > new Date(session.assault_deadline).getTime()) {
      await supabase.from('orienta_raid_sessions').update({ status: 'lost', ended_at: nowIso() }).eq('id', sessionId)
      return json(await buildView(supabase, sessionId, playerId))
    }

    // Plateau reçu : { slot: {handle, rotation} }. Validé contre card_order + ROTATIONS.
    const board = (body.board ?? {}) as Record<string, { handle?: string; rotation?: number }>
    const order: string[] = session.card_order ?? []
    const slots = ['0', '1', '2', '3']
    for (const s of slots) {
      const cell = board[s]
      if (!cell || !order.includes(cell.handle ?? '') || !ROTATIONS.includes(cell.rotation ?? -1)) return json({ error: 'incomplete' }, 400)
    }
    if (new Set(slots.map(s => board[s].handle)).size !== 4) return json({ error: 'incomplete' }, 400)

    const { data: secrets } = await supabase.from('orienta_raid_session_secrets').select('*').eq('session_id', sessionId).single()
    const cardMap: Record<string, string> = secrets?.card_map ?? {}
    const gridId = (secrets?.grid_ids ?? [])[session.assault_index]
    const answer = slots.map((s) => ({ card_id: cardMap[board[s].handle as string], position: Number(s), rotation: board[s].rotation as number }))

    const { data: solution } = await supabase.from('orienta_grid_cards').select('card_id, position, rotation').eq('grid_id', gridId)
    if (!solution) return json({ error: 'solution not found' }, 404)
    // deno-lint-ignore no-explicit-any
    const { correctFull, correctRotation, neither, cardFeedbacks } = evaluateAttempt(answer as any, solution as any)
    const success = correctFull === 4
    const fbBySlot: Record<string, string> = {}
    for (const s of slots) fbBySlot[s] = cardFeedbacks[answer[Number(s)].card_id] ?? 'wrong'

    const attemptsLeft = session.attempts_remaining - 1
    await supabase.from('orienta_raid_attempts').insert({
      session_id: sessionId, assault_index: session.assault_index, submitted_by: playerId,
      answer, correct_full: correctFull, correct_rotation: correctRotation, neither, damage: success ? HP_PER_ASSAULT : 0,
    })
    await supabase.from('orienta_raid_session_secrets').update({ last_feedback: fbBySlot, updated_at: nowIso() }).eq('session_id', sessionId)

    if (success) {
      const next = session.assault_index + 1
      if (next >= session.assault_count) {
        await supabase.from('orienta_raid_sessions').update({ status: 'won', current_hp: 0, ended_at: nowIso() }).eq('id', sessionId)
        await supabase.rpc('award_raid_victory', { p_session_id: sessionId })
        return json({ ...(await buildView(supabase, sessionId, playerId)), feedback: fbBySlot, success: true })
      }
      const { card_order, card_map } = await buildAssault(supabase, (secrets?.grid_ids ?? [])[next], session.is_test)
      await supabase.from('orienta_raid_session_secrets').update({ card_map, last_feedback: null, updated_at: nowIso() }).eq('session_id', sessionId)
      // Timer GLOBAL : on ne réinitialise pas le chrono entre assauts.
      await supabase.from('orienta_raid_sessions').update({
        assault_index: next, card_order, attempts_remaining: MAX_ATTEMPTS, sonar_used: false,
        current_hp: session.max_hp - next * HP_PER_ASSAULT,
      }).eq('id', sessionId)
      return json({ ...(await buildView(supabase, sessionId, playerId)), feedback: fbBySlot, success: true, assaultCleared: true })
    }

    if (attemptsLeft <= 0) return json({ ...(await failAssault(supabase, session, playerId, 'attempts')), feedback: fbBySlot })
    await supabase.from('orienta_raid_sessions').update({ attempts_remaining: attemptsLeft }).eq('id', sessionId)
    return json({ ...(await buildView(supabase, sessionId, playerId)), feedback: fbBySlot, success: false })
  }

  // ── timeout : un client signale le chrono écoulé. ──
  if (action === 'timeout') {
    const { data: session } = await supabase.from('orienta_raid_sessions').select('*').eq('id', sessionId).single()
    if (!session) return json({ error: 'session not found' }, 404)
    if (session.status !== 'active') return json(await buildView(supabase, sessionId, playerId))
    if (!session.assault_deadline || Date.now() <= new Date(session.assault_deadline).getTime()) {
      return json(await buildView(supabase, sessionId, playerId))
    }
    // Chrono global écoulé → défaite totale.
    await supabase.from('orienta_raid_sessions').update({ status: 'lost', ended_at: nowIso() }).eq('id', sessionId)
    return json(await buildView(supabase, sessionId, playerId))
  }

  // ── sonar : le Capitaine sonde UNE carte/assaut → vrai si parfaitement placée. ──
  if (action === 'sonar') {
    const { data: session } = await supabase.from('orienta_raid_sessions').select('*').eq('id', sessionId).single()
    if (!session) return json({ error: 'session not found' }, 404)
    if (session.status !== 'active') return json({ error: 'not_active' }, 409)
    const { data: me } = await supabase.from('orienta_raid_participants').select('role').eq('session_id', sessionId).eq('user_id', playerId).maybeSingle()
    if (!me?.role || !canValidate(me.role)) return json({ error: 'forbidden' }, 403)
    if (session.sonar_used) return json({ error: 'sonar_spent' }, 409)

    // Le plateau vient du client (Broadcast), pas de la base.
    const slot = String(body.slot ?? '')
    const board = (body.board ?? {}) as Record<string, { handle?: string; rotation?: number }>
    const cell = board[slot]
    if (!cell || !cell.handle) return json({ error: 'empty' }, 400)
    const { data: secrets } = await supabase.from('orienta_raid_session_secrets').select('card_map, grid_ids').eq('session_id', sessionId).single()
    const cardId = (secrets?.card_map ?? {})[cell.handle]
    const gridId = (secrets?.grid_ids ?? [])[session.assault_index]
    const { data: solution } = await supabase.from('orienta_grid_cards').select('card_id, position, rotation').eq('grid_id', gridId)
    // deno-lint-ignore no-explicit-any
    const sol = (solution ?? []).find((s: any) => s.card_id === cardId)
    const green = !!sol && sol.position === Number(slot) && sol.rotation === cell.rotation

    await supabase.from('orienta_raid_sessions').update({ sonar_used: true }).eq('id', sessionId)
    return json({ ...(await buildView(supabase, sessionId, playerId)), green, slot: Number(slot) })
  }

  return json({ error: 'unknown action' }, 400)
})

// Assaut raté (chrono ou 3 essais) : -1 bouée ; à 0 → défaite.
// deno-lint-ignore no-explicit-any
async function failAssault(supabase: any, session: any, playerId: string, _reason: string) {
  const lives = session.lives - 1
  if (lives <= 0) {
    await supabase.from('orienta_raid_sessions').update({ status: 'lost', lives: 0, ended_at: nowIso() }).eq('id', session.id)
  } else {
    // Timer GLOBAL : le chrono continue (on ne le réinitialise pas après un assaut raté).
    await supabase.from('orienta_raid_sessions').update({
      lives, attempts_remaining: MAX_ATTEMPTS, sonar_used: false,
    }).eq('id', session.id)
    await supabase.from('orienta_raid_session_secrets').update({ last_feedback: null, updated_at: nowIso() }).eq('session_id', session.id)
  }
  return { ...(await buildView(supabase, session.id, playerId)), failed: true }
}
