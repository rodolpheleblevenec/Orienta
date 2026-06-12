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
//   find · ensure-public (spawn public à la demande) · open-test · start · view ·
//   validate · sonar · timeout · hof (Hall of Fame, lecture).
// La solution ne sort jamais ; le client ne voit que des HANDLES (c0..c3) ;
// card_map (handle→card_id) vit dans orienta_raid_session_secrets (RLS sans SELECT).
// Capacités mirror : src/lib/raid.js.

const MAX_ATTEMPTS = 3
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
// Périls (organes 6-8) reportés → on borne l'effectif fonctionnel à 5.
const MAX_FUNCTIONAL_TIER = 5
const organsForTier = (n: number) => LADDER[Math.max(MIN_PLAYERS, Math.min(MAX_FUNCTIONAL_TIER, n))]

const canSeeClues    = (r: string) => ['oeil', 'vigie'].includes(r)
const canSeeWords    = (r: string) => ['oeil', 'cartographe'].includes(r)
const canSeeFeedback = (r: string) => r === 'capitaine'
const canValidate    = (r: string) => r === 'capitaine'

const BOSSES = [
  { key: 'meduse', assault_count: 3 }, { key: 'crabe', assault_count: 3 },
  { key: 'pieuvre', assault_count: 3 }, { key: 'requin', assault_count: 3 },
  { key: 'leviathan', assault_count: 4 },
]

// ── Boss de la semaine + escalade hebdomadaire (mirror src/lib/raid.js) ──
// Le boss est figé pour TOUTE la semaine (semaine 1 = niveau 1, etc.), calculée
// depuis RAID_LAUNCH_AT. Il n'avance plus à chaque victoire ; il monte au rollover
// hebdomadaire (pur calcul de temps, insensible au DST car ancré sur un instant absolu).
const RAID_LAUNCH_MS = Date.parse('2026-06-15T08:00:00+02:00')
const WEEK_MS = 7 * 24 * 3600 * 1000
const currentRaidLevel = (nowMs = Date.now()) =>
  Math.max(1, Math.floor((nowMs - RAID_LAUNCH_MS) / WEEK_MS) + 1)
const bossKeyForLevel = (level: number) => BOSSES[(Math.max(1, level) - 1) % BOSSES.length].key

// Escalade : leviers sans nouvelle mécanique client. grid_band = [min,max] taux (0..1).
type LevelCfg = { assault_count: number; min_players: number; lives: number; timer_seconds: number; difficulties: string[]; grid_band: [number, number] }
const LEVEL_LADDER: LevelCfg[] = [
  { assault_count: 3, min_players: 3, lives: 3, timer_seconds: 300, difficulties: ['facile', 'moyen'], grid_band: [0.70, 0.90] },
  { assault_count: 3, min_players: 3, lives: 2, timer_seconds: 270, difficulties: ['facile', 'moyen'], grid_band: [0.60, 0.85] },
  { assault_count: 4, min_players: 4, lives: 2, timer_seconds: 330, difficulties: ['moyen'], grid_band: [0.55, 0.80] },
  { assault_count: 5, min_players: 4, lives: 2, timer_seconds: 390, difficulties: ['moyen', 'difficile'], grid_band: [0.45, 0.75] },
  { assault_count: 6, min_players: 5, lives: 1, timer_seconds: 420, difficulties: ['moyen', 'difficile'], grid_band: [0.35, 0.70] },
]
const difficultyForLevel = (level: number): LevelCfg =>
  LEVEL_LADDER[Math.min(Math.max(1, level), LEVEL_LADDER.length) - 1]

// ── Fenêtres d'ouverture publique (Europe/Paris, DST géré par Intl) ──────
const RAID_WINDOWS = [{ start: '08:30', end: '10:30' }, { start: '12:00', end: '14:00' }]
const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }
function parisMinutes(nowMs: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(nowMs))
  let h = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
  if (h === 24) h = 0
  return h * 60 + m
}
const isWithinWindowParis = (nowMs: number) => {
  const mins = parisMinutes(nowMs)
  return RAID_WINDOWS.some(w => mins >= toMin(w.start) && mins < toMin(w.end))
}
const isLaunchedServer = (nowMs = Date.now()) => nowMs >= RAID_LAUNCH_MS

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
    id: s.id, boss_key: s.boss_key, boss_level: s.boss_level, status: s.status, tier: s.tier,
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

