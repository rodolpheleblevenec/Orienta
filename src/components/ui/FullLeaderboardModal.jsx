import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import RankAvatar from './RankAvatar'

function getMedal(idx) {
  if (idx === 0) return { bg: 'linear-gradient(135deg,#f3b53b,#df8f10)', color: '#fff' }
  if (idx === 1) return { bg: 'linear-gradient(135deg,#c3c9d1,#9aa3ad)', color: '#fff' }
  if (idx === 2) return { bg: 'linear-gradient(135deg,#dfa074,#c07d4d)', color: '#fff' }
  return null
}

export default function FullLeaderboardModal({ user, onClose }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    supabase.from('orienta_users')
      .select('pseudo, xp, selected_skin, equipped_frame, equipped_color, streak_current, jetons, level')
      .eq('is_system', false)
      .order('xp', { ascending: false })
      .then(({ data }) => {
        setPlayers(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="daily-lb-modal-backdrop" onClick={onClose}>
      <div className="daily-lb-modal" onClick={e => e.stopPropagation()}>
        <div className="daily-lb-modal-header">
          <div>
            <h2 className="daily-lb-modal-title">Classement général</h2>
            <p className="daily-lb-modal-sub">
              {loading ? 'Chargement…' : `${players.length} joueur${players.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <button className="daily-lb-modal-close" onClick={onClose} aria-label="Fermer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="daily-lb-modal-body">
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-2)' }}>
              Chargement…
            </div>
          ) : players.length === 0 ? (
            <div className="daily-lb-modal-empty">
              <p>Aucun joueur encore.</p>
            </div>
          ) : (
            <ol className="daily-lb-list">
              {players.map((player, i) => {
                const isMe = player.pseudo === user?.pseudo
                const medal = getMedal(i)
                return (
                  <li key={player.pseudo ?? i} className={`daily-lb-row${isMe ? ' daily-lb-row--me' : ''}`}>
                    <span
                      className="daily-lb-rank"
                      style={medal ? { background: medal.bg, color: medal.color } : {}}
                    >
                      {i + 1}
                    </span>
                    <RankAvatar player={player} />
                    <div className="clsmt-meta">
                      <span className="clsmt-name" style={player.equipped_color ? { color: player.equipped_color } : undefined}>
                        {player.pseudo ?? '?'}
                        {isMe && <span className="daily-lb-you">toi</span>}
                      </span>
                      <div className="clsmt-chips">
                        <span className="clsmt-chip clsmt-chip--streak">🔥 {player.streak_current ?? 0}</span>
                        <span className="clsmt-chip clsmt-chip--jetons">🪙 {player.jetons ?? 0}</span>
                        <span className="clsmt-chip clsmt-chip--level">Niv. {player.level ?? 1}</span>
                      </div>
                    </div>
                    <span className="daily-lb-score">{(player.xp ?? 0).toLocaleString()}<span> XP</span></span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
