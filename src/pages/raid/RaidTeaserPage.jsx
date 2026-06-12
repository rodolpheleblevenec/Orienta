import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import Header from '../../components/ui/Header'
import { useCountdown } from '../../lib/useCountdown'
import { RAID_LAUNCH_AT } from '../../lib/raid'

// Scène 3D lazy-loadée (Three.js hors du bundle principal, comme l'arène).
const RaidMonster3D = lazy(() => import('../../components/raid/RaidMonster3D'))

const pad = (n) => String(n).padStart(2, '0')

// Piliers du mode — on tease le principe sans dévoiler les rôles ni les pièges.
const PILLARS = [
  { emoji: '🤝', title: 'Coopératif', text: 'Un boss qui ne tombe qu’en équipe. Seul, impossible d’en venir à bout.' },
  { emoji: '🎭', title: 'Rôles secrets', text: 'Chacun reçoit un rôle aux pouvoirs uniques. Personne ne maîtrise tout.' },
  { emoji: '🗣️', title: 'Info cachée', text: 'L’un voit, l’autre agit. Il faudra se parler pour s’en sortir.' },
  { emoji: '⏱️', title: 'Temps réel', text: 'Tout se joue en direct, ensemble, contre la montre.' },
]

// Page de pré-annonce du mode RAID — NON jouable. Affiche la scène 3D en
// silhouette, le compte à rebours, et les grandes lignes du mode.
export default function RaidTeaserPage() {
  const { days, hours, minutes, seconds, done } = useCountdown(RAID_LAUNCH_AT)

  const cells = [
    ['Jours', days],
    ['Heures', hours],
    ['Min', minutes],
    ['Sec', seconds],
  ]

  return (
    <div className="raid-teaser-page">
      <Header />
      <main className="raid-teaser-wrap">

        <section className="raid-teaser-hero">
          <div className="raid-teaser-hero-3d">
            <Suspense fallback={<div className="raid-teaser-hero-loading">Les abysses s’éveillent…</div>}>
              <RaidMonster3D teaser crew={[]} />
            </Suspense>
          </div>
          <span className="raid-teaser-hero-veil" aria-hidden="true" />

          <div className="raid-teaser-hero-content">
            <span className="raid-teaser-badge">⚔️ Nouveau mode coopératif</span>
            <h1 className="raid-teaser-hero-title">Le RAID arrive</h1>
            <p className="raid-teaser-hero-tag">
              Un monstre surgit des abysses. Pour le vaincre, il faudra unir
              l’équipage — et chacun jouer son rôle.
            </p>

            {done ? (
              <div className="raid-teaser-open">🔓 Le RAID est ouvert&nbsp;!</div>
            ) : (
              <div className="raid-teaser-bigcount" aria-label="Temps restant avant l'ouverture">
                {cells.map(([u, v]) => (
                  <div key={u} className="raid-teaser-bigcell">
                    <span className="raid-teaser-bignum">{pad(v)}</span>
                    <span className="raid-teaser-bigunit">{u}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="raid-teaser-when">⏳ Ouverture lundi 15 juin à 8h</p>

            {done ? (
              <Link to="/raid" className="raid-teaser-cta">Entrer dans l’arène →</Link>
            ) : (
              <span className="raid-teaser-locked" aria-disabled="true">
                🔒 Pas encore jouable — revenez lundi
              </span>
            )}
          </div>
        </section>

        <section className="raid-teaser-pillars">
          {PILLARS.map((p) => (
            <article key={p.title} className="raid-teaser-pillar">
              <span className="raid-teaser-pillar-emoji">{p.emoji}</span>
              <h3 className="raid-teaser-pillar-title">{p.title}</h3>
              <p className="raid-teaser-pillar-text">{p.text}</p>
            </article>
          ))}
        </section>

        <section className="raid-teaser-tease">
          <p>
            On ne vous en dit pas plus… Préparez votre équipage : les rôles, les
            pouvoirs et les pièges du boss, vous les découvrirez le jour J.
          </p>
          <Link to="/hub" className="raid-teaser-back">← Retour au hub</Link>
        </section>

      </main>
    </div>
  )
}
