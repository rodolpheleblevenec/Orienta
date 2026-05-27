const BASE_SCORE = 1000
const ATTEMPT_PENALTY = 150
const SPEED_BONUS = 100
const SPEED_THRESHOLD_SECONDS = 60

// Logarithmic time decay: score never drops below ~200 during normal play
export function computeScore(elapsedSeconds, attemptsFailed) {
  const timeDecay = Math.max(0, BASE_SCORE * (1 - 0.35 * Math.log10(1 + elapsedSeconds / 30)))
  const attemptPenalty = attemptsFailed * ATTEMPT_PENALTY
  const speedBonus = (elapsedSeconds < SPEED_THRESHOLD_SECONDS && attemptsFailed === 0) ? SPEED_BONUS : 0
  return Math.max(0, Math.round(timeDecay - attemptPenalty + speedBonus))
}

export function computeXp(score, success) {
  if (!success) return Math.round(score * 0.1)
  return Math.round(score * 0.5)
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
    if (!s) { neither++; continue }

    const posMatch = a.position === s.position
    const rotMatch = a.rotation === s.rotation

    if (posMatch && rotMatch) correctFull++
    else if (rotMatch && !posMatch) correctRotation++
    else neither++
  }

  return { correctFull, correctRotation, neither }
}
