import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { ORGANS, getBossByKey } from '../../lib/raid'
import CollectiveGauge from '../../components/ui/CollectiveGauge'

// Présentation pure de la page résultat (victoire / défaite), séparée du fetch :
// prend un objet `data` (forme renvoyée par l'action `result`) et le rend. Réutilisée
// par RaidResultPage (données live) et par la prévisualisation (données simulées).

const fmtTime = (s) => s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const hueOf = (s) => { let h = 0; for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }
const ordinal = (n) => n === 1 ? '1ᵉʳ' : `${n}ᵉ`

function Member({ pseudo, role }) {
  const o = role ? ORGANS[role] : null
  return (
    <span className="raid-res-member" title={o?.label || ''}>
      <span className="raid-res-mav" style={{ background: `hsl(${hueOf(pseudo)} 52% 52%)` }}>
        {(pseudo?.[0] || '?').toUpperCase()}
        {o?.emoji && <span className="raid-res-mrole">{o.emoji}</span>}
      </span>
      <span className="raid-res-mname">{pseudo}</span>
    </span>
  )
}

export default function RaidResultView({ data }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* presse-papier indisponible — on ignore silencieusement */ }
  }

  const { session, members = [], clear_seconds, rank, best_clear_seconds, xp_awarded = 0 } = data || {}
  const won = session?.status === 'won'
  const boss = getBossByKey(session?.boss_key)
  const isTest = session?.is_test
  const isRecord = rank?.position === 1
  const cleared = session?.assault_index ?? 0

  // Victoire = grand moment (un raid se gagne difficilement) → salve de confettis,
  // renforcée si c'est un nouveau record de la semaine.
  useEffect(() => {
    if (!won) return
    const colors = ['#ffd166', '#06d6a0', '#4cc9f0', '#ffffff', '#f4a261']
    const cannon = (x, angle) => confetti({ particleCount: 70, angle, spread: 72, startVelocity: 55, ticks: 190, gravity: 1, scalar: 1.1, origin: { x, y: 0.62 }, colors })
    cannon(0.06, 60); cannon(0.94, 120)
    const timers = [
      setTimeout(() => { cannon(0.06, 60); cannon(0.94, 120) }, 320),
      setTimeout(() => confetti({ particleCount: 130, spread: 110, startVelocity: 45, ticks: 220, gravity: 0.85, scalar: 1.1, origin: { x: 0.5, y: 0.28 }, colors }), 680),
    ]
    if (isRecord) timers.push(setTimeout(() => { cannon(0.2, 70); cannon(0.8, 110) }, 1050))
    return () => timers.forEach(clearTimeout)
  }, [won, isRecord])

  if (!data?.session) return null

  return (
    <div className={`raid-res ${won ? 'raid-res--won' : 'raid-res--lost'}`}>
      {/* Carte d'issue (liseré, emoji, titre, stats) */}
      <div className="raid-res-top">
        {won && <div className="raid-res-victory-badge">⚔️ Victoire d’équipage</div>}
        <div className="raid-res-emoji">{won ? '🏆' : '🌑'}</div>
        <h1 className="raid-h1 raid-res-title">
          {won ? `${boss.name} est terrassé !` : `${boss.name} a replongé…`}
        </h1>
        <p className="raid-sub raid-res-sub">
          {won
            ? 'Votre équipage a terrassé le boss de la semaine. L’abysse vous doit une fière chandelle.'
            : 'L’équipage est tombé. Mais la mer offre toujours une seconde chance.'}
        </p>
        {isTest && <span className="raid-res-testbadge">🔧 Partie de test — hors classement</span>}

        {/* Temps & rang (victoire) / progression (défaite) */}
        <div className="raid-res-stats">
          {won ? (
            <>
              <div className="raid-res-stat">
                <span className="raid-res-statlabel">Temps de clear</span>
                <span className="raid-res-statval">{fmtTime(clear_seconds)}</span>
              </div>
              {!isTest && rank && (
                <div className={`raid-res-stat${isRecord ? ' raid-res-stat--gold' : ''}`}>
                  <span className="raid-res-statlabel">Classement de la semaine</span>
                  <span className="raid-res-statval">
                    {isRecord ? '🥇 Meilleur temps !' : `${ordinal(rank.position)} le plus rapide`}
                  </span>
                  {rank.total > 1 && <span className="raid-res-stathint">sur {rank.total} équipages</span>}
                </div>
              )}
              <div className="raid-res-stat">
                <span className="raid-res-statlabel">XP collectif</span>
                <span className="raid-res-statval">+{xp_awarded.toLocaleString('fr-FR')}</span>
                <span className="raid-res-stathint">offert à toute la communauté</span>
              </div>
            </>
          ) : (
            <>
              <div className="raid-res-stat">
                <span className="raid-res-statlabel">Assauts franchis</span>
                <span className="raid-res-statval">{cleared} / {session.assault_count}</span>
              </div>
              <div className="raid-res-stat raid-res-stat--record">
                <span className="raid-res-statlabel">Record à battre cette semaine</span>
                <span className="raid-res-statval">
                  {best_clear_seconds != null ? fmtTime(best_clear_seconds) : 'Aucun encore !'}
                </span>
                <span className="raid-res-stathint">
                  {best_clear_seconds != null ? 'la gloire est à votre portée' : 'soyez les premiers à le vaincre'}
                </span>
              </div>
              <div className="raid-res-stat">
                <span className="raid-res-statlabel">Boss restant</span>
                <span className="raid-res-statval">{session.current_hp} PV</span>
                <span className="raid-res-stathint">si proche du but…</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Victoire : jauge XP collective — le raid offre de l'XP à toute la communauté. */}
      {won && (
        <div className="raid-res-gauge">
          <CollectiveGauge />
        </div>
      )}

      {/* Récap équipage — « générique de fin » */}
      {members.length > 0 && (
        <div className="raid-res-crew">
          <h2 className="raid-res-crewtitle">L’équipage</h2>
          <div className="raid-res-crewlist">
            {members.map((m) => <Member key={m.pseudo + m.role} pseudo={m.pseudo} role={m.role} />)}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="raid-res-actions">
        {won ? (
          <>
            <button className="btn-primary" onClick={() => navigate('/raid')}>Rejouer</button>
            <button className="btn-secondary" onClick={copyLink}>{copied ? '✓ Lien copié' : 'Partager le résultat'}</button>
            <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au hub</button>
          </>
        ) : (
          <>
            <button className="btn-primary" onClick={() => navigate('/raid')}>⚔️ La revanche</button>
            <button className="btn-secondary" onClick={copyLink}>{copied ? '✓ Lien copié' : 'Partager'}</button>
            <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au hub</button>
          </>
        )}
      </div>
    </div>
  )
}
