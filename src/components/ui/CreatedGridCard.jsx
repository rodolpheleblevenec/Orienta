import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'

const DIFFICULTY_LABEL = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' }

export default function CreatedGridCard({ grid, index }) {
  const { user } = useAuthStore()
  const [copied, setCopied] = useState(false)

  const plays = (grid.orienta_plays ?? []).filter(p => p.success !== null)
  const totalPlays = plays.length
  const successPlays = plays.filter(p => p.success).length
  const successRate = totalPlays > 0 ? Math.round((successPlays / totalPlays) * 100) : 0
  const avgAttempts = totalPlays > 0
    ? (plays.reduce((sum, p) => sum + (p.attempts_count ?? 0), 0) / totalPlays).toFixed(1)
    : '—'

  function copyShareLink(e) {
    e.preventDefault()
    const url = `${window.location.origin}/play/${grid.id}`
    const text = `🍀 ${user?.pseudo ?? 'Quelqu\'un'} t'invite à jouer une grille Orienta !\n${url}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="hub-create-block hub-mycreated"
    >
      <div className="hub-mycreated-left">
        <div className="hub-eyebrow" style={{ marginBottom: 8 }}>
          <span className="hub-eyebrow-dot" /> Ma grille
        </div>
        <h3 className="hub-create-title">Ta grille du jour</h3>
        <p className="hub-create-desc">Suis les stats en temps réel et partage-la à ta communauté.</p>
        <div className="hub-stat-row hub-mycreated-stats">
          <div className="hub-spill">
            <span className="hub-spill-k">Joueurs</span>
            <span className="hub-spill-v">{totalPlays}</span>
          </div>
          <div className="hub-spill hub-spill--teal">
            <span className="hub-spill-k">Réussite</span>
            <span className="hub-spill-v">{successRate}%</span>
          </div>
          <div className="hub-spill">
            <span className="hub-spill-k">Essais moy.</span>
            <span className="hub-spill-v">{avgAttempts}</span>
          </div>
          <div className="hub-spill">
            <span className="hub-spill-k">Niveau</span>
            <span className="hub-spill-v">{DIFFICULTY_LABEL[grid.difficulty] || '—'}</span>
          </div>
        </div>
      </div>

      <div className="hub-mycreated-right">
        <Link to={`/dashboard/${grid.id}`} className="hub-btn-create">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Dashboard
        </Link>
        <button className="created-grid-share-btn" onClick={copyShareLink} type="button">
          {copied ? '✓ Lien copié !' : '🍀 Partager'}
        </button>
      </div>
    </motion.div>
  )
}