// Sélectionne un pool de grilles pour un palier : difficulté + bande de taux de
// réussite (calculé via orienta_plays, comme admin/index.ts). Des fallbacks
// garantissent qu'on renvoie toujours assault_count grilles — le spawn ne doit
// jamais échouer faute de grille « parfaitement » dans la bande.
// deno-lint-ignore no-explicit-any
async function selectGridPool(supabase: any, cfg: LevelCfg): Promise<string[]> {
  const want = cfg.assault_count
  const { data: grids } = await supabase.from('orienta_grids')
    .select('id').eq('status', 'published').in('difficulty', cfg.difficulties).limit(1000)
  let gridIds: string[] = (grids ?? []).map((g: { id: string }) => g.id)
  if (gridIds.length === 0) return []
  // Échantillon borné : on ne charge les stats que sur ~80 grilles (URL .in + plafond
  // de lignes PostgREST). Le mélange assure la variété d'une arène à l'autre.
  gridIds = shuffle(gridIds).slice(0, 80)
  const { data: plays } = await supabase.from('orienta_plays').select('grid_id, success').in('grid_id', gridIds).limit(5000)
  const stat = new Map<string, { total: number; succ: number }>()
  for (const p of (plays ?? [])) {
    if (!p.grid_id) continue
    const s = stat.get(p.grid_id) ?? { total: 0, succ: 0 }
    s.total++; if (p.success) s.succ++
    stat.set(p.grid_id, s)
  }
  const MIN_PLAYS = 8
  const [lo, hi] = cfg.grid_band
  const inBand = (id: string, pad: number) => {
    const s = stat.get(id); if (!s || s.total < MIN_PLAYS) return false
    const r = s.succ / s.total; return r >= lo - pad && r <= hi + pad
  }
  let pool = gridIds.filter(id => inBand(id, 0))
  if (pool.length < want) pool = gridIds.filter(id => inBand(id, 0.10))   // élargir ±10 pts
  if (pool.length < want) pool = gridIds                                   // dernier recours : toute la difficulté
  const picked = shuffle(pool).slice(0, want)
  while (picked.length < want && pool.length > 0) picked.push(pool[picked.length % pool.length])
  return picked
}

