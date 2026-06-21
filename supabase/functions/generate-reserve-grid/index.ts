import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { type Arrangement, encodeArrangement, exteriorPairs, type CardWords } from '../_shared/gridGeometry.ts'

// ─────────────────────────────────────────────────────────────────────────────
// generate-reserve-grid — fabrique des grilles de RÉSERVE en BROUILLON à l'aide
// d'un LLM (OpenAI), en deux phases :
//   1) placement & orientation  → quels 2 mots chaque carte expose + appariements
//   2) indices                  → 1 indice par bord, reliant ses 2 mots
// Le harness géométrie (_shared/gridGeometry.ts) encode l'arrangement de façon
// toujours réalisable (rotation aléatoire) ; le LLM ne fait QUE de la sémantique.
// Les grilles produites sont des brouillons (status='draft') relus en admin.
//
// Auth : admin_secret (hash en orienta_admin_config) OU FUNCTION_SECRET (cron).
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-function-secret',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const RESERVE_TARGET = 10 // on vise ~10 grilles disponibles (réserve + brouillons)
const CAP_PER_CALL = 2 // borne le temps/coût par invocation (marge timeout, surtout en modèle de raisonnement) ; le cron boucle
const MAX_CLUE_LENGTH = 80
const DIFFICULTIES = ['facile', 'moyen', 'difficile']

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1'
const OPENAI_BASE_URL = (Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, '')
const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET')

const norm = (w: unknown) => String(w ?? '').toLowerCase().trim()

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
async function authorize(req: Request, body: any, supabase: any): Promise<boolean> {
  // Cron : FUNCTION_SECRET (header ou body).
  const provided = req.headers.get('x-function-secret') || body.function_secret || ''
  if (FUNCTION_SECRET && provided && secretMatches(String(provided), FUNCTION_SECRET)) return true
  // Admin : secret haché en base (même contrat que la fonction `admin`).
  const adminSecret = body.admin_secret || ''
  if (adminSecret) {
    const { data: cfg } = await supabase
      .from('orienta_admin_config').select('value').eq('key', 'admin_secret_sha256').maybeSingle()
    if (cfg?.value && secretMatches(await sha256Hex(String(adminSecret)), cfg.value)) return true
  }
  return false
}

// deno-lint-ignore no-explicit-any
function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── OpenAI (Chat Completions, sortie JSON) ──
// deno-lint-ignore no-explicit-any
async function chatJSON(messages: any[]): Promise<any> {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL, response_format: { type: 'json_object' }, messages }),
  })
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content ?? ''
  try {
    return JSON.parse(content)
  } catch {
    throw new Error('openai: réponse non-JSON')
  }
}

// ── Few-shot : reconstruit quelques (paire de mots → indice) depuis de vraies
//    grilles humaines publiées, pour caler le style des indices générés. ──
// deno-lint-ignore no-explicit-any
async function buildFewShot(supabase: any): Promise<string> {
  try {
    const { data: grids } = await supabase
      .from('orienta_grids')
      .select('clue_top, clue_right, clue_bottom, clue_left, orienta_grid_cards(position, rotation, orienta_word_cards(word_top, word_right, word_bottom, word_left))')
      .eq('status', 'published')
      .not('clue_top', 'is', null)
      .order('created_at', { ascending: false })
      .limit(15)
    const examples: string[] = []
    for (const g of grids ?? []) {
      const cells = g.orienta_grid_cards ?? []
      if (cells.length !== 4) continue
      const byPos: Record<number, { rotation: number; words: CardWords }> = {}
      let ok = true
      for (const cell of cells) {
        const wc = cell.orienta_word_cards
        if (cell.position < 0 || cell.position > 3 || !wc) { ok = false; break }
        byPos[cell.position] = {
          rotation: cell.rotation,
          words: { top: wc.word_top, right: wc.word_right, bottom: wc.word_bottom, left: wc.word_left },
        }
      }
      if (!ok || Object.keys(byPos).length !== 4) continue
      const pairs = exteriorPairs(byPos)
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const clue = (g as Record<string, string>)['clue_' + side]
        if (clue && pairs[side][0] && pairs[side][1]) {
          examples.push(`« ${pairs[side][0]} » + « ${pairs[side][1]} » → indice : « ${clue} »`)
        }
      }
      if (examples.length >= 6) break
    }
    return examples.slice(0, 6).join('\n')
  } catch {
    return ''
  }
}

