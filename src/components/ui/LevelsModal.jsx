import { useEffect, useState } from 'react'
import { LEVELS, getLevelProgress } from '../../lib/levels'
import { getCreature } from '../../lib/creatures'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

export default function LevelsModal({ collectiveLevel, collectiveXp, onClose }) {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('paliers')
  const [leaderboard, setLeaderboard] = useState([])
  const [userRank, setUserRank] = useState(null)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  useEffect(() => {
    if (activeTab === 'classement' && user) {
      const fetchLeaderboard = async () => {
        setLeaderboardLoading(true)
        const [{ data: topPlayers }, { data: currentUser }] = await Promise.all([
          supabase.from('orienta_users')
            .select('pseudo, xp_contributed')
            .order('xp_contributed', { ascending: false })
            .limit(10),
          supabase.from('orienta_users')
            .select('xp_contributed')
            .eq('id', user.id)
            .single()
        ])

        setLeaderboard(topPlayers ?? [])

        if (currentUser && !topPlayers?.some(p => p.pseudo === user.pseudo)) {
          const { count } = await supabase
            .from('orienta_users')
            .select('id', { count: 'exact' })
            .gt('xp_contributed', currentUser.xp_contributed)
          setUserRank({
            pseudo: user.pseudo,
            xp_contributed: currentUser.xp_contributed,
            rank: (count ?? 0) + 1
          })
        }
        setLeaderboardLoading(false)
      }

      fetchLeaderboard()
    }
  }, [activeTab, user])

  const getMedal = (rank) => {
    const medals = ['🥇', '🥈', '🥉']
    return medals[rank] ?? `${rank + 1}.`
  }

  return (
    <div className="levels-modal-backdrop" onClick={onClose}>
      <div className="levels-modal" onClick={e => e.stopPropagation()}>
        <div className="levels-modal-header">
          <h2 className="levels-modal-title">Progression Collective</h2>
          <button className="levels-modal-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="levels-modal-tabs">
          <button
            className={`levels-modal-tab ${activeTab === 'paliers' ? 'levels-modal-tab--active' : ''}`}
            onClick={() => setActiveTab('paliers')}
            type="button"
          >
            Paliers
          </button>
          <button
            className={`levels-modal-tab ${activeTab === 'classement' ? 'levels-modal-tab--active' : ''}`}
            onClick={() => setActiveTab('classement')}
            type="button"
          >
            Classement
          </button>
        </div>

        <div className="levels-modal-body">
        {activeTab === 'paliers' ? (
          <>
            <div className="levels-modal-grid">
              {LEVELS.map((level) => {
                const creature = getCreature(level.level)
                const isUnlocked = collectiveLevel >= level.level
                const nextThreshold = LEVELS.find(l => l.level === level.level + 1)
                const nextXp = nextThreshold ? nextThreshold.xp : level.xp + 50000

                return (
                  <div key={level.level} className={`levels-modal-card ${isUnlocked ? 'levels-modal-card--unlocked' : 'levels-modal-card--locked'}`}>
                    <div className="levels-modal-creature">
                      {isUnlocked ? (
                        <creature.Component size={48} />
                      ) : (
                        <>
                          <creature.Component size={48} style={{ opacity: 0.4 }} />
                          <div className="levels-modal-lock">🔒</div>
                        </>
                      )}
                    </div>
                    <div className="levels-modal-info">
                      <div className="levels-modal-name">Niv {level.level} — {level.name}</div>
                      <div className="levels-modal-xp">{level.xp.toLocaleString()} XP</div>
                      {isUnlocked ? (
                        <div className="levels-modal-badge">✓ Débloqué</div>
                      ) : (
                        <div className="levels-modal-progress">
                          {nextXp > level.xp && (
                            <>
                              <div className="levels-modal-progress-bar">
                                <div className="levels-modal-progress-fill" style={{ width: `${Math.min(((collectiveXp - level.xp) / (nextXp - level.xp)) * 100, 100)}%` }} />
                              </div>
                              <div className="levels-modal-remaining">{Math.max(nextXp - collectiveXp, 0).toLocaleString()} XP</div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="levels-modal-footer">
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
                Les créatures se débloquent avec la progression collective.
              </p>
            </div>
          </>
        ) : (
          <div className="levels-modal-leaderboard">
            {leaderboardLoading ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Chargement…</p>
            ) : leaderboard.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Aucun contributeur encore</p>
            ) : (
              <div className="leaderboard-list">
                {leaderboard.map((player, idx) => {
                  const isCurrentUser = user?.pseudo === player.pseudo
                  return (
                    <div
                      key={player.pseudo}
                      className={`leaderboard-item ${isCurrentUser ? 'leaderboard-item--active' : ''}`}
                    >
                      <span className="leaderboard-rank">{getMedal(idx)}</span>
                      <span className="leaderboard-name">{player.pseudo}</span>
                      <span className="leaderboard-xp">{(player.xp_contributed ?? 0).toLocaleString()} XP</span>
                    </div>
                  )
                })}
                {userRank && (
                  <div className="leaderboard-item leaderboard-item--user">
                    <span className="leaderboard-rank">#{userRank.rank}</span>
                    <span className="leaderboard-name">{userRank.pseudo}</span>
                    <span className="leaderboard-xp">{(userRank.xp_contributed ?? 0).toLocaleString()} XP</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
