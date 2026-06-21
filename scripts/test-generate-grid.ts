// Test autonome de la chaîne de génération (LLM + géométrie) SANS la fonction edge.
// Tire de vrais mots du pool (REST anon), exécute les 2 phases OpenAI, valide via le
// VRAI harness géométrie, et affiche la grille. N'écrit RIEN en base.
//
// Usage (clé passée en env, jamais écrite sur disque) :
//   OPENAI_API_KEY=sk-... node --experimental-strip-types scripts/test-generate-grid.ts
import { readFileSync } from 'node:fs'
import { encodeArrangement, type Arrangement } from '../supabase/functions/_shared/gridGeometry.ts'

const MAX_CLUE_LENGTH = 80
const MODEL = process.env.OPENAI_MODEL || 'o4-mini'
const KEY = process.env.OPENAI_API_KEY
if (!KEY) { console.error('OPENAI_API_KEY manquante (env).'); process.exit(1) }

function loadEnv(): Record<string, string> {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const env: Record<string, string> = {}
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i === -1) continue
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}
const norm = (w: unknown) => String(w ?? '').toLowerCase().trim()

async function chatJSON(messages: unknown[]): Promise<Record<string, unknown>> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, response_format: { type: 'json_object' }, messages }),
  })
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 400)}`)
  const data = await res.json()
  return JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
}

type Card = { id: string; words: string[] }

async function phase1(cards: Card[]) {
  const cardList = cards.map((c) => `Carte ${c.id} : ${c.words.map((w) => `« ${w} »`).join(', ')}`).join('\n')
  const system =
    `Tu prépares une grille du jeu de mots « Orienta ». Plateau : un trèfle 2×2 de 4 cartes, disposées en anneau aux 4 coins (haut-gauche, haut-droite, bas-gauche, bas-droite).\n` +
    `Chaque carte montre EXACTEMENT 2 de ses 4 mots vers l'extérieur (les 2 autres restent cachés au centre).\n` +
    `Chaque coin expose un mot vers son bord HORIZONTAL (haut ou bas) et un mot vers son bord VERTICAL (gauche ou droite).\n` +
    `Chaque BORD réunit donc 2 mots voisins, et recevra UN indice devant relier ses 2 mots EN MÊME TEMPS.\n` +
    `Objectif : choisir quelle carte va à quel coin et quels 2 mots chaque carte expose, de sorte que les 4 paires de bords soient SÉMANTIQUEMENT LIABLES. Évite d'apparier des mots sans rapport.`
  const user =
    `Les 4 cartes :\n${cardList}\n\n` +
    `Réponds en JSON STRICT :\n` +
    `{ "analysis": "...", "ring": {\n` +
    `  "top_left": { "card":"A","expose_to_top":"<mot>","expose_to_left":"<mot>" },\n` +
    `  "top_right": { "card":"B","expose_to_top":"<mot>","expose_to_right":"<mot>" },\n` +
    `  "bottom_left": { "card":"C","expose_to_bottom":"<mot>","expose_to_left":"<mot>" },\n` +
    `  "bottom_right": { "card":"D","expose_to_bottom":"<mot>","expose_to_right":"<mot>" } } }\n` +
    `Chaque carte A,B,C,D à EXACTEMENT un coin ; 2 mots DIFFÉRENTS de CETTE carte.`
  const out = await chatJSON([{ role: 'system', content: system }, { role: 'user', content: user }])
  const ring = out.ring as Record<string, Record<string, string>>
  const byId = new Map(cards.map((c) => [c.id, c.words.map(norm)]))
  const used = new Set<string>()
  const corner = (key: string, hKey: string, vKey: string) => {
    const node = ring[key]
    const id = String(node.card).trim().toUpperCase()
    const words = byId.get(id)
    if (!words) throw new Error(`carte inconnue ${node.card} au coin ${key}`)
    if (used.has(id)) throw new Error(`carte ${id} deux fois`)
    used.add(id)
    const h = norm(node[hKey]), v = norm(node[vKey])
    if (!words.includes(h)) throw new Error(`${node[hKey]} pas dans carte ${id}`)
    if (!words.includes(v)) throw new Error(`${node[vKey]} pas dans carte ${id}`)
    if (h === v) throw new Error(`carte ${id} 2 mots identiques`)
    return { words, exposeHorizontal: h, exposeVertical: v }
  }
  const arrangement: Arrangement = {
    top_left: corner('top_left', 'expose_to_top', 'expose_to_left'),
    top_right: corner('top_right', 'expose_to_top', 'expose_to_right'),
    bottom_left: corner('bottom_left', 'expose_to_bottom', 'expose_to_left'),
    bottom_right: corner('bottom_right', 'expose_to_bottom', 'expose_to_right'),
  }
  return { analysis: String(out.analysis ?? ''), arrangement }
}