// ── Phase 1 : placement & orientation ──
type Card = { id: string; words: string[] }
// deno-lint-ignore no-explicit-any
async function phase1(cards: Card[], retryNote = ''): Promise<{ analysis: string; arrangement: Arrangement }> {
  const cardList = cards.map((c) => `Carte ${c.id} : ${c.words.map((w) => `« ${w} »`).join(', ')}`).join('\n')
  const system =
    `Tu prépares une grille du jeu de mots « Orienta ». Plateau : un trèfle 2×2 de 4 cartes, disposées en anneau aux 4 coins (haut-gauche, haut-droite, bas-gauche, bas-droite).\n` +
    `Chaque carte montre EXACTEMENT 2 de ses 4 mots vers l'extérieur (les 2 autres restent cachés au centre).\n` +
    `Chaque coin expose un mot vers son bord HORIZONTAL (haut ou bas) et un mot vers son bord VERTICAL (gauche ou droite) :\n` +
    `  - haut-gauche  : un mot vers le HAUT, un mot vers la GAUCHE\n` +
    `  - haut-droite  : un mot vers le HAUT, un mot vers la DROITE\n` +
    `  - bas-gauche   : un mot vers le BAS,  un mot vers la GAUCHE\n` +
    `  - bas-droite   : un mot vers le BAS,  un mot vers la DROITE\n` +
    `Chaque BORD réunit donc 2 mots voisins :\n` +
    `  - bord HAUT   = mot-haut(haut-gauche) + mot-haut(haut-droite)\n` +
    `  - bord BAS    = mot-bas(bas-gauche)   + mot-bas(bas-droite)\n` +
    `  - bord GAUCHE = mot-gauche(haut-gauche) + mot-gauche(bas-gauche)\n` +
    `  - bord DROITE = mot-droite(haut-droite) + mot-droite(bas-droite)\n` +
    `Plus tard, chaque bord recevra UN indice devant relier ses 2 mots EN MÊME TEMPS.\n` +
    `Ton objectif : choisir quelle carte va à quel coin et quels 2 mots chaque carte expose, de sorte que les 4 paires de mots des bords soient SÉMANTIQUEMENT LIABLES (on peut imaginer un indice reliant les deux). Évite d'apparier des mots sans rapport ou opposés.`
  const user =
    `Les 4 cartes (chaque carte = 4 mots indissociables) :\n${cardList}\n\n` +
    (retryNote ? `Correction nécessaire : ${retryNote}\n\n` : '') +
    `Réponds en JSON STRICT, uniquement avec cette forme :\n` +
    `{\n` +
    `  "analysis": "ton raisonnement : quelles affinités tu vois, pourquoi ces paires",\n` +
    `  "ring": {\n` +
    `    "top_left":     { "card": "A", "expose_to_top": "<mot de cette carte>", "expose_to_left": "<autre mot de cette carte>" },\n` +
    `    "top_right":    { "card": "B", "expose_to_top": "<mot>", "expose_to_right": "<mot>" },\n` +
    `    "bottom_left":  { "card": "C", "expose_to_bottom": "<mot>", "expose_to_left": "<mot>" },\n` +
    `    "bottom_right": { "card": "D", "expose_to_bottom": "<mot>", "expose_to_right": "<mot>" }\n` +
    `  }\n` +
    `}\n` +
    `Contraintes : chacune des 4 cartes A,B,C,D est placée à EXACTEMENT un coin ; les 2 mots exposés d'une carte sont 2 mots DIFFÉRENTS de CETTE carte.`

  const out = await chatJSON([{ role: 'system', content: system }, { role: 'user', content: user }])
  const ring = out?.ring
  if (!ring) throw new Error('phase1: ring manquant')

  const byId = new Map(cards.map((c) => [c.id, c.words]))
  const usedCards = new Set<string>()
  const corner = (key: string, hKey: string, vKey: string) => {
    const node = ring[key]
    if (!node) throw new Error(`phase1: coin ${key} manquant`)
    const id = String(node.card ?? '').trim().toUpperCase()
    const words = byId.get(id)
    if (!words) throw new Error(`phase1: carte inconnue « ${node.card} » au coin ${key}`)
    if (usedCards.has(id)) throw new Error(`phase1: carte ${id} utilisée deux fois`)
    usedCards.add(id)
    const h = norm(node[hKey])
    const v = norm(node[vKey])
    const wl = words.map(norm)
    if (!wl.includes(h)) throw new Error(`phase1: « ${node[hKey]} » n'est pas un mot de la carte ${id}`)
    if (!wl.includes(v)) throw new Error(`phase1: « ${node[vKey]} » n'est pas un mot de la carte ${id}`)
    if (h === v) throw new Error(`phase1: carte ${id} doit exposer 2 mots différents`)
    return { words: wl, exposeHorizontal: h, exposeVertical: v }
  }
  const arrangement: Arrangement = {
    top_left: corner('top_left', 'expose_to_top', 'expose_to_left'),
    top_right: corner('top_right', 'expose_to_top', 'expose_to_right'),
    bottom_left: corner('bottom_left', 'expose_to_bottom', 'expose_to_left'),
    bottom_right: corner('bottom_right', 'expose_to_bottom', 'expose_to_right'),
  }
  if (usedCards.size !== 4) throw new Error('phase1: les 4 cartes ne sont pas toutes placées')
  return { analysis: String(out.analysis ?? ''), arrangement }
}

