import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'

const LEVELS = [
  { level: 1,  xp: 0,     name: 'Naissance',   mascot: '🥚' },
  { level: 2,  xp: 500,   name: 'Alevin',       mascot: '🐟' },
  { level: 3,  xp: 1500,  name: 'Banc',         mascot: '🐠' },
  { level: 4,  xp: 3500,  name: 'Explorateur',  mascot: '🤿' },
  { level: 5,  xp: 7000,  name: 'Voyageur',     mascot: '🐡' },
  { level: 6,  xp: 12000, name: 'Chasseur',     mascot: '🦈' },
  { level: 7,  xp: 20000, name: 'Sage',         mascot: '🐢' },
  { level: 8,  xp: 35000, name: 'Légende',      mascot: '🐋' },
  { level: 9,  xp: 55000, name: 'Titan',        mascot: '🐳' },
  { level: 10, xp: 80000, name: 'Immortel',     mascot: '🐉' },
]

export default function CollectiveGauge() {
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    supabase
      .from('orienta_collective_progress')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => data && setProgress(data))
  }, [])

  if (!progress) return null

  const currentLevel = LEVELS.find(l => l.level === progress.level) ?? LEVELS[0]
  const nextLevel = LEVELS[progress.level] ?? null
  const xpInLevel = progress.total_xp - currentLevel.xp
  const xpForNext = nextLevel ? nextLevel.xp - currentLevel.xp : 1
  const pct = nextLevel ? Math.min((xpInLevel / xpForNext) * 100, 100) : 100

  return (
    <div className="collective-gauge">
      <div className="gauge-header">
        <span className="gauge-mascot">{currentLevel.mascot}</span>
        <div className="gauge-info">
          <span className="gauge-level">Niveau {currentLevel.level} — {currentLevel.name}</span>
          <span className="gauge-xp">{progress.total_xp.toLocaleString()} XP collectifs</span>
        </div>
      </div>
      <div className="gauge-bar-track">
        <motion.div
          className="gauge-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      {nextLevel && (
        <div className="gauge-next">
          {nextLevel.mascot} {nextLevel.name} dans {(nextLevel.xp - progress.total_xp).toLocaleString()} XP
        </div>
      )}
    </div>
  )
}
