import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { evaluateAttempt } from '../_shared/scoring.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// ── Mode RAID — autorité serveur (anti-triche) ───────────────────────
// La solution ne sort jamais du serveur ; l'info sémantique (indices/mots) est
// distribuée par organe ; le client ne voit que des HANDLES opaques (c0..c3),
// jamais les vrais card_id (sinon il lirait les mots via orienta_word_cards qui
// est public). card_map (handle→card_id) vit dans orienta_raid_session_secrets
// (RLS sans SELECT). Mirror des capacités : src/lib/raid.js.

const MAX_ATTEMPTS = 3
const ASSAULT_SECONDS = 240            // chrono par assaut (~4 min)
const START_LIVES = 2                  // bouées
const HP_PER_ASSAULT = 100
const ROTATIONS = [0, 90, 180, 270]

// Échelle adaptative (mirror src/lib/raid.js)
const LADDER: Record<number, string[]> = {
  3: ['oeil', 'main', 'capitaine'],
  4: ['oeil', 'timonier', 'mecanicien', 'capitaine'],
  5: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine'],
  6: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine', 'navigateur'],
  7: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine', 'navigateur', 'sonar'],
  8: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine', 'navigateur', 'sonar', 'horloger'],
}
const MIN_PLAYERS = 3
const ALL_ROLES = ['oeil', 'main', 'vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine', 'navigateur', 'sonar', 'horloger']
const organsForTier = (n: number) => LADDER[Math.max(MIN_PLAYERS, Math.min(8, n))]

const canSeeClues    = (r: string) => ['oeil', 'vigie'].includes(r)
const canSeeWords    = (r: string) => ['oeil', 'cartographe'].includes(r)
const canSeeFeedback = (r: string) => r === 'capitaine'
const canPlace       = (r: string) => ['main', 'timonier'].includes(r)
const canRotate      = (r: string) => ['main', 'mecanicien'].includes(r)
const canValidate    = (r: string) => r === 'capitaine'

// Bosses (mirror src/lib/raid.js — clé + nb d'assauts)
const BOSSES = [
  { key: 'meduse', assault_count: 3 }, { key: 'crabe', assault_count: 3 },
  { key: 'pieuvre', assault_count: 3 }, { key: 'requin', assault_count: 3 },
  { key: 'leviathan', assault_count: 4 },
]

// ── Vérification du secret admin (copie de admin/index.ts) ───────────
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
  const { data: cfg } = await supabase
    .from('orienta_admin_config').select('value').eq('key', 'admin_secret_sha256').maybeSingle()
  const expected = cfg?.value
  if (!expected || !provided) return false
  return secretMatches(await sha256Hex(provided), expected)
}

const shuffle = <T>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[r[i], r[j]] = [r[j], r[i]] } return r }
const nowIso = () => new Date().toISOString()

// ── Helpers d'état ───────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
function publicSession(s: any) {
  return {
    id: s.id, boss_key: s.boss_key, status: s.status, tier: s.tier, perils: s.perils,
    assault_index: s.assault_index, assault_count: s.assault_count,
    attempts_remaining: s.attempts_remaining, assault_deadline: s.assault_deadline,
    lives: s.lives, max_hp: s.max_hp, current_hp: s.current_hp,
    board: s.board, card_order: s.card_order, is_test: s.is_test, window_closes_at: s.window_closes_at,
  }
}

// Prépare un assaut : choisit l'ordre neutre (handles c0..c3) et la card_map.
// deno-lint-ignore no-explicit-any
async function buildAssault(supabase: any, gridId: string) {
  const { data: gc } = await supabase
    .from('orienta_grid_cards').select('card_id').eq('grid_id', gridId)
  const ids = shuffle((gc ?? []).map((g: { card_id: string }) => g.card_id)).slice(0, 4)
  const handles = ids.map((_: string, i: number) => `c${i}`)
  const card_map: Record<string, string> = {}
  ids.forEach((id: string, i: number) => { card_map[handles[i]] = id })
  return { card_order: handles, card_map }
}