// ── Phase 2 : indices ──
async function phase2(
  pairs: { top: [string, string]; right: [string, string]; bottom: [string, string]; left: [string, string] },
  wordSet: Set<string>,
  fewShot: string,
  retryNote = '',
): Promise<{ top: string; right: string; bottom: string; left: string }> {
  const SIDE_FR: Record<string, string> = { top: 'HAUT', right: 'DROITE', bottom: 'BAS', left: 'GAUCHE' }
  const pairList = (['top', 'right', 'bottom', 'left'] as const)
    .map((s) => `- bord ${SIDE_FR[s]} : « ${pairs[s][0]} » + « ${pairs[s][1]} »`)
    .join('\n')
  const system =
    `Tu rédiges les indices d'une grille « Orienta ». Règle d'or : chaque indice doit relier SES DEUX mots EN MÊME TEMPS (pas seulement l'un des deux). ` +
    `Un bon indice est court, évocateur, et fait penser aux deux mots à la fois (point commun, expression, mise en situation).\n` +
    `Interdits : réutiliser l'un des 16 mots de la grille dans un indice ; dépasser ${MAX_CLUE_LENGTH} caractères ; laisser un indice vide.`
  const user =
    (fewShot ? `Exemples d'indices de vraies grilles (paire → indice) :\n${fewShot}\n\n` : '') +
    `Rédige un indice pour chacun des 4 bords :\n${pairList}\n\n` +
    (retryNote ? `Correction nécessaire : ${retryNote}\n\n` : '') +
    `Réponds en JSON STRICT : { "clues": { "top": "...", "right": "...", "bottom": "...", "left": "..." } }`

  const out = await chatJSON([{ role: 'system', content: system }, { role: 'user', content: user }])
  const clues = out?.clues
  if (!clues) throw new Error('phase2: clues manquant')
  const result = {
    top: String(clues.top ?? '').trim(),
    right: String(clues.right ?? '').trim(),
    bottom: String(clues.bottom ?? '').trim(),
    left: String(clues.left ?? '').trim(),
  }
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const v = result[side]
    if (!v) throw new Error(`phase2: indice ${side} vide`)
    if (v.length > MAX_CLUE_LENGTH) throw new Error(`phase2: indice ${side} trop long (${v.length}>${MAX_CLUE_LENGTH})`)
    const tokens = v.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean)
    const reused = tokens.find((t) => wordSet.has(t))
    if (reused) throw new Error(`phase2: l'indice ${side} réutilise le mot « ${reused} » d'une carte`)
  }
  return result
}

