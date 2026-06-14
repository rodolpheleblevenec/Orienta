import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ORGANS, getBossByKey } from '../../lib/raid'

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
      </span>
      {o?.emoji && <span className="raid-res-mrole">{o.emoji}</span>}
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

  const { session, members, clear_seconds, rank, best_clear_seconds, xp_awarded } = data
  const won = session.status === 'won'
  const boss = getBossByKey(session.boss_key)
  const isTest = session.is_test
  const isRecord = rank?.position === 1
  const cleared = session.assault_index ?? 0

  return (
    <div className={`raid-res ${won ? 'raid-res--won' : 'raid-res--lost'}`}>
      {/* Bandeau d'issue */}
      <div className="raid-res-emoji">{won ? '🏆' : '🌑'}</div>
      <h1 className="raid-h1">
        {won ? `${boss.name} tombe !` : `${boss.name} a replongé…`}
      </h1>
      <p className="raid-sub">
        {won
          ? 'Votre équipage a terrassé le boss de la semaine.'
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
          </>
        )}
      </div>

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
            <button className="btn-primary" onClick={() => navigate('/raid')}>⚔️ La revanche vous attend</button>
            <button className="btn-secondary" onClick={copyLink}>{copied ? '✓ Lien copié' : 'Partager'}</button>
            <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au hub</button>
          </>
        )}
      </div>
    </div>
  )
}