// ── Scoped state pour l'organe appelant (cœur anti-triche) ───────────
// deno-lint-ignore no-explicit-any
async function scopedView(supabase: any, session: any, secrets: any, role: string | null) {
  const view: Record<string, unknown> = {}
  if (!role || session.status !== 'active' || !secrets) return view
  const gridId = (secrets.grid_ids ?? [])[session.assault_index]
  if (!gridId) return view

  if (canSeeClues(role)) {
    const { data: grid } = await supabase
      .from('orienta_grids').select('clue_top, clue_right, clue_bottom, clue_left').eq('id', gridId).single()
    if (grid) view.clues = { top: grid.clue_top, right: grid.clue_right, bottom: grid.clue_bottom, left: grid.clue_left }
  }
  if (canSeeWords(role)) {
    const map = secrets.card_map ?? {}
    const ids = Object.values(map) as string[]
    const { data: cards } = await supabase
      .from('orienta_word_cards').select('id, word_top, word_right, word_bottom, word_left').in('id', ids)
    const byId: Record<string, unknown> = {}
    for (const c of (cards ?? [])) byId[c.id] = { top: c.word_top, right: c.word_right, bottom: c.word_bottom, left: c.word_left }
    // Renvoyé par handle (le client ne voit jamais les vrais ids)
    const words: Record<string, unknown> = {}
    for (const [handle, id] of Object.entries(map)) words[handle] = byId[id as string]
    view.words = words
  }
  if (canSeeFeedback(role)) {
    view.feedback = secrets.last_feedback ?? null
  }
  return view
}

