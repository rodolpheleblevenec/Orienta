import { useNavigate } from 'react-router-dom'
import { CARD_COLORS } from '../../lib/cardColors'
import { getMarineItem } from '../../lib/marineItems'
import AvatarFrame from './AvatarFrame'

// Couleur d'avatar déterministe à partir de l'id du joueur (même logique que le
// panneau « En ligne » → un joueur garde la même couleur partout).
function avatarColor(id) {
  let h = 0
  for (let i = 0; i < (id?.length ?? 0); i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CARD_COLORS[h % CARD_COLORS.length].text
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'à l\'instant'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  return `il y a ${Math.floor(diff / 86400)}j`
}

// Fil « Ça papote » — affiché sous la bulle des joueurs en ligne (desktop only,
// la colonne entière est masquée < 1280px). Montre les derniers commentaires
// laissés sur les grilles.
//
// Accès rapide au clic : on scrolle jusqu'à la carte de la grille et on la met
// en surbrillance. Si elle n'est pas à l'écran (filtre de tri, repli « Voir plus »,
// grille du jour…), on bascule sur la navigation directe vers la grille.
export default function HubCommentFeed({ comments }) {
  const navigate = useNavigate()

  function jumpToGrid(gridId) {
    const el = document.querySelector(`[data-grid-id="${gridId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.remove('hub-jump-flash')
      void el.offsetWidth // reflow → rejoue l'animation si on reclique la même carte
      el.classList.add('hub-jump-flash')
      window.setTimeout(() => el.classList.remove('hub-jump-flash'), 1800)
    } else {
      navigate(`/play/${gridId}`)
    }
  }

  return (
    <section className="hub-feed-panel" aria-label="Derniers commentaires">
      <div className="hub-feed-head">
        <span className="hub-feed-title">💬 Ça papote</span>
      </div>
      <ul className="hub-feed-list">
        {comments.map((c) => {
          const skin = c.selected_skin ?? 1
          const emoji = skin > 1 ? getMarineItem(skin).name.split(' ')[0] : null
          const gridName = c.grid_title
            ? `« ${c.grid_title} »`
            : c.grid_creator ? `la grille de ${c.grid_creator}` : 'une grille'
          return (
            <li key={c.id}>
              <button type="button" className="hub-feed-item" onClick={() => jumpToGrid(c.grid_id)}>
                <AvatarFrame frame={c.equipped_frame}>
                  <span
                    className={`hub-online-ava${emoji ? ' hub-online-ava--emoji' : ''}`}
                    style={emoji ? undefined : { background: avatarColor(c.player_id) }}
                  >
                    {emoji ?? (c.pseudo?.[0]?.toUpperCase() ?? '?')}
                  </span>
                </AvatarFrame>
                <span className="hub-feed-body">
                  <span className="hub-feed-line1">
                    <span
                      className="hub-feed-name"
                      style={c.equipped_color ? { color: c.equipped_color } : undefined}
                    >
                      {c.pseudo}
                    </span>
                    <span className="hub-feed-time">{timeAgo(c.at)}</span>
                  </span>
                  <span className="hub-feed-text">« {c.comment} »</span>
                  <span className="hub-feed-grid">
                    <span className="hub-feed-grid-name">
                      {c.success === false ? '💔' : '🎯'} sur {gridName}
                    </span>
                    <span className="hub-feed-jump">Voir →</span>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
