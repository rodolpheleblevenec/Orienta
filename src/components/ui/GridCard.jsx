import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'
import { getMarineItem } from '../../lib/marineItems'

const DIFFICULTY_LABEL = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' }
const DIFFICULTY_VALUE_CLASS = { facile: 'pc-v--teal', moyen: 'pc-v--amber', difficile: 'pc-v--coral' }

const AVA_COLORS = [
  'var(--green)',
  'var(--blue)',
  'var(--orange)',
  'var(--coral)',
  'var(--amber)',
  'var(--teal)',
]

function pickAvaColor(str) {
  let h = 0
  for (let i = 0; i < (str?.length ?? 0); i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return AVA_COLORS[Math.abs(h) % AVA_COLORS.length]
}

export default function GridCard({ grid, playInfo, index, isDaily = false, isOwnGrid = false }) {
  const { user } = useAuthStore()
  const completed = playInfo?.completed === true
  // Grille du jour déjà terminée → dashboard de stats (la solution n'y est
  // révélée qu'aux finishers). Sinon : écran de jeu.
  const linkTo = (isOwnGrid || (isDaily && completed))
    ? `/dashboard/${grid.id}`
    : `/play/${grid.id}`

  const plays = (grid.orienta_plays ?? []).filter(p => p.success !== null)
  const totalPlays = plays.length
  const successPlays = plays.filter(p => p.success).length
  const successRate = totalPlays > 0 ? Math.round((successPlays / totalPlays) * 100) : 0

  const creatorPseudo = grid.orienta_users?.pseudo ?? 'Inconnu'
  const creatorSkin = grid.orienta_users?.selected_skin ?? 1
  const creatorAvatar = creatorSkin > 1
    ? getMarineItem(creatorSkin).name.split(' ')[0]
    : creatorPseudo[0]?.toUpperCase() ?? '?'

  const inProgress = playInfo && !playInfo.completed

  // Sur ses propres grilles, le statut de jeu n'a pas de sens (on n'y joue jamais) :
  // on affiche l'état de publication plutôt qu'un « Non joué » incohérent.
  const statusLabel = isOwnGrid
    ? 'Publiée'
    : completed ? 'Terminé' : inProgress ? 'En cours' : 'Non joué'
  const avaColor = isDaily ? 'var(--teal)' : pickAvaColor(creatorPseudo)

  const ctaLabel = isOwnGrid
    ? 'Gérer ma grille'
    : isDaily && completed
      ? 'Voir les statistiques'
      : isDaily
        ? 'Jouer le défi'
        : inProgress
          ? 'Reprendre la grille'
          : 'Jouer la grille'

  return (
    <motion.article
      className="pcard"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link to={linkTo} className="pcard-link">
        <div className="pc-top">
          <div className="pc-ava" style={{ background: avaColor }}>
            {isDaily ? '★' : creatorAvatar}
          </div>
          <div className="pc-name">
            {isDaily ? 'Grille du jour' : creatorPseudo}
            <small>{isOwnGrid ? 'Ma grille' : isDaily ? 'Challenge' : 'Joueur'}</small>
          </div>
          {!isDaily && (grid.upvotes_count ?? 0) > 0 && (
            <span className="pc-upvotes">
              👍 {grid.upvotes_count}
              <span className="pc-upvotes-tip" role="tooltip">
                Cette grille a été recommandée par {grid.upvotes_count} joueur{grid.upvotes_count > 1 ? 's' : ''}
              </span>
            </span>
          )}
        </div>
        <div className="pc-grid">
          <div className="pc-cell">
            <div className="pc-k">Statut</div>
            <div className="pc-v">
              <span className={`pc-badge${isOwnGrid ? ' pc-badge--published' : completed ? ' pc-badge--done' : inProgress ? ' pc-badge--progress' : ''}`}>
                {statusLabel}
              </span>
            </div>
          </div>
          <div className="pc-cell">
            <div className="pc-k">Niveau</div>
            <div className={`pc-v ${DIFFICULTY_VALUE_CLASS[grid.difficulty] ?? 'pc-v--teal'}`}>
              {DIFFICULTY_LABEL[grid.difficulty] ?? '—'}
            </div>
          </div>
          <div className="pc-cell">
            <div className="pc-k">Joueurs</div>
            <div className="pc-v">{totalPlays}</div>
          </div>
          <div className="pc-cell">
            <div className="pc-k">Réussite</div>
            <div className="pc-v">{totalPlays > 0 ? `${successRate}%` : '—'}</div>
          </div>
        </div>
        <div className="pc-cta">
          <span className="pc-cta-label">{ctaLabel}</span>
          <svg className="pc-cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
          </svg>
        </div>
      </Link>
    </motion.article>
  )
}
