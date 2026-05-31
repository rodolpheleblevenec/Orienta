import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'
import { getMarineItem, MARINE_ITEMS } from '../../lib/marineItems'

const DIFFICULTY_LABEL = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' }
const DIFFICULTY_CLASS = { facile: 'card-v2-difficulty--easy', moyen: 'card-v2-difficulty--medium', difficile: 'card-v2-difficulty--hard' }

const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
)

const IconCheckmark = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
)

const IconPlay = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
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

export default function GridCard({ grid, playInfo, index, isDaily = false, isOwnGrid = false }) {
  const { user } = useAuthStore()
  const linkTo = isOwnGrid ? `/dashboard/${grid.id}` : `/play/${grid.id}`

  const plays = (grid.orienta_plays ?? []).filter(p => p.success !== null)
  const totalPlays = plays.length
  const successPlays = plays.filter(p => p.success).length
  const successRate = totalPlays > 0 ? Math.round((successPlays / totalPlays) * 100) : 0

  const creatorInitial = grid.orienta_users?.pseudo?.[0]?.toUpperCase() ?? '?'
  const creatorSkin = grid.orienta_users?.selected_skin ?? 1
  const creatorAvatar = creatorSkin > 1 ? getMarineItem(creatorSkin).name.split(' ')[0] : creatorInitial

  const inProgress = playInfo && !playInfo.completed
  const completed = playInfo?.completed === true

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link to={linkTo} className="card-v2">
        <div className="card-v2-header" style={{ backgroundColor: isDaily ? '#6C63FF' : '#33B69A' }}>
          <div className="card-v2-avatar">
            {isDaily ? '★' : creatorAvatar}
          </div>
          <div className="card-v2-name">{isDaily ? 'Grille du jour' : (grid.orienta_users?.pseudo ?? 'Inconnu')}</div>
          <div className="card-v2-icon">
            <ChevronIcon />
          </div>
        </div>
        <div className="card-v2-body">
          <div className="card-v2-cell">
            <div className="card-v2-cell-label">
              {completed ? <IconCheckmark /> : inProgress ? <IconPlay /> : <IconClock />}
              Statut
            </div>
            <div className={`card-v2-cell-value${inProgress ? ' card-v2-status--inprogress' : completed ? ' card-v2-status--done' : ''}`}>
              {completed ? 'Joué' : inProgress ? (playInfo.attemptsCount > 0 ? `${playInfo.attemptsCount} essai${playInfo.attemptsCount > 1 ? 's' : ''}` : 'En cours') : 'Non joué'}
            </div>
          </div>
          <div className="card-v2-cell">
            <div className="card-v2-cell-label">
              <IconStar />
              Niveau
            </div>
            <div className={`card-v2-cell-value${DIFFICULTY_CLASS[grid.difficulty] ? ` ${DIFFICULTY_CLASS[grid.difficulty]}` : ''}`}>{DIFFICULTY_LABEL[grid.difficulty] || '-'}</div>
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
    </motion.div>
  )
}
