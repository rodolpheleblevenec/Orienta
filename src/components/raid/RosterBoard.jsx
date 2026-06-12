import { useState, useEffect } from 'react'
import { ORGANS, getOrgansForTier, MIN_PLAYERS } from '../../lib/raid'

const COUNTDOWN = 5
const hueOf = (s) => { let h = 0; for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

function Avatar({ pseudo, me }) {
  return (
    <span className="raid-av" style={me ? { background: 'var(--teal)' } : { background: `hsl(${hueOf(pseudo)} 52% 52%)` }}>
      {(pseudo?.[0] || '?').toUpperCase()}
    </span>
  )
}

// Salle d'attente : enrôlement de l'équipage (organes du palier = effectif).
// Quand tout le monde est prêt, un décompte lance automatiquement.
export default function RosterBoard({ boss, roster, me, actions, busy }) {
  const count = roster.length
  const organs = getOrgansForTier(count)
  const byRole = {}
  for (const p of roster) if (p.role) byRole[p.role] = p

  const myRole = me?.role ?? null
  const readyCount = roster.filter(p => p.is_ready).length
  const allClaimed = organs.every(r => byRole[r])
  const allReady = count > 0 && roster.every(p => p.is_ready)
  const enoughPlayers = count >= MIN_PLAYERS
  const canLaunch = enoughPlayers && allClaimed && allReady

  // Décompte automatique : démarre quand tout le monde est prêt, s'annule sinon.
  const [countdown, setCountdown] = useState(null)
  useEffect(() => {
    if (!canLaunch) { setCountdown(null); return }
    setCountdown(COUNTDOWN)
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(iv)
          const lowest = [...roster].sort((a, b) => String(a.user_id).localeCompare(String(b.user_id)))[0]
          if (lowest && me?.user_id === lowest.user_id) actions.startGame()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [canLaunch]) // eslint-disable-line react-hooks/exhaustive-deps

  const status = !enoughPlayers
    ? `En attente de ${MIN_PLAYERS - count} joueur·s de plus…`
    : !myRole ? 'Choisis ton organe pour pouvoir te déclarer prêt'
      : !allClaimed ? 'Il reste des organes à couvrir'
        : !allReady ? `En attente : ${count - readyCount} joueur·s pas encore prêt·s`
          : 'Tout le monde est prêt !'

  return (
    <div className="raid-lobby-main">
      <div className="raid-lobby-banner">
        <span className="raid-lobby-emoji">{boss?.emoji}</span>
        <div className="raid-lobby-bannertext">
          <h1 className="raid-lobby-title">{boss?.name}</h1>
          <p className="raid-lobby-sub">Salle d’attente — couvrez tous les organes, puis « Prêt »</p>
        </div>
        <div className="raid-lobby-meta">
          <span className="raid-lobby-players">👥 {count}</span>
          <span className="raid-lobby-readytxt">{readyCount}/{count} prêts</span>
          <span className="raid-lobby-dots">
            {roster.map((p, i) => <i key={i} className={`raid-dot${p.is_ready ? ' raid-dot--on' : ''}`} />)}
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
              <div className="raid-orgcard-top">
                <span className="raid-orgcard-emoji">{o.emoji}</span>
                <span className="raid-orgcard-name">{o.label}</span>
              </div>
              <p className="raid-orgcard-desc">{o.blurb}</p>
              <div className="raid-orgcard-holder">
                {holder ? (
                  <>
                    <Avatar pseudo={holder.pseudo} me={mine} />
                    <span className="raid-orgcard-who">{mine ? 'Toi' : holder.pseudo}</span>
                    {holder.is_ready && <span className="raid-orgcard-ready">✓ prêt</span>}
                  </>
                ) : (
                  <span className="raid-orgcard-take">+ Prendre ce rôle</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

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
            <span className="raid-countdown-label">{busy ? 'Lancement…' : 'Le raid commence dans'}</span>
            <span className="raid-countdown-num">{countdown}</span>
            <button type="button" className="raid-countdown-cancel" onClick={() => actions.setReady(false)}>✕ Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}
