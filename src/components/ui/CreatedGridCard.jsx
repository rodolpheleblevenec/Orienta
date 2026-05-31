import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'

const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M12 6v6l4 2"></path>
  </svg>
)

const IconStar = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="12 2 15.09 10.26 24 10.35 17.77 16.01 20.16 24.02 12 18.35 3.84 24.02 6.23 16.01 0 10.35 8.91 10.26"></polygon>
  </svg>
)

const IconPeople = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
)

const IconChart = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
)

const ChevronIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
)

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
    : 0

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
      className="created-grid-card-wrap"
    >
      <Link to={`/dashboard/${grid.id}`} className="card-v2">
        <div className="card-v2-header" style={{ backgroundColor: '#287162' }}>
          <div className="card-v2-name">Ma Grille</div>
          <div className="card-v2-icon">
            <ChevronIcon />
          </div>
        </div>
        <div className="card-v2-body">
          <div className="card-v2-cell">
            <div className="card-v2-cell-label">
              <IconClock />
              Essais moyens
            </div>
            <div className="card-v2-cell-value">{avgAttempts}</div>
          </div>
          <div className="card-v2-cell">
            <div className="card-v2-cell-label">
              <IconStar />
              Niveau
            </div>
            <div className="card-v2-cell-value">{DIFFICULTY_LABEL[grid.difficulty] || '-'}</div>
          </div>
          <div className="card-v2-cell">
            <div className="card-v2-cell-label">
              <IconPeople />
              Joueurs
            </div>
            <div className="card-v2-cell-value">{totalPlays}</div>
          </div>
          <div className="card-v2-cell">
            <div className="card-v2-cell-label">
              <IconChart />
              Réussi
            </div>
            <div className="card-v2-cell-value">{successRate}%</div>
          </div>
        </div>
      </Link>
      <button className="created-grid-share-btn" onClick={copyShareLink} type="button">
        {copied ? '✓ Lien copié !' : '🍀 Partager ma grille'}
      </button>
    </motion.div>
  )
}
