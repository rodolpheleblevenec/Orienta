import AvatarFrame from './AvatarFrame'
import { getMarineItem } from '../../lib/marineItems'

// Avatar de classement : emoji du perso (skin) sinon initiale, enveloppé du
// cadre (ornement) équipé. Réutilisé par le classement et le classement complet.
export default function RankAvatar({ player, className = 'clsmt-ava' }) {
  const skin = player?.selected_skin ?? 1
  const emoji = skin > 1 ? getMarineItem(skin).name.split(' ')[0] : null
  return (
    <AvatarFrame frame={player?.equipped_frame}>
      <span className={`${className}${emoji ? ` ${className}--emoji` : ''}`}>
        {emoji ?? (player?.pseudo?.[0]?.toUpperCase() ?? '?')}
      </span>
    </AvatarFrame>
  )
}