// ── Génère UNE grille brouillon (compose → phase1 → encode → phase2 → insert) ──
// deno-lint-ignore no-explicit-any
async function generateOne(supabase: any, pool: string[], systemUserId: string, difficulty: string): Promise<string> {
  // 1) 16 mots distincts du pool → 4 cartes (sets).
  const picked = shuffle(pool).slice(0, 16)
  const labels = ['A', 'B', 'C', 'D']
  const cards: Card[] = [0, 1, 2, 3].map((i) => ({ id: labels[i], words: picked.slice(i * 4, i * 4 + 4) }))
  const wordSet = new Set(picked.map(norm))

  // 2) Phase 1 (+1 retry avec feedback).
  let p1: { analysis: string; arrangement: Arrangement }
  try {
    p1 = await phase1(cards)
  } catch (e) {
    p1 = await phase1(cards, (e as Error).message)
  }

  // 3) Encodage géométrique (cartes composées + placements + paires).
  const enc = encodeArrangement(p1.arrangement)

  // 4) Phase 2 (+1 retry avec feedback).
  const fewShot = await buildFewShot(supabase)
  let clues: { top: string; right: string; bottom: string; left: string }
  try {
    clues = await phase2(enc.clues, wordSet, fewShot)
  } catch (e) {
    clues = await phase2(enc.clues, wordSet, fewShot, (e as Error).message)
  }

  // 5) Insertion : cartes composées (playable=false) → grille brouillon → grid_cards.
  const { data: insertedCards, error: cardsErr } = await supabase
    .from('orienta_word_cards')
    .insert(enc.cards.map((c) => ({
      word_top: c.words.top, word_right: c.words.right, word_bottom: c.words.bottom, word_left: c.words.left,
      playable: false,
    })))
    .select('id, word_top')
  if (cardsErr || !insertedCards || insertedCards.length !== 4) throw new Error('insert cartes échoué')
  const cleanupCards = async () =>
    await supabase.from('orienta_word_cards').delete().in('id', insertedCards.map((r: { id: string }) => r.id))
  // word_top unique (16 mots distincts) → mapping sûr position→card_id.
  const idByTop = new Map(insertedCards.map((r: { id: string; word_top: string }) => [r.word_top, r.id]))

  const { data: grid, error: gridErr } = await supabase
    .from('orienta_grids')
    .insert({
      creator_id: systemUserId,
      status: 'draft',
      daily_status: 'draft',
      daily_date: null,
      difficulty,
      clue_top: clues.top, clue_right: clues.right, clue_bottom: clues.bottom, clue_left: clues.left,
      ai_generated: true,
      ai_notes: p1.analysis,
    })
    .select('id')
    .single()
  if (gridErr || !grid) { await cleanupCards(); throw new Error('insert grille échoué') }

  const rows = enc.cards.map((c) => ({
    grid_id: grid.id, card_id: idByTop.get(c.words.top), position: c.position, rotation: c.rotation,
  }))
  const { error: gcErr } = await supabase.from('orienta_grid_cards').insert(rows)
  if (gcErr) {
    await supabase.from('orienta_grids').delete().eq('id', grid.id)
    await cleanupCards()
    throw new Error('insert grid_cards échoué')
  }
  return grid.id as string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // deno-lint-ignore no-explicit-any
  let body: any = {}
  try { body = await req.json() } catch { /* corps vide toléré (cron) */ }

  if (!(await authorize(req, body, supabase))) return json({ error: 'unauthorized' }, 403)
  if (!OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY manquante' }, 500)

  const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : 'facile'

  // Compte courant : réserve jouable + brouillons en attente.
  const reserveQ = supabase.from('orienta_grids').select('id', { count: 'exact', head: true }).eq('daily_status', 'reserve')
  const draftQ = supabase.from('orienta_grids').select('id', { count: 'exact', head: true }).eq('status', 'draft').eq('ai_generated', true)
  const [{ count: reserveCount }, { count: draftCount }] = await Promise.all([reserveQ, draftQ])
  const have = (reserveCount ?? 0) + (draftCount ?? 0)
  const need = Math.max(0, RESERVE_TARGET - have)

  const requested = typeof body.count === 'number' && body.count > 0 ? Math.floor(body.count) : need
  const toMake = Math.min(requested, need, CAP_PER_CALL)
  if (toMake <= 0) return json({ ok: true, made: 0, have, target: RESERVE_TARGET, message: 'réserve déjà pleine' })

  // Pool de mots jouables.
  const { data: poolRows } = await supabase.from('orienta_words').select('text').eq('playable', true)
  const pool = (poolRows ?? []).map((r: { text: string }) => r.text).filter(Boolean)
  if (pool.length < 16) return json({ error: `pool insuffisant (${pool.length} mots, 16 requis)` }, 400)

  const { data: systemUser } = await supabase
    .from('orienta_users').select('id').eq('is_system', true).order('created_at').limit(1).maybeSingle()
  if (!systemUser) return json({ error: 'compte système manquant' }, 500)

  const made: string[] = []
  const errors: string[] = []
  for (let i = 0; i < toMake; i++) {
    try {
      made.push(await generateOne(supabase, pool, systemUser.id, difficulty))
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return json({
    ok: true,
    made: made.length,
    grid_ids: made,
    have: have + made.length,
    target: RESERVE_TARGET,
    remaining_need: Math.max(0, need - made.length),
    errors,
  })
})
