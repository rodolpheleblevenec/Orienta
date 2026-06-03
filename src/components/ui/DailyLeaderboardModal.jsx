import { useEffect } from 'react'

function getMedal(idx) {
  if (idx === 0) return { bg: 'linear-gradient(135deg,#f3b53b,#df8f10)', color: '#fff' }
  if (idx === 1) return { bg: 'linear-gradient(135deg,#c3c9d1,#9aa3ad)', color: '#fff' }
  if (idx === 2) return { bg: 'linear-gradient(135deg,#dfa074,#c07d4d)', color: '#fff' }
  return null
}

export default function DailyLeaderboardModal({ todayDaily, user, onClose }) {
  const allPlays = (todayDaily?.orienta_plays ?? [])
    .filter(p => p.success && p.score != null && p.completed_at)
    .sort((a, b) => b.score - a.score)

  const failedPlays = (todayDaily?.orienta_plays ?? [])
    .filter(p => !p.success && p.completed_at)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const gridTitle = todayDaily?.edition_number
    ? `Édition N°${todayDaily.edition_number}`
    : 'Grille du jour'

  return (
    <div className="daily-lb-modal-backdrop" onClick={onClose}>
      <div className="daily-lb-modal" onClick={e => e.stopPropagation()}>
        <div className="daily-lb-modal-header">
          <div>
            <h2 className="daily-lb-modal-title">Classement du jour</h2>
            <p className="daily-lb-modal-sub">{gridTitle}</p>
          </div>
          <button className="daily-lb-modal-close" onClick={onClose} aria-label="Fermer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="daily-lb-modal-body">
          {allPlays.length === 0 ? (
            <div className="daily-lb-modal-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                <path d="M6 9H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>
                <path d="M18 9h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3"/>
                <path d="M6 4h12v8a6 6 0 0 1-12 0V4Z"/>
                <path d="M12 18v4"/><path d="M8 22h8"/>
              </svg>
              <p>Aucun joueur n'a encore réussi le challenge.</p>
            </div>
          ) : (
            <ol className="daily-lb-list">
              {allPlays.map((p, i) => {
                const isMe = p.player_id === user?.id
                const medal = getMedal(i)
                return (
                  <li key={p.player_id ?? i} className={`daily-lb-row${isMe ? ' daily-lb-row--me' : ''}`}>
                    <span
                      className="daily-lb-rank"
                      style={medal ? { background: medal.bg, color: medal.color } : {}}
                    >
                      {i + 1}
                    </span>
                    <span className="daily-lb-name">
                      {p.orienta_users?.pseudo ?? '?'}
                      {isMe && <span className="daily-lb-you">toi</span>}
                    </span>
                    <span className="daily-lb-score">{p.score}<span> pts</span></span>
                  </li>
                )
              })}
            </ol>
          )}

          {failedPlays.length > 0 && (
            <p className="daily-lb-failed-note">
              {failedPlays.length} joueur{failedPlays.length > 1 ? 's' : ''} {failedPlays.length > 1 ? 'ont' : 'a'} échoué le challenge.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