// Nettoyage paresseux (sans cron) — appelé par find / ensure-public.
// Libère l'index unique « une arène publique ouverte » pour le créneau suivant.
// deno-lint-ignore no-explicit-any
async function lazyCleanup(supabase: any, nowMs: number) {
  const iso = new Date(nowMs).toISOString()
  // 1. Combat dont le chrono global est dépassé → perdu (cas : tout le monde a quitté).
  await supabase.from('orienta_raid_sessions')
    .update({ status: 'lost', ended_at: iso })
    .eq('status', 'active').lt('assault_deadline', iso)
  // 2. Salle d'attente publique périmée (hors créneau, ou trop ancienne) → expirée.
  let q = supabase.from('orienta_raid_sessions')
    .update({ status: 'expired', ended_at: iso })
    .eq('status', 'waiting').eq('is_test', false)
  if (isWithinWindowParis(nowMs)) q = q.lt('created_at', new Date(nowMs - 2 * 3600_000).toISOString())
  await q
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

  // ── find : arène ouverte du moment + état fenêtre. Nettoie d'abord. ──
  if (action === 'find') {
    const nowMs = Date.now()
    await lazyCleanup(supabase, nowMs)
    const launched = isLaunchedServer(nowMs)
    const windowOpen = isWithinWindowParis(nowMs)
    // Arène PUBLIQUE ouverte = toujours prioritaire (modèle sérialisé : une seule).
    const { data: pub } = await supabase.from('orienta_raid_sessions')
      .select('*').eq('is_test', false).in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (pub) return json({ session: publicSession(pub), window: { open: windowOpen, launched } })
    // Pas d'arène publique : avant le lancement (ou pour admin/testeur), exposer
    // l'arène de TEST si elle existe (flux de test admin inchangé).
    let allowTest = !launched
    if (!allowTest && playerId) {
      const { data: u } = await supabase.from('orienta_users').select('pseudo').eq('id', playerId).maybeSingle()
      const pseudo = String(u?.pseudo ?? '').trim()
      if (pseudo === 'Rodolphe LE BLEVENEC' || /^testeur\s*[1-4]$/i.test(pseudo)) allowTest = true
    }
    if (allowTest) {
      const { data: test } = await supabase.from('orienta_raid_sessions')
        .select('*').eq('is_test', true).in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (test) return json({ session: publicSession(test), window: { open: windowOpen, launched } })
    }
    return json({ session: null, window: { open: windowOpen, launched } })
  }

  // ── ensure-public : spawn À LA DEMANDE pendant un créneau (modèle sérialisé). ──
  if (action === 'ensure-public') {
    const nowMs = Date.now()
    await lazyCleanup(supabase, nowMs)
    if (!isLaunchedServer(nowMs)) return json({ session: null, window: { open: false, launched: false } })
    if (!isWithinWindowParis(nowMs)) return json({ session: null, window: { open: false, launched: true } })
    // Déjà une arène publique ouverte → la rejoindre.
    const { data: existing } = await supabase.from('orienta_raid_sessions')
      .select('*').eq('is_test', false).in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (existing) return json({ session: publicSession(existing), window: { open: true, launched: true } })
    // Sinon : créer l'arène de la semaine.
    const level = currentRaidLevel(nowMs)
    const cfg = difficultyForLevel(level)
    const gridIds = await selectGridPool(supabase, cfg)
    if (!gridIds.length) return json({ error: 'no grids available' }, 409)
    const maxHp = cfg.assault_count * HP_PER_ASSAULT
    const { data: session, error } = await supabase.from('orienta_raid_sessions').insert({
      boss_key: bossKeyForLevel(level), boss_level: level, status: 'waiting',
      assault_count: cfg.assault_count, lives: cfg.lives, max_hp: maxHp, current_hp: maxHp, is_test: false,
      window_opens_at: nowIso(), window_closes_at: new Date(nowMs + 2 * 3600_000).toISOString(),
    }).select('*').single()
    if (error || !session) {
      // Course perdue sur l'index unique → rejoindre l'arène gagnante.
      const { data: race } = await supabase.from('orienta_raid_sessions')
        .select('*').eq('is_test', false).in('status', ['waiting', 'active']).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (race) return json({ session: publicSession(race), window: { open: true, launched: true } })
      return json({ error: 'could not open arena' }, 500)
    }
    await supabase.from('orienta_raid_session_secrets').insert({ session_id: session.id, grid_ids: gridIds })
    return json({ session: publicSession(session), window: { open: true, launched: true } })
  }

  // ── hof : Hall of Fame d'un niveau (semaine). Lecture publique, aucun effet. ──
  if (action === 'hof') {
    const level = body.level != null ? Number(body.level) : currentRaidLevel(Date.now())
    const { data: wins } = await supabase.from('orienta_raid_sessions')
      .select('id, boss_key, boss_level, tier, started_at, ended_at')
      .eq('status', 'won').eq('boss_level', level)
    const sessions = (wins ?? []) as { id: string; tier: number; started_at: string; ended_at: string }[]
    const ids = sessions.map((s) => s.id)
    const partsBySession = new Map<string, { pseudo: string; role: string }[]>()
    if (ids.length) {
      const { data: parts } = await supabase.from('orienta_raid_participants')
        .select('session_id, pseudo, role').in('session_id', ids).order('joined_at')
      for (const p of (parts ?? [])) {
        const a = partsBySession.get(p.session_id) ?? []
        a.push({ pseudo: p.pseudo, role: p.role }); partsBySession.set(p.session_id, a)
      }
    }
    const clearSec = (s: { started_at: string; ended_at: string }) =>
      (s.started_at && s.ended_at) ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000) : null
    const teams = sessions.map((s) => ({
      session_id: s.id, tier: s.tier, ended_at: s.ended_at,
      clear_seconds: clearSec(s), members: partsBySession.get(s.id) ?? [],
    })).filter((t) => t.clear_seconds != null).sort((a, b) => (a.clear_seconds! - b.clear_seconds!))
    const firstWin = sessions.slice().filter((s) => s.ended_at).sort((a, b) => new Date(a.ended_at).getTime() - new Date(b.ended_at).getTime())[0]
    const firstClear = firstWin ? {
      session_id: firstWin.id, ended_at: firstWin.ended_at,
      clear_seconds: clearSec(firstWin), members: partsBySession.get(firstWin.id) ?? [],
    } : null
    return json({ level, boss_key: bossKeyForLevel(level), teams, firstClear })
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

    // Boss/difficulté = ceux de la SEMAINE en cours → les testeurs prévisualisent
    // exactement le boss public. DEV : grille figée (même à chaque assaut) pour
    // tester sans re-résoudre — épinglable via RAID_DEV_GRID_ID.
    const level = currentRaidLevel(Date.now())
    const cfg = difficultyForLevel(level)
    const { data: candidates } = await supabase.from('orienta_grids')
      .select('id').eq('status', 'published').in('difficulty', ['facile', 'moyen']).order('id').limit(400)
    const candIds = (candidates ?? []).map((g: { id: string }) => g.id)
    if (candIds.length < 1) return json({ error: 'no grids available' }, 409)
    const devGrid = Deno.env.get('RAID_DEV_GRID_ID') || candIds[0]
    const gridIds = Array(cfg.assault_count).fill(devGrid)
    const maxHp = gridIds.length * HP_PER_ASSAULT

    const { data: session, error } = await supabase.from('orienta_raid_sessions').insert({
      boss_key: bossKeyForLevel(level), boss_level: level, status: 'waiting', assault_count: gridIds.length,
      max_hp: maxHp, current_hp: maxHp, is_test: true, lives: cfg.lives,
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

    const level = session.boss_level ?? currentRaidLevel(Date.now())
    const cfg = difficultyForLevel(level)
    const roster = (body.roster ?? []) as { user_id: string; pseudo?: string; role: string }[]
    const count = roster.length
    const roles = roster.map(r => r.role)
    const required = count >= cfg.min_players ? organsForTier(count) : []
    const ok = count >= cfg.min_players && count <= MAX_FUNCTIONAL_TIER
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
      attempts_remaining: MAX_ATTEMPTS, lives: cfg.lives, current_hp: session.max_hp, sonar_used: false,
      assault_deadline: new Date(Date.now() + cfg.timer_seconds * 1000).toISOString(), started_at: nowIso(),
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
