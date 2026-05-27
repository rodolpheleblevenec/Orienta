export const LEVELS = [
  { level: 1, xp: 0,     name: 'Naissance',   key: 'oeuf' },
  { level: 2, xp: 500,   name: 'Alevin',      key: 'alevin' },
  { level: 3, xp: 1500,  name: 'Banc',        key: 'banc' },
  { level: 4, xp: 3500,  name: 'Explorateur', key: 'explorateur' },
  { level: 5, xp: 7000,  name: 'Voyageur',    key: 'voyageur' },
  { level: 6, xp: 12000, name: 'Chasseur',    key: 'chasseur' },
  { level: 7, xp: 20000, name: 'Sage',        key: 'sage' },
  { level: 8, xp: 35000, name: 'Légende',     key: 'legende' },
  { level: 9, xp: 55000, name: 'Titan',       key: 'titan' },
  { level: 10, xp: 80000, name: 'Immortel',   key: 'immortel' },
]

export function getLevelFromXp(xp) {
  let currentLevel = LEVELS[0]
  for (const level of LEVELS) {
    if (level.xp <= xp) currentLevel = level
    else break
  }
  return currentLevel
}

export function getNextLevel(level) {
  return LEVELS.find(l => l.level === level + 1) ?? null
}

export function getLevelProgress(xp) {
  const currentLevel = getLevelFromXp(xp)
  const nextLevel = getNextLevel(currentLevel.level)
  const xpInLevel = xp - currentLevel.xp
  const xpForNext = nextLevel ? nextLevel.xp - currentLevel.xp : 1
  const pct = nextLevel ? Math.min((xpInLevel / xpForNext) * 100, 100) : 100
  const xpLeft = nextLevel ? nextLevel.xp - xp : 0

  return { currentLevel, nextLevel, pct, xpLeft, xpInLevel, xpForNext }
}
