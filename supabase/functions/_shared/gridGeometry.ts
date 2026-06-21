// Géométrie du trèfle 2×2 — SOURCE DE VÉRITÉ partagée (serveur).
//
// Miroir EXACT de la contre-rotation des mots dans src/components/game/WordCard.jsx :
//   physIdx = (origSlot + rotation/90) % 4
// donc l'arête physique `edge` montre le mot du slot d'origine :
//   origSlot = ((edge − rotation/90) mod 4)
//
// Slots & arêtes (mêmes indices) : 0 = haut, 1 = droite, 2 = bas, 3 = gauche.
//
// Positions du trèfle (CSS .clover-grid, 2×2 row-major) :
//   0 = haut-gauche (TL) · 1 = haut-droite (TR) · 2 = bas-gauche (BL) · 3 = bas-droite (BR)
//
// Appariement indice → 2 mots extérieurs (CloverGrid) :
//   clue_top    = arête HAUT  de la carte@0 + arête HAUT  de la carte@1
//   clue_right  = arête DROITE de la carte@1 + arête DROITE de la carte@3
//   clue_bottom = arête BAS   de la carte@2 + arête BAS   de la carte@3
//   clue_left   = arête GAUCHE de la carte@0 + arête GAUCHE de la carte@2

export type CardWords = { top: string; right: string; bottom: string; left: string }

const SLOT_KEYS = ['top', 'right', 'bottom', 'left'] as const
const mod4 = (n: number) => ((n % 4) + 4) % 4

/** Mot affiché sur l'arête physique `edge` (0=haut,1=droite,2=bas,3=gauche)
 *  d'une carte tournée de `rotation` degrés (0/90/180/270). */
export function wordAtPhysicalEdge(card: CardWords, rotation: number, edge: number): string {
  const r = mod4(Math.round(rotation / 90))
  return card[SLOT_KEYS[mod4(edge - r)]]
}

/** Les 4 paires de mots extérieurs (= ce que chaque indice doit relier),
 *  pour des cartes déjà placées : byPosition[pos] = { rotation, words }. */
export function exteriorPairs(
  byPosition: Record<number, { rotation: number; words: CardWords }>,
): { top: [string, string]; right: [string, string]; bottom: [string, string]; left: [string, string] } {
  const at = (pos: number, edge: number) =>
    wordAtPhysicalEdge(byPosition[pos].words, byPosition[pos].rotation, edge)
  return {
    top: [at(0, 0), at(1, 0)],
    right: [at(1, 1), at(3, 1)],
    bottom: [at(2, 2), at(3, 2)],
    left: [at(0, 3), at(2, 3)],
  }
}

// ── Encodage d'un arrangement choisi par le LLM ──────────────────────────────
// Le LLM raisonne uniquement en sémantique : pour chaque coin, quelle carte, et
// quels 2 mots exposer (un vers le bord horizontal haut/bas, un vers le bord
// vertical gauche/droite). Comme on COMPOSE les cartes, le harness fixe l'ordre
// interne des mots ET une rotation aléatoire (puzzle non trivial), de façon
// TOUJOURS réalisable.

export type CornerKey = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right'

export type CornerInput = {
  words: string[] // les 4 mots de la carte (en vrac)
  exposeHorizontal: string // mot exposé vers le bord haut/bas
  exposeVertical: string // mot exposé vers le bord gauche/droite
}

export type Arrangement = Record<CornerKey, CornerInput>

export type EncodedCard = { position: number; rotation: number; words: CardWords }

export type EncodedGrid = {
  cards: EncodedCard[] // ordre TL, TR, BL, BR (= positions 0,1,2,3)
  clues: { top: [string, string]; right: [string, string]; bottom: [string, string]; left: [string, string] }
}

// Arêtes extérieures (horizontale, verticale) selon la position du coin.
const CORNERS: { key: CornerKey; position: number; hEdge: number; vEdge: number }[] = [
  { key: 'top_left', position: 0, hEdge: 0, vEdge: 3 }, // haut, gauche
  { key: 'top_right', position: 1, hEdge: 0, vEdge: 1 }, // haut, droite
  { key: 'bottom_left', position: 2, hEdge: 2, vEdge: 3 }, // bas, gauche
  { key: 'bottom_right', position: 3, hEdge: 2, vEdge: 1 }, // bas, droite
]

function encodeCard(
  input: CornerInput,
  position: number,
  hEdge: number,
  vEdge: number,
  rng: () => number,
): EncodedCard {
  if (!Array.isArray(input.words) || input.words.length !== 4) throw new Error('card needs 4 words')
  if (!input.words.includes(input.exposeHorizontal)) throw new Error('exposeHorizontal not in card')
  if (!input.words.includes(input.exposeVertical)) throw new Error('exposeVertical not in card')
  if (input.exposeHorizontal === input.exposeVertical) throw new Error('exposed words must differ')

  const r = Math.floor(rng() * 4) // quart de tour 0..3
  const slots: (string | null)[] = [null, null, null, null]
  slots[mod4(hEdge - r)] = input.exposeHorizontal
  slots[mod4(vEdge - r)] = input.exposeVertical
  const hidden = input.words.filter((w) => w !== input.exposeHorizontal && w !== input.exposeVertical)
  let hi = 0
  for (let s = 0; s < 4; s++) if (slots[s] === null) slots[s] = hidden[hi++]
  return {
    position,
    rotation: r * 90,
    words: { top: slots[0]!, right: slots[1]!, bottom: slots[2]!, left: slots[3]! },
  }
}

/** Encode l'arrangement → cartes composées + placements + paires d'indices.
 *  Lève si l'encodage ne reproduit pas exactement les expositions demandées
 *  (garde-fou anti-régression géométrique). `rng` injectable pour les tests. */
export function encodeArrangement(arr: Arrangement, rng: () => number = Math.random): EncodedGrid {
  const cards = CORNERS.map((c) => encodeCard(arr[c.key], c.position, c.hEdge, c.vEdge, rng))

  const byPosition: Record<number, { rotation: number; words: CardWords }> = {}
  for (const c of cards) byPosition[c.position] = { rotation: c.rotation, words: c.words }
  const pairs = exteriorPairs(byPosition)

  // Assertion round-trip : les mots calculés aux bords doivent valoir les
  // expositions voulues (top=[TL.H,TR.H], left=[TL.V,BL.V], …).
  const want = {
    top: [arr.top_left.exposeHorizontal, arr.top_right.exposeHorizontal],
    bottom: [arr.bottom_left.exposeHorizontal, arr.bottom_right.exposeHorizontal],
    left: [arr.top_left.exposeVertical, arr.bottom_left.exposeVertical],
    right: [arr.top_right.exposeVertical, arr.bottom_right.exposeVertical],
  }
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    if (pairs[side][0] !== want[side][0] || pairs[side][1] !== want[side][1]) {
      throw new Error(`geometry mismatch on ${side}: got ${pairs[side]} want ${want[side]}`)
    }
  }

  return { cards, clues: pairs }
}
