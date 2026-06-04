// Logique de scoring — source de vérité côté serveur.
// Miroir de src/lib/scoring.js : toute évolution doit rester synchronisée.

const BASE_SCORE = 1000
const ATTEMPT_PENALTY = 150
const SPEED_BONUS = 100
const SPEED_THRESHOLD_SECONDS = 60

export const XP_RESOLVE = 25 // joueur qui résout une grille
export const xpStreakBonus = (streak: number) => Math.min((streak ?? 0) * 2, 30)

// Décroissance logarithmique : le score ne descend jamais sous ~200 en jeu normal.
export function computeScore(elapsedSeconds: number, attemptsFailed: number): number {
  const timeDecay = Math.max(0, BASE_SCORE * (1 - 0.35 * Math.log10(1 + elapsedSeconds / 30)))
  const attemptPenalty = attemptsFailed * ATTEMPT_PENALTY
  const speedBonus = (elapsedSeconds < SPEED_THRESHOLD_SECONDS && attemptsFailed === 0) ? SPEED_BONUS : 0
  return Math.max(0, Math.round(timeDecay - attemptPenalty + speedBonus))
}

export function computeXp(_score: number, success: boolean): number {
  return success ? XP_RESOLVE : 0
}

type Answer = { card_id: string; position: number; rotation: number }
type Solution = { card_id: string; position: number; rotation: number }

// Compare la réponse du joueur à la solution officielle.
export function evaluateAttempt(answer: Answer[], solution: Solution[]) {
  const solutionMap: Record<string, { position: number; rotation: number }> = {}
  for (const s of solution) solutionMap[s.card_id] = { position: s.position, rotation: s.rotation }

  let correctFull = 0
  let correctRotation = 0
  let neither = 0
  const cardFeedbacks: Record<string, string> = {}

  for (const a of answer) {
    const s = solutionMap[a.card_id]
    if (!s) { neither++; cardFeedbacks[a.card_id] = 'wrong'; continue }
    const posMatch = a.position === s.position
    const rotMatch = a.rotation === s.rotation
    if (posMatch && rotMatch) { correctFull++; cardFeedbacks[a.card_id] = 'correct' }
    else if (posMatch || rotMatch) { correctRotation++; cardFeedbacks[a.card_id] = 'rotation' }
    else { neither++; cardFeedbacks[a.card_id] = 'wrong' }
  }

  return { correctFull, correctRotation, neither, cardFeedbacks }
}
