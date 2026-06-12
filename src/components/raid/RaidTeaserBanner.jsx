import { Link } from 'react-router-dom'
import { useCountdown } from '../../lib/useCountdown'
import { RAID_LAUNCH_AT } from '../../lib/raid'

const pad = (n) => String(n).padStart(2, '0')

// Bannière de pré-annonce du mode RAID, affichée en tête du hub.
// Légère (pas de 3D ici) : la vraie scène 3D est sur la page /le-raid.
export default function RaidTeaserBanner() {
  const { days, hours, minutes, seconds, done } = useCountdown(RAID_LAUNCH_AT)

  const cells = [
    ['J', days],
    ['H', hours],
    ['M', minutes],
    ['S', seconds],
  ]

  return (
    <Link to="/le-raid" className="raid-teaser-banner">
      <span className="raid-teaser-banner-glow" aria-hidden="true" />

      <div className="raid-teaser-banner-main">
        <div className="raid-teaser-banner-head">
          <span className="raid-teaser-badge">⚔️ Nouveau mode · Bientôt</span>
          <span className="raid-teaser-chip3d">✦ Animé en 3D</span>
        </div>
        <h2 className="raid-teaser-banner-title">Le RAID arrive</h2>
        <p className="raid-teaser-banner-sub">
          Affrontez le monstre. À plusieurs. En temps réel.
        </p>
      </div>

      <div className="raid-teaser-banner-aside">
        {done ? (
          <span className="raid-teaser-live">🔓 Disponible maintenant</span>
        ) : (
          <div className="raid-teaser-count" aria-label="Temps restant avant l'ouverture">
            {cells.map(([u, v]) => (
              <span key={u} className="raid-teaser-count-cell">
                <span className="raid-teaser-count-num">{pad(v)}</span>
                <span className="raid-teaser-count-unit">{u}</span>
              </span>
            ))}
          </div>
        )}
        <span className="raid-teaser-banner-cta">{done ? 'Découvrir →' : 'Découvrir le mode →'}</span>
        <span className="raid-teaser-banner-when">Débloqué lun. 15 juin · 8h</span>
      </div>
    </Link>
  )
}