// deno-lint-ignore no-explicit-any
async function fullState(supabase: any, sessionId: string, playerId: string) {
  const { data: session } = await supabase.from('orienta_raid_sessions').select('*').eq('id', sessionId).single()
  if (!session) return null
  const { data: roster } = await supabase
    .from('orienta_raid_participants').select('user_id, pseudo, role, is_ready').eq('session_id', sessionId).order('joined_at')
  const me = (roster ?? []).find((p: { user_id: string }) => p.user_id === playerId) ?? null
  const { data: secrets } = await supabase.from('orienta_raid_session_secrets').select('*').eq('session_id', sessionId).maybeSingle()
  const view = await scopedView(supabase, session, secrets, me?.role ?? null)
  return { session: publicSession(session), roster: roster ?? [], me, view }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const action = String(body.action ?? '')
  const playerId = body.player_id ? String(body.player_id) : ''
  const sessionId = body.session_id ? String(body.session_id) : ''

  // ─────────────────────────────────────────────────────────────────
  // open-test (ADMIN) : ouvre une arène de test, hors fenêtre 12–15h.
  // ─────────────────────────────────────────────────────────────────
  if (action === 'open-test') {
    // Admin (secret serveur) OU compte testeur (pseudo « Testeur 1-4 », relu en base
    // — on ne fait pas confiance au pseudo du body). Allègement de PHASE DE TEST :
    // à retirer à la sortie publique (la feature est de toute façon cachée des joueurs).
    let allowed = await verifyAdmin(supabase, String(body.admin_secret ?? ''))
    if (!allowed && playerId) {
      const { data: u } = await supabase.from('orienta_users').select('pseudo').eq('id', playerId).maybeSingle()
      if (u && /^testeur\s*[1-4]$/i.test(String(u.pseudo ?? '').trim())) allowed = true
    }
    if (!allowed) return json({ error: 'unauthorized' }, 403)

    // Réutilise une arène de test ouverte si elle existe (évite les doublons).
    const { data: open } = await supabase.from('orienta_raid_sessions')
      .select('id').eq('is_test', true).in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (open) return json({ session_id: open.id, reused: true })

    const { data: prog } = await supabase.from('orienta_collective_progress').select('boss_index_cleared').eq('id', 1).maybeSingle()
    const boss = BOSSES[((prog?.boss_index_cleared ?? 0)) % BOSSES.length]

    // Grilles d'assaut : publiées, sans leurre (facile/moyen → 4 cartes).
    const { data: grids } = await supabase.from('orienta_grids')
      .select('id').eq('status', 'published').in('difficulty', ['facile', 'moyen']).limit(80)
    const pool = shuffle((grids ?? []).map((g: { id: string }) => g.id))
    if (pool.length < 1) return json({ error: 'no grids available' }, 409)
    const gridIds = pool.slice(0, boss.assault_count)
    const assaultCount = gridIds.length
    const maxHp = assaultCount * HP_PER_ASSAULT

    const { data: session, error } = await supabase.from('orienta_raid_sessions').insert({
      boss_key: boss.key, status: 'waiting', assault_count: assaultCount,
      max_hp: maxHp, current_hp: maxHp, is_test: true,
      window_opens_at: nowIso(), window_closes_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
    }).select('id').single()
    if (error || !session) return json({ error: 'could not open arena' }, 500)
    await supabase.from('orienta_raid_session_secrets').insert({ session_id: session.id, grid_ids: gridIds })
    return json({ session_id: session.id })
  }

  if (!playerId) return json({ error: 'player_id required' }, 400)

  // ─────────────────────────────────────────────────────────────────
  // join : rejoint l'arène ouverte (par id, ou la dernière arène de test).
  // ─────────────────────────────────────────────────────────────────
  if (action === 'join') {
    let sid = sessionId
    if (!sid) {
      const { data: open } = await supabase.from('orienta_raid_sessions')
        .select('id').in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!open) return json({ error: 'no_open_arena' }, 404)
      sid = open.id
    }
    const { data: session } = await supabase.from('orienta_raid_sessions').select('status').eq('id', sid).single()
    if (!session) return json({ error: 'session not found' }, 404)

    await supabase.from('orienta_raid_participants')
      .upsert({ session_id: sid, user_id: playerId, pseudo: String(body.pseudo ?? ''), last_seen: nowIso() },
              { onConflict: 'session_id,user_id' })
    const state = await fullState(supabase, sid, playerId)
    return json(state)
  }

  if (!sessionId) return json({ error: 'session_id required' }, 400)

  // ─────────────────────────────────────────────────────────────────
  // claim-role / release-role : choix d'organe en salle d'attente.
  // ─────────────────────────────────────────────────────────────────
  if (action === 'claim-role' || action === 'release-role') {
    const { data: session } = await supabase.from('orienta_raid_sessions').select('status').eq('id', sessionId).single()
    if (!session) return json({ error: 'session not found' }, 404)
    if (session.status !== 'waiting') return json({ error: 'already_started' }, 409)

    const role = action === 'release-role' ? null : String(body.role ?? '')
    if (role && !ALL_ROLES.includes(role)) return json({ error: 'invalid role' }, 400)

    const { error } = await supabase.from('orienta_raid_participants')
      .update({ role, is_ready: false }).eq('session_id', sessionId).eq('user_id', playerId)
    // Conflit d'unicité (organe déjà pris) → 23505
    if (error) return json({ error: 'role_taken' }, 409)
    return json(await fullState(supabase, sessionId, playerId))
  }

  // ─────────────────────────────────────────────────────────────────
  // ready : prêt/pas prêt ; démarre si toutes les conditions sont réunies.
  // ─────────────────────────────────────────────────────────────────
  if (action === 'ready') {
    const { data: session } = await supabase.from('orienta_raid_sessions').select('*').eq('id', sessionId).single()
    if (!session) return json({ error: 'session not found' }, 404)
    if (session.status !== 'waiting') return json({ error: 'already_started' }, 409)

    await supabase.from('orienta_raid_participants')
      .update({ is_ready: !!body.ready }).eq('session_id', sessionId).eq('user_id', playerId)

    // Conditions de lancement : ≥3 joueurs, tous un organe, tous prêts,
    // et les organes couvrent exactement le palier (= effectif).
    const { data: roster } = await supabase.from('orienta_raid_participants')
      .select('role, is_ready').eq('session_id', sessionId)
    const ps = roster ?? []
    const count = ps.length
    const roles = ps.map((p: { role: string | null }) => p.role).filter(Boolean) as string[]
    const required = count >= MIN_PLAYERS ? organsForTier(count) : []
    const allReady = ps.length > 0 && ps.every((p: { is_ready: boolean }) => p.is_ready)
    const rolesOk = required.length > 0
      && roles.length === count
      && new Set(roles).size === count
      && required.every(r => roles.includes(r))

    if (count >= MIN_PLAYERS && allReady && rolesOk) {
      const { data: secrets } = await supabase.from('orienta_raid_session_secrets').select('grid_ids').eq('session_id', sessionId).single()
      const gridIds: string[] = secrets?.grid_ids ?? []
      const { card_order, card_map } = await buildAssault(supabase, gridIds[0])
      await supabase.from('orienta_raid_session_secrets').update({ card_map, updated_at: nowIso() }).eq('session_id', sessionId)
      await supabase.from('orienta_raid_sessions').update({
        status: 'active', tier: count, card_order, board: {},
        assault_index: 0, attempts_remaining: MAX_ATTEMPTS, lives: START_LIVES,
        current_hp: session.max_hp,
        assault_deadline: new Date(Date.now() + ASSAULT_SECONDS * 1000).toISOString(),
        started_at: nowIso(),
      }).eq('id', sessionId)
    }
    return json(await fullState(supabase, sessionId, playerId))
  }

  // ─────────────────────────────────────────────────────────────────
  // state : état + vue scoped pour l'organe appelant.
  // ─────────────────────────────────────────────────────────────────
  if (action === 'state') {
    await supabase.from('orienta_raid_participants').update({ last_seen: nowIso() }).eq('session_id', sessionId).eq('user_id', playerId)
    const state = await fullState(supabase, sessionId, playerId)
    if (!state) return json({ error: 'session not found' }, 404)
    return json(state)
  }

  // ─────────────────────────────────────────────────────────────────
  // move : la Main pose/tourne (board en handles). Persistance autoritaire.
  // ─────────────────────────────────────────────────────────────────
  if (action === 'move') {
    const { data: session } = await supabase.from('orienta_raid_sessions').select('status, card_order').eq('id', sessionId).single()
    if (!session) return json({ error: 'session not found' }, 404)
    if (session.status !== 'active') return json({ error: 'not_active' }, 409)

    const { data: me } = await supabase.from('orienta_raid_participants').select('role').eq('session_id', sessionId).eq('user_id', playerId).maybeSingle()
    if (!me?.role || !(canPlace(me.role) || canRotate(me.role))) return json({ error: 'forbidden' }, 403)

    // Valide la forme du board : { slot: {handle, rotation} }, handles connus.
    const board = body.board as Record<string, { handle?: string; rotation?: number }> | undefined
    const order: string[] = session.card_order ?? []
    const clean: Record<string, { handle: string; rotation: number }> = {}
    if (board && typeof board === 'object') {
      for (const slot of ['0', '1', '2', '3']) {
        const cell = board[slot]
        if (cell && order.includes(cell.handle ?? '') && ROTATIONS.includes(cell.rotation ?? 0)) {
          clean[slot] = { handle: cell.handle as string, rotation: cell.rotation as number }
        }
      }
    }
    // Un handle ne peut occuper qu'un slot.
    const seen = new Set<string>()
    for (const slot of Object.keys(clean)) {
      if (seen.has(clean[slot].handle)) { delete clean[slot]; continue }
      seen.add(clean[slot].handle)
    }
    await supabase.from('orienta_raid_sessions').update({ board: clean }).eq('id', sessionId)
    return json({ ok: true })
  }

  // ─────────────────────────────────────────────────────────────────
  // validate : le Capitaine soumet l'essai. Autorité d'évaluation.
  // ─────────────────────────────────────────────────────────────────
  if (action === 'validate') {
    const { data: session } = await supabase.from('orienta_raid_sessions').select('*').eq('id', sessionId).single()
    if (!session) return json({ error: 'session not found' }, 404)
    if (session.status !== 'active') return json({ error: 'not_active' }, 409)

    const { data: me } = await supabase.from('orienta_raid_participants').select('role').eq('session_id', sessionId).eq('user_id', playerId).maybeSingle()
    if (!me?.role || !canValidate(me.role)) return json({ error: 'forbidden' }, 403)

    // Chrono dépassé → assaut échoué (traité comme un timeout).
    if (session.assault_deadline && Date.now() > new Date(session.assault_deadline).getTime()) {
      return json(await failAssault(supabase, session, playerId, 'timeout'))
    }

    const board = session.board ?? {}
    if (Object.keys(board).length !== 4) return json({ error: 'incomplete' }, 400)

    const { data: secrets } = await supabase.from('orienta_raid_session_secrets').select('*').eq('session_id', sessionId).single()
    const cardMap: Record<string, string> = secrets?.card_map ?? {}
    const gridId = (secrets?.grid_ids ?? [])[session.assault_index]

    // Construit la réponse en vrais card_id (handle→card_id), par slot.
    const answer = ['0', '1', '2', '3'].map((slot) => ({
      card_id: cardMap[board[slot].handle],
      position: Number(slot),
      rotation: board[slot].rotation,
    }))

    const { data: solution } = await supabase.from('orienta_grid_cards').select('card_id, position, rotation').eq('grid_id', gridId)
    if (!solution) return json({ error: 'solution not found' }, 404)
    // deno-lint-ignore no-explicit-any
    const { correctFull, correctRotation, neither, cardFeedbacks } = evaluateAttempt(answer as any, solution as any)
    const success = correctFull === 4

    // Feedback par SLOT (le Capitaine le partagera).
    const fbBySlot: Record<string, string> = {}
    for (const slot of ['0', '1', '2', '3']) fbBySlot[slot] = cardFeedbacks[answer[Number(slot)].card_id] ?? 'wrong'

    const attemptsLeft = session.attempts_remaining - 1
    await supabase.from('orienta_raid_attempts').insert({
      session_id: sessionId, assault_index: session.assault_index, submitted_by: playerId,
      answer, correct_full: correctFull, correct_rotation: correctRotation, neither,
      damage: success ? HP_PER_ASSAULT : 0,
    })
    await supabase.from('orienta_raid_session_secrets').update({ last_feedback: fbBySlot, updated_at: nowIso() }).eq('session_id', sessionId)

    if (success) {
      const nextAssault = session.assault_index + 1
      if (nextAssault >= session.assault_count) {
        // ── VICTOIRE ──
        await supabase.from('orienta_raid_sessions').update({ status: 'won', current_hp: 0, ended_at: nowIso() }).eq('id', sessionId)
        await supabase.rpc('award_raid_victory', { p_session_id: sessionId })
        return json({ success: true, finalized: true, card_feedbacks: fbBySlot, state: await fullState(supabase, sessionId, playerId) })
      }
      // Assaut suivant
      const { card_order, card_map } = await buildAssault(supabase, (secrets?.grid_ids ?? [])[nextAssault])
      await supabase.from('orienta_raid_session_secrets').update({ card_map, last_feedback: null, updated_at: nowIso() }).eq('session_id', sessionId)
      await supabase.from('orienta_raid_sessions').update({
        assault_index: nextAssault, card_order, board: {}, attempts_remaining: MAX_ATTEMPTS,
        current_hp: session.max_hp - nextAssault * HP_PER_ASSAULT,
        assault_deadline: new Date(Date.now() + ASSAULT_SECONDS * 1000).toISOString(),
      }).eq('id', sessionId)
      return json({ success: true, assaultCleared: true, card_feedbacks: fbBySlot, state: await fullState(supabase, sessionId, playerId) })
    }

    // Échec d'essai
    if (attemptsLeft <= 0) {
      return json(await failAssault(supabase, session, playerId, 'attempts'))
    }
    await supabase.from('orienta_raid_sessions').update({ attempts_remaining: attemptsLeft }).eq('id', sessionId)
    return json({ success: false, card_feedbacks: fbBySlot, attempts_remaining: attemptsLeft, state: await fullState(supabase, sessionId, playerId) })
  }

  // ─────────────────────────────────────────────────────────────────
  // timeout : un client signale le chrono écoulé.
  // ─────────────────────────────────────────────────────────────────
  if (action === 'timeout') {
    const { data: session } = await supabase.from('orienta_raid_sessions').select('*').eq('id', sessionId).single()
    if (!session) return json({ error: 'session not found' }, 404)
    if (session.status !== 'active') return json({ error: 'not_active' }, 409)
    if (!session.assault_deadline || Date.now() <= new Date(session.assault_deadline).getTime()) {
      return json(await fullState(supabase, sessionId, playerId))
    }
    return json(await failAssault(supabase, session, playerId, 'timeout'))
  }

  // ─────────────────────────────────────────────────────────────────
  // leave : quitte l'arène.
  // ─────────────────────────────────────────────────────────────────
  if (action === 'leave') {
    await supabase.from('orienta_raid_participants').delete().eq('session_id', sessionId).eq('user_id', playerId)
    return json({ ok: true })
  }

  return json({ error: 'unknown action' }, 400)
})

// Assaut raté (chrono ou 3 essais) : perte d'une bouée ; à 0 → défaite.
// deno-lint-ignore no-explicit-any
async function failAssault(supabase: any, session: any, playerId: string, _reason: string) {
  const lives = session.lives - 1
  if (lives <= 0) {
    await supabase.from('orienta_raid_sessions').update({ status: 'lost', lives: 0, ended_at: nowIso() }).eq('id', session.id)
  } else {
    await supabase.from('orienta_raid_sessions').update({
      lives, attempts_remaining: MAX_ATTEMPTS, board: {},
      assault_deadline: new Date(Date.now() + ASSAULT_SECONDS * 1000).toISOString(),
    }).eq('id', session.id)
    await supabase.from('orienta_raid_session_secrets').update({ last_feedback: null, updated_at: nowIso() }).eq('session_id', session.id)
  }
  return { failed: true, lives: Math.max(0, lives), state: await fullState(supabase, session.id, playerId) }
}
