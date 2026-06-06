import { CARD_COLORS } from '../../lib/cardColors'

// Couleur d'avatar déterministe à partir de l'id : un même joueur garde
// toujours la même couleur, sans avoir à la stocker en base.
function avatarColor(id) {
  let h = 0
  for (let i = 0; i < (id?.length ?? 0); i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CARD_COLORS[h % CARD_COLORS.length].text
}

// Panneau latéral « joueurs en ligne » — desktop uniquement (masqué en CSS sous
// 1280px). N'est monté par le hub que lorsqu'au moins un autre joueur est connecté.
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
          {players.map(p => (
            <li key={p.id} className="hub-online-item">
              <span className="hub-online-ava" style={{ background: avatarColor(p.id) }}>
                {p.pseudo?.[0]?.toUpperCase() ?? '?'}
              </span>
              <span className="hub-online-name">{p.pseudo ?? 'Joueur'}</span>
              {p.id === currentUserId && <span className="hub-online-me">toi</span>}
            </li>
          ))}
        </ul>

        <p className="hub-online-foot">Bientôt : jouez ensemble en temps réel.</p>
      </div>
    </aside>
  )
}
