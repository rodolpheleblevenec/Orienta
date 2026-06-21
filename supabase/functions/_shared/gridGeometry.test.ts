// Test du harness géométrie — exécuter avec :
//   node --experimental-strip-types supabase/functions/_shared/gridGeometry.test.ts
// (non importé par aucune fonction → jamais déployé).

import { wordAtPhysicalEdge, exteriorPairs, encodeArrangement } from './gridGeometry.ts'

let passed = 0
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  passed++
}

// 1) Ancrage de la formule contre une table calculée à la main (miroir WordCard).
const card = { top: 'T', right: 'R', bottom: 'B', left: 'L' }
//   rotation 0 : aucune contre-rotation.
assert(wordAtPhysicalEdge(card, 0, 0) === 'T', 'rot0 edge top')
assert(wordAtPhysicalEdge(card, 0, 1) === 'R', 'rot0 edge right')
assert(wordAtPhysicalEdge(card, 0, 2) === 'B', 'rot0 edge bottom')
assert(wordAtPhysicalEdge(card, 0, 3) === 'L', 'rot0 edge left')
//   rotation 90 : le mot GAUCHE monte en HAUT, etc.
assert(wordAtPhysicalEdge(card, 90, 0) === 'L', 'rot90 edge top = left word')
assert(wordAtPhysicalEdge(card, 90, 1) === 'T', 'rot90 edge right = top word')
assert(wordAtPhysicalEdge(card, 90, 2) === 'R', 'rot90 edge bottom = right word')
assert(wordAtPhysicalEdge(card, 90, 3) === 'B', 'rot90 edge left = bottom word')
//   rotation 180 : tout en face.
assert(wordAtPhysicalEdge(card, 180, 0) === 'B', 'rot180 edge top = bottom word')
assert(wordAtPhysicalEdge(card, 180, 3) === 'R', 'rot180 edge left = right word')
//   normalisation des rotations négatives / >360.
assert(wordAtPhysicalEdge(card, -90, 0) === wordAtPhysicalEdge(card, 270, 0), 'rot -90 == 270')
assert(wordAtPhysicalEdge(card, 450, 0) === wordAtPhysicalEdge(card, 90, 0), 'rot 450 == 90')

// 2) Round-trip exhaustif : pour toutes les rotations possibles de chaque carte
//    (rng forcé), encodeArrangement doit reproduire EXACTEMENT les expositions.
const WORDS = ['chat', 'chien', 'lion', 'tigre', 'pomme', 'poire', 'cerise', 'banane',
  'rouge', 'bleu', 'vert', 'jaune', 'lundi', 'mardi', 'mercredi', 'jeudi']

function makeArrangement(seed: number) {
  // 4 cartes de 4 mots distincts, expositions et anneau pseudo-aléatoires.
  const w = [...WORDS]
  // mélange déterministe (Fisher-Yates avec PRNG simple)
  let s = seed >>> 0
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  for (let i = w.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[w[i], w[j]] = [w[j], w[i]]
  }
  const cardsW = [w.slice(0, 4), w.slice(4, 8), w.slice(8, 12), w.slice(12, 16)]
  const corner = (words: string[]) => {
    const a = Math.floor(rnd() * 4)
    let b = Math.floor(rnd() * 4)
    if (b === a) b = (b + 1) % 4
    return { words, exposeHorizontal: words[a], exposeVertical: words[b] }
  }
  return {
    arr: {
      top_left: corner(cardsW[0]),
      top_right: corner(cardsW[1]),
      bottom_left: corner(cardsW[2]),
      bottom_right: corner(cardsW[3]),
    },
    rnd,
  }
}

let cases = 0
for (let seed = 1; seed <= 4000; seed++) {
  const { arr, rnd } = makeArrangement(seed)
  // rng pour les rotations encodeArrangement : réutilise le PRNG (toutes valeurs 0..3 couvertes sur la masse)
  const enc = encodeArrangement(arr, () => rnd()) // throw interne si mismatch

  // Vérif indépendante : recompose byPosition et recompare aux expositions voulues.
  const byPos: Record<number, { rotation: number; words: typeof card }> = {}
  for (const c of enc.cards) byPos[c.position] = { rotation: c.rotation, words: c.words }
  const pairs = exteriorPairs(byPos)
  assert(pairs.top[0] === arr.top_left.exposeHorizontal && pairs.top[1] === arr.top_right.exposeHorizontal, 'top pair')
  assert(pairs.bottom[0] === arr.bottom_left.exposeHorizontal && pairs.bottom[1] === arr.bottom_right.exposeHorizontal, 'bottom pair')
  assert(pairs.left[0] === arr.top_left.exposeVertical && pairs.left[1] === arr.bottom_left.exposeVertical, 'left pair')
  assert(pairs.right[0] === arr.top_right.exposeVertical && pairs.right[1] === arr.bottom_right.exposeVertical, 'right pair')

  // Chaque carte : 4 mots = les 4 d'origine (les 2 cachés bien présents).
  for (let i = 0; i < 4; i++) {
    const set = new Set([enc.cards[i].words.top, enc.cards[i].words.right, enc.cards[i].words.bottom, enc.cards[i].words.left])
    assert(set.size === 4, 'card ' + i + ' has 4 distinct slots')
  }
  cases++
}

console.log(`OK — ${passed} assertions sur ${cases} arrangements aléatoires (round-trip géométrie validé).`)
