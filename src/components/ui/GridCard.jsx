import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'

const DIFFICULTY_LABEL = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' }
const DIFFICULTY_COLOR = { facile: 'var(--accent)', moyen: 'var(--warning)', difficile: 'var(--coral)' }

export default function GridCard({ grid, played, index }) {
  const { user } = useAuthStore()

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr)) / 1000
    if (diff < 60) return 'À l\'instant'
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
    return `Il y a ${Math.floor(diff / 86400)} j`
  }

  const plays = grid.orienta_plays ?? []
  const totalPlays = plays.length
  const successPlays = plays.filter(p => p.success).length
  const successRate = totalPlays > 0 ? Math.round((successPlays / totalPlays) * 100) : null
  const myPlay = plays.find(p => p.player_id === user?.id)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link to={`/play/${grid.id}`} className={`grid-card ${played ? 'grid-card--played' : ''}`}>
        <div className="grid-card-header">
          <div className="grid-card-creator">
            <span className="creator-avatar">
              {grid.orienta_users?.pseudo?.[0]?.toUpperCase() ?? '?'}
            </span>
            <span className="creator-name">{grid.orienta_users?.pseudo ?? 'Inconnu'}</span>
          </div>
          <div className="grid-card-badges">
            {grid.difficulty && (
              <span className="grid-card-badge" style={{ color: DIFFICULTY_COLOR[grid.difficulty], borderColor: DIFFICULTY_COLOR[grid.difficulty], background: `${DIFFICULTY_COLOR[grid.difficulty]}15` }}>
                {DIFFICULTY_LABEL[grid.difficulty]}
              </span>
            )}
            {played && <span className="grid-card-badge grid-card-badge--played">✓ Joué</span>}
          </div>
        </div>
        <div className="grid-card-footer">
          <span className="grid-card-time">{timeAgo(grid.created_at)}</span>
          {totalPlays > 0 && (
            <span className="grid-card-stats">
              {totalPlays} joueur{totalPlays > 1 ? 's' : ''} · {successRate}% réussi
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
