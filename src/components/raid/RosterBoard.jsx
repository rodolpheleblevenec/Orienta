import { useState, useEffect } from 'react'
import { ORGANS, getOrgansForTier, organPowers, MIN_PLAYERS } from '../../lib/raid'

const COUNTDOWN = 5
const hueOf = (s) => { let h = 0; for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

// Rend « **gras** » → <b>gras</b> dans les libellés de pouvoirs.
function richText(s) {
  return String(s).split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))
}
const POWER_KEY = { see: '👁 Voit', do: '✋ Fait', blind: '🚫 Aveugle' }

function Avatar({ pseudo, me }) {
  return (
    <span className="raid-av" style={me ? { background: 'var(--teal)' } : { background: `hsl(${hueOf(pseudo)} 52% 52%)` }}>
      {(pseudo?.[0] || '?').toUpperCase()}
    </span>
  )
}

// Salle d'attente : enrôlement de l'équipage. Le lobby est FIGÉ au palier 3 (Œil /
// Main / Capitaine) : premiers arrivés, premiers servis. Les joueurs en surplus (tous
// les rôles déjà pris) restent « en renfort » → ils basculent automatiquement dans la
// prochaine arène dès que cet équipage embarque (sessions parallèles). Quand les 3
// rôles sont pris ET prêts, un décompte lance automatiquement.
export default function RosterBoard({ boss, roster, me, actions, busy }) {
  const count = roster.length                          // connectés (affichage)
  const organs = getOrgansForTier(MIN_PLAYERS)         // ['oeil','main','capitaine']
  const byRole = {}
  for (const p of roster) if (p.role) byRole[p.role] = p

  const myRole = me?.role ?? null
  const claimed = roster.filter(p => p.role)           // les seuls qui jouent
  const reinforcements = roster.filter(p => !p.role)   // en attente d'une place
  const readyCount = claimed.filter(p => p.is_ready).length
  const allClaimed = organs.every(r => byRole[r])
  const allReady = claimed.length === organs.length && claimed.every(p => p.is_ready)
  const target = organs.length                         // 3 postes à pourvoir
  const canLaunch = allClaimed && allReady

  // Décompte automatique : démarre quand les 3 rôles sont prêts, s'annule sinon.
  const [countdown, setCountdown] = useState(null)
  const [launchError, setLaunchError] = useState(null)
  useEffect(() => {
    if (!canLaunch) { setCountdown(null); setLaunchError(null); return }
    setCountdown(COUNTDOWN)
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(iv)
          // Un seul lanceur : le plus petit user_id PARMI LES PORTEURS DE RÔLE (jamais
          // un joueur en renfort). Le serveur est idempotent ; on remonte l'erreur.
          const lowest = [...claimed].sort((a, b) => String(a.user_id).localeCompare(String(b.user_id)))[0]
          if (lowest && me?.user_id === lowest.user_id) {
            Promise.resolve(actions.startGame()).then(res => { if (res?.error) setLaunchError(res.error) })
          }
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [canLaunch]) // eslint-disable-line react-hooks/exhaustive-deps

  const missing = organs.length - claimed.length
  const notReady = claimed.length - readyCount
  const status = !allClaimed
    ? (myRole ? `Il reste ${missing} organe${missing > 1 ? 's' : ''} à couvrir` : 'Choisis ton organe pour rejoindre l’équipage')
    : !allReady
      ? `En attente : ${notReady} membre${notReady > 1 ? 's' : ''} pas encore prêt${notReady > 1 ? 's' : ''}`
      : 'Tout le monde est prêt !'

  return (
    <div className="raid-lobby-main">
      <div className="raid-lobby-banner">
        <span className="raid-lobby-emoji">{boss?.emoji}</span>
        <div className="raid-lobby-bannertext">
          <h1 className="raid-lobby-title">{boss?.name}</h1>
          <p className="raid-lobby-sub">Salle d’attente — couvrez les 3 rôles, puis « Prêt »</p>
        </div>
        <div className="raid-lobby-meta">
          <span className="raid-lobby-players">👥 {count}</span>
          <span className="raid-lobby-readytxt">{readyCount}/{target} prêts</span>
          <span className="raid-lobby-dots">
            {organs.map((r) => {
              const h = byRole[r]
              return <i key={r} className={`raid-dot${h ? (h.is_ready ? ' raid-dot--on' : '') : ' raid-dot--empty'}`} />
            })}
          </span>
        </div>
      </div>

      <div className="raid-orgcard-grid">
        {organs.map(key => {
          const o = ORGANS[key]
          const holder = byRole[key]
          const mine = myRole === key
          const free = !holder
          return (
            <button
              key={key}
              type="button"
              className={`raid-orgcard${mine ? ' raid-orgcard--mine' : ''}${holder && !mine ? ' raid-orgcard--taken' : ''}${free ? ' raid-orgcard--free' : ''}`}
              onClick={() => { if (mine) actions.releaseRole(); else if (free) actions.claimRole(key) }}
              disabled={!free && !mine}
              title={o.blurb}
            >
              {mine && <span className="raid-orgcard-flag">Ton rôle</span>}
              <div className="raid-orgcard-top">
                <span className="raid-orgcard-emoji">{o.emoji}</span>
                <span className="raid-orgcard-titles">
                  <span className="raid-orgcard-name">{o.label}</span>
                  {o.tagline && <span className="raid-orgcard-tagline">{o.tagline}</span>}
                </span>
              </div>
              <div className="raid-orgcard-powers">
                {organPowers(key).map((p, i) => (
                  <div key={i} className={`raid-power raid-power--${p.kind}`}>
                    <span className="raid-power-key">{POWER_KEY[p.kind]}</span>
                    <span className="raid-power-txt">{richText(p.text)}</span>
                  </div>
                ))}
              </div>
              <div className="raid-orgcard-holder">
                {holder ? (
                  <>
                    <Avatar pseudo={holder.pseudo} me={mine} />
                    <span className="raid-orgcard-who">{mine ? 'Toi' : holder.pseudo}</span>
                    {holder.is_ready && <span className="raid-orgcard-ready">✓ prêt</span>}
                  </>
                ) : (
                  <span className="raid-orgcard-take">＋ Prendre ce rôle</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {allClaimed && reinforcements.length > 0 && (
        <div className="raid-lobby-renfort">
          {!myRole && (
            <p className="raid-lobby-renfort-me">
              Tous les rôles sont pris — tu rejoindras la <b>prochaine arène</b> dès que cet équipage embarque.
            </p>
          )}
          <span className="raid-lobby-renfort-list">🛟 En renfort : {reinforcements.map(p => p.pseudo).join(', ')}</span>
        </div>
      )}

      <div className="raid-lobby-footer">
        <button
          type="button"
          className={`btn-primary raid-ready-btn${me?.is_ready ? ' raid-ready-btn--on' : ''}`}
          disabled={!myRole}
          onClick={() => actions.setReady(!me?.is_ready)}
        >
          {!myRole ? 'Choisis un organe' : me?.is_ready ? '✓ Prêt — annuler' : 'Je suis prêt'}
        </button>
        <p className="raid-lobby-status">{status}</p>
      </div>

      {countdown !== null && (
        <div className="raid-countdown-overlay" role="status">
          <div className="raid-countdown-card">
            {launchError ? (
              <>
                <span className="raid-countdown-label">Lancement impossible</span>
                <span className="raid-countdown-err">
                  {launchError === 'invalid_roster'
                    ? 'Équipage incomplet — vérifiez que les 3 rôles sont bien pris.'
                    : 'Un souci est survenu. Réessayez dans un instant.'}
                </span>
                <button type="button" className="raid-countdown-cancel" onClick={() => { setLaunchError(null); actions.setReady(false) }}>Fermer</button>
              </>
            ) : (
              <>
                <span className="raid-countdown-label">{busy ? 'Lancement…' : 'Le raid commence dans'}</span>
                {!busy && <span className="raid-countdown-num">{countdown}</span>}
                <button type="button" className="raid-countdown-cancel" onClick={() => actions.setReady(false)}>✕ Annuler</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
