const BASE_SCORE = 1000
const ATTEMPT_PENALTY = 150
const SPEED_BONUS = 100
const SPEED_THRESHOLD_SECONDS = 60

// XP awards per grid resolution
export const XP_RESOLVE = 25  // joueur qui résout une grille
export const XP_CREATE_BASE = 15  // créateur quand quelqu'un joue sa grille
export const XP_CREATE_BONUS = 30  // créateur bonus quand quelqu'un réussit sa grille
export const xpStreakBonus = (streak) => Math.min(streak * 2, 30)

// Bonus de rapidité : récompense une résolution avant le 3e essai.
export const XP_FIRST_TRY = 6  // résolu du premier essai
export const XP_SECOND_TRY = 3 // résolu au deuxième essai
export function xpAttemptBonus(attemptNo, success) {
  if (!success) return 0
  if (attemptNo === 1) return XP_FIRST_TRY
  if (attemptNo === 2) return XP_SECOND_TRY
  return 0
}

// Logarithmic time decay: score never drops below ~200 during normal play
export function computeScore(elapsedSeconds, attemptsFailed) {
  const timeDecay = Math.max(0, BASE_SCORE * (1 - 0.35 * Math.log10(1 + elapsedSeconds / 30)))
  const attemptPenalty = attemptsFailed * ATTEMPT_PENALTY
  const speedBonus = (elapsedSeconds < SPEED_THRESHOLD_SECONDS && attemptsFailed === 0) ? SPEED_BONUS : 0
  return Math.max(0, Math.round(timeDecay - attemptPenalty + speedBonus))
}

export function computeXp(score, success) {
  if (!success) return 0  // joueur qui échoue gagne 0 XP
  return XP_RESOLVE  // joueur qui réussit gagne 25 XP
}

// Compare player answer vs solution
// answer: [{ card_id, position, rotation }, ...]
// solution: [{ card_id, position, rotation }, ...]
export function evaluateAttempt(answer, solution) {
  let correctFull = 0
  let correctRotation = 0
  let neither = 0

  const solutionMap = {}
  for (const s of solution) {
    solutionMap[s.card_id] = s
  }

  for (const a of answer) {
    const s = solutionMap[a.card_id]
    // Carte leurre (position -1) ou inconnue : toujours "à revoir" (cf. scoring.ts).
    if (!s || s.position === -1) { neither++; continue }

    const posMatch = a.position === s.position
    const rotMatch = a.rotation === s.rotation

    if (posMatch && rotMatch) correctFull++
    else if (posMatch || rotMatch) correctRotation++
    else neither++
  }

  return { correctFull, correctRotation, neither }
}
