import { Link } from 'react-router-dom'
import { useCountdown } from '../../lib/useCountdown'
import { RAID_LAUNCH_AT } from '../../lib/raid'

const pad = (n) => String(n).padStart(2, '0')

// Bannière du mode RAID en tête du hub.
// • Avant le lancement : teaser + compte à rebours → page /le-raid (présentation, non jouable).
// • Au lancement (compte à rebours à 0) : se transforme en « c'est en ligne, joue »
//   et pointe vers /raid (la page où l'on entre en session).
export default function RaidTeaserBanner() {
  const { days, hours, minutes, seconds, done } = useCountdown(RAID_LAUNCH_AT)

  const cells = [['J', days], ['H', hours], ['M', minutes], ['S', seconds]]

  return (
    <Link to={done ? '/raid' : '/le-raid'} className={`raid-teaser-banner${done ? ' raid-teaser-banner--live' : ''}`}>
      <span className="raid-teaser-banner-glow" aria-hidden="true" />

      <div className="raid-teaser-banner-main">
        <div className="raid-teaser-banner-head">
          <span className="raid-teaser-badge">⚔️ Nouveau mode · {done ? 'En ligne' : 'Bientôt'}</span>
        </div>
        <h2 className="raid-teaser-banner-title">{done ? 'Le RAID est ouvert' : 'Le RAID arrive'}</h2>
        <p className="raid-teaser-banner-sub">
          {done
            ? 'Rejoins un équipage et affronte le boss, maintenant.'
            : 'Affrontez le monstre. À plusieurs. En temps réel.'}
        </p>
      </div>

      <div className="raid-teaser-banner-aside">
        {done ? (
          <span className="raid-teaser-live">🔓 En ligne maintenant</span>
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
        <span className="raid-teaser-banner-cta">{done ? 'Jouer maintenant →' : 'Découvrir le mode →'}</span>
        <span className="raid-teaser-banner-when">{done ? 'Ouvert chaque jour · 8h30 et 12h' : 'Débloqué lun. 15 juin · 8h'}</span>
      </div>
    </Link>
  )
}
