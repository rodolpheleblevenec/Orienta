import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function GridCard({ grid, played, index }) {
  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr)) / 1000
    if (diff < 60) return 'À l\'instant'
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
    return `Il y a ${Math.floor(diff / 86400)} j`
  }

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
          {played && <span className="grid-card-badge">✓ Joué</span>}
        </div>
        <div className="grid-card-meta">
          <span>{timeAgo(grid.created_at)}</span>
        </div>
      </Link>
    </motion.div>
  )
}