async function phase2(pairs: Record<string, [string, string]>, wordSet: Set<string>) {
  const SIDE: Record<string, string> = { top: 'HAUT', right: 'DROITE', bottom: 'BAS', left: 'GAUCHE' }
  const pairList = ['top', 'right', 'bottom', 'left'].map((s) => `- bord ${SIDE[s]} : « ${pairs[s][0]} » + « ${pairs[s][1]} »`).join('\n')
  const system =
    `Tu rédiges les indices d'une grille « Orienta ». Chaque indice doit relier SES DEUX mots EN MÊME TEMPS. Court, évocateur.\n` +
    `Interdits : réutiliser un des 16 mots ; dépasser ${MAX_CLUE_LENGTH} caractères ; laisser vide.`
  const user = `Rédige un indice par bord :\n${pairList}\n\nRéponds en JSON STRICT : { "clues": { "top":"...","right":"...","bottom":"...","left":"..." } }`
  const out = await chatJSON([{ role: 'system', content: system }, { role: 'user', content: user }])
  const clues = out.clues as Record<string, string>
  const result: Record<string, string> = {}
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const v = String(clues[side] ?? '').trim()
    if (!v) throw new Error(`indice ${side} vide`)
    if (v.length > MAX_CLUE_LENGTH) throw new Error(`indice ${side} trop long`)
    const tok = v.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean)
    const bad = tok.find((t) => wordSet.has(t))
    if (bad) throw new Error(`indice ${side} réutilise « ${bad} »`)
    result[side] = v
  }
  return result
}

// ── Main ──
const env = loadEnv()
const SB_URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const poolRes = await fetch(`${SB_URL}/rest/v1/orienta_words?select=text&playable=eq.true`, {
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
})
const poolRows = await poolRes.json() as { text: string }[]
const pool = poolRows.map((r) => r.text).filter(Boolean)
console.log(`Pool : ${pool.length} mots jouables.`)
if (pool.length < 16) { console.error('pool insuffisant'); process.exit(1) }

const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 16)
const labels = ['A', 'B', 'C', 'D']
const cards: Card[] = [0, 1, 2, 3].map((i) => ({ id: labels[i], words: picked.slice(i * 4, i * 4 + 4) }))
const wordSet = new Set(picked.map(norm))

console.log('\n=== 16 mots tirés ===')
for (const c of cards) console.log(`Carte ${c.id}: ${c.words.join(', ')}`)

console.log(`\n=== Phase 1 (${MODEL}) : placement & orientation ===`)
const p1 = await phase1(cards)
console.log('Analyse IA :', p1.analysis)

const enc = encodeArrangement(p1.arrangement)
console.log('\nPaires de bords (géométrie validée, round-trip OK) :')
for (const s of ['top', 'right', 'bottom', 'left'] as const) console.log(`  ${s}: ${enc.clues[s][0]} + ${enc.clues[s][1]}`)

console.log(`\n=== Phase 2 : indices ===`)
const clues = await phase2(enc.clues as Record<string, [string, string]>, wordSet)

console.log('\n=== GRILLE GÉNÉRÉE ===')
console.log('Indices :')
console.log(`        ↑ HAUT   : ${clues.top}`)
console.log(`        ↓ BAS    : ${clues.bottom}`)
console.log(`        ← GAUCHE : ${clues.left}`)
console.log(`        → DROITE : ${clues.right}`)
console.log('\nSolution (cartes posées) :')
const posName = ['haut-gauche', 'haut-droite', 'bas-gauche', 'bas-droite']
for (const c of enc.cards) {
  console.log(`  ${posName[c.position]} (rot ${c.rotation}°): haut=${c.words.top} droite=${c.words.right} bas=${c.words.bottom} gauche=${c.words.left}`)
}
console.log('\n✅ Chaîne complète OK (LLM + géométrie + validations).')
