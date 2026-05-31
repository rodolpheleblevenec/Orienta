import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { LEVELS_COLLECTIVE, getLevelProgressCollective } from '../../lib/levels'
import { getCreature } from '../../lib/creatures'
import LevelsModal from './LevelsModal'

export default function CollectiveGauge() {
  const [progress, setProgress] = useState(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    supabase
      .from('orienta_collective_progress')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => data && setProgress(data))
  }, [])

  if (!progress) return null

  const levelProgress = getLevelProgressCollective(progress.total_xp)
  const { currentLevel, nextLevel, pct } = levelProgress
  const creature = getCreature(currentLevel.level)

  return (
    <>
      <div className="collective-gauge" onClick={() => setShowModal(true)}>
        <div className="gauge-header">
          <div className="gauge-mascot">
            <creature.Component size={32} />
          </div>
          <div className="gauge-info">
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>
              Communauté
            </div>
            <span className="gauge-level">Niveau {currentLevel.level} — {currentLevel.name}</span>
            <span className="gauge-xp">{progress.total_xp.toLocaleString()} XP collectifs</span>
          </div>
          <span style={{ fontSize: '18px', marginLeft: 'auto', opacity: 0.6 }}>›</span>
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
            {nextLevel.name} dans {(nextLevel.xp - progress.total_xp).toLocaleString()} XP
          </div>
        )}
      </div>
      {showModal && (
        <LevelsModal
          collectiveLevel={currentLevel.level}
          collectiveXp={progress.total_xp}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
