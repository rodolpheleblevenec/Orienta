import { CARD_COLORS } from '../../lib/cardColors'
import { getMarineItem } from '../../lib/marineItems'
import AvatarFrame from './AvatarFrame'

// Couleur d'avatar déterministe à partir de l'id : un même joueur garde
// toujours la même couleur, sans avoir à la stocker en base.
function avatarColor(id) {
  let h = 0
  for (let i = 0; i < (id?.length ?? 0); i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CARD_COLORS[h % CARD_COLORS.length].text
}

// Panneau latéral « joueurs en ligne » — desktop uniquement (masqué en CSS sous
// 1280px). N'est monté par le hub que lorsqu'au moins un autre joueur est connecté.
//
// C'est la VITRINE sociale : les cosmétiques achetés (avatar du perso, cadre,
// couleur de pseudo, statut perso) ne s'affichent QUE ici — vus par tout le monde.
export default function OnlinePlayersPanel({ players, currentUserId }) {
  return (
    <aside className="hub-online-aside" aria-label="Joueurs en ligne">
      <div className="hub-online-panel">
        <div className="hub-online-head">
          <span className="hub-online-title">
            <span className="hub-ldot" />
            En ligne
          </span>
          <span className="hub-online-count">{players.length}</span>
        </div>

        <ul className="hub-online-list">
          {players.map(p => {
            const skin = p.selected_skin ?? 1
            // Avatar = emoji du perso (skin) si > 1, sinon initiale du pseudo.
            const emoji = skin > 1 ? getMarineItem(skin).name.split(' ')[0] : null
            return (
              <li key={p.id} className="hub-online-item">
                <AvatarFrame frame={p.equipped_frame}>
                  <span
                    className={`hub-online-ava${emoji ? ' hub-online-ava--emoji' : ''}`}
                    style={emoji ? undefined : { background: avatarColor(p.id) }}
                  >
                    {emoji ?? (p.pseudo?.[0]?.toUpperCase() ?? '?')}
                  </span>
                </AvatarFrame>
                <span className="hub-online-meta">
                  <span
                    className="hub-online-name"
                    style={p.equipped_color ? { color: p.equipped_color } : undefined}
                  >
                    {p.pseudo ?? 'Joueur'}
                  </span>
                  {p.status_text && <span className="hub-online-status">{p.status_text}</span>}
                </span>
                {p.id === currentUserId && <span className="hub-online-me">toi</span>}
              </li>
            )
          })}
        </ul>

        <p className="hub-online-foot">Bientôt : jouez ensemble en temps réel.</p>
      </div>
    </aside>
  )
}
