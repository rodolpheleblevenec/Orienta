import { useNavigate } from 'react-router-dom'
import { CARD_COLORS } from '../../lib/cardColors'
import { getMarineItem } from '../../lib/marineItems'
import { isRaidLaunched } from '../../lib/raid'
import { sendRaidInvite } from '../../lib/useOnlinePlayers'
import AvatarFrame from './AvatarFrame'

// Couleur d'avatar déterministe à partir de l'id : un même joueur garde
// toujours la même couleur, sans avoir à la stocker en base.
function avatarColor(id) {
  let h = 0
  for (let i = 0; i < (id?.length ?? 0); i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CARD_COLORS[h % CARD_COLORS.length].text
}

// Ligne « joueur en ligne » : avatar du perso (skin) + cadre + pseudo coloré +
// statut. Réutilisée par le panneau desktop ET la liste du burger mobile.
export function OnlinePlayerItem({ player, isMe }) {
  const skin = player.selected_skin ?? 1
  const emoji = skin > 1 ? getMarineItem(skin).name.split(' ')[0] : null
  return (
    <li className="hub-online-item">
      <AvatarFrame frame={player.equipped_frame}>
        <span
          className={`hub-online-ava${emoji ? ' hub-online-ava--emoji' : ''}`}
          style={emoji ? undefined : { background: avatarColor(player.id) }}
        >
          {emoji ?? (player.pseudo?.[0]?.toUpperCase() ?? '?')}
        </span>
      </AvatarFrame>
      <span className="hub-online-meta">
        <span
          className="hub-online-name"
          style={player.equipped_color ? { color: player.equipped_color } : undefined}
        >
          {player.pseudo ?? 'Joueur'}
        </span>
        {player.status_text && <span className="hub-online-status">{player.status_text}</span>}
      </span>
      {isMe && <span className="hub-online-me">toi</span>}
    </li>
  )
}

// Panneau « joueurs en ligne » — desktop uniquement (la colonne qui le contient
// est masquée en CSS sous 1280px ; sur mobile, la liste passe dans le burger).
// La colonne sticky (`hub-online-aside`) est désormais montée par le hub, qui y
// empile aussi le fil « Ça papote ».
//
// C'est la VITRINE sociale : les cosmétiques achetés (avatar du perso, cadre,
// couleur de pseudo, statut perso) ne s'affichent QUE ici — vus par tout le monde.
export default function OnlinePlayersPanel({ players, currentUserId }) {
  const navigate = useNavigate()
  const others = players.filter(p => p.id !== currentUserId).length

  // « Jouez ensemble » : invite tous les connectés (broadcast temps réel) puis me
  // téléporte dans le SAS public — où les invités qui acceptent me rejoignent.
  function playTogether() {
    const me = players.find(p => p.id === currentUserId)
    sendRaidInvite({ id: currentUserId, pseudo: me?.pseudo })
    navigate('/raid')
  }

  return (
    <section className="hub-online-panel" aria-label="Joueurs en ligne">
      <div className="hub-online-head">
        <span className="hub-online-title">
          <span className="hub-ldot" />
          En ligne
        </span>
        <span className="hub-online-count">{players.length}</span>
      </div>

      <ul className="hub-online-list">
        {players.map(p => (
          <OnlinePlayerItem key={p.id} player={p} isMe={p.id === currentUserId} />
        ))}
      </ul>

      {isRaidLaunched()
        ? (
          <button type="button" className="hub-online-foot hub-online-foot--cta" onClick={playTogether}>
            ⚔️ Jouez ensemble : rejoignez un RAID
            {others > 0 && (
              <span className="hub-online-foot-sub">Invite les joueurs en ligne</span>
            )}
          </button>
        )
        : <p className="hub-online-foot">Bientôt : jouez ensemble en temps réel.</p>}
    </section>
  )
}
