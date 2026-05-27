import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { LEVELS, getLevelProgress } from '../../lib/levels'
import { getCreature } from '../../lib/creatures'
import { MARINE_ITEMS, getMarineItem } from '../../lib/marineItems'
import Header from '../../components/ui/Header'

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [playHistory, setPlayHistory] = useState([])
  const [createdGrids, setCreatedGrids] = useState([])
  const [collectiveLevel, setCollectiveLevel] = useState(1)
  const [selectedSkin, setSelectedSkin] = useState(user?.selected_skin ?? 1)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('orienta_plays').select('score, success, completed_at, orienta_grids(clue_top)')
        .eq('player_id', user.id).not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }).limit(20),

      supabase.from('orienta_grids').select('id, clue_top, created_at, status')
        .eq('creator_id', user.id).order('created_at', { ascending: false }).limit(20),

      supabase.from('orienta_collective_progress').select('*').eq('id', 1).single(),
    ]).then(([playsRes, gridsRes, collectiveRes]) => {
      const plays = playsRes.data ?? []
      setPlayHistory(plays)
      setCreatedGrids(gridsRes.data ?? [])
      const wins = plays.filter(p => p.success).length
      const total = plays.reduce((s, p) => s + (p.score ?? 0), 0)
      setStats({
        played: plays.length,
        winRate: plays.length > 0 ? Math.round((wins / plays.length) * 100) : 0,
        avgScore: plays.length > 0 ? Math.round(total / plays.length) : 0,
        bestScore: plays.reduce((m, p) => Math.max(m, p.score ?? 0), 0),
      })
      if (collectiveRes.data) {
        const collectiveProgress = getLevelProgress(collectiveRes.data.total_xp)
        setCollectiveLevel(collectiveProgress.currentLevel.level)
      }
    })
  }, [user])

  if (!user) return null

  const handleSelectSkin = async (level) => {
    await supabase.from('orienta_users').update({ selected_skin: level }).eq('id', user.id)
    setSelectedSkin(level)
    await refreshUser()
  }

  const userLevelProgress = getLevelProgress(user.xp)

  return (
    <div className="profile-page">
      <Header />
      <main className="profile-main">
        <div className="profile-header-block">
          <div className="profile-avatar">
            {selectedSkin > 1 ? (
              getMarineItem(selectedSkin).Component({ size: 48 })
            ) : (
              user.pseudo[0].toUpperCase()
            )}
          </div>
          <div>
            <h1 className="profile-name">{user.pseudo}</h1>
            <div className="profile-xp-bar">
              <div className="profile-xp-info">
                <span className="profile-xp-label">Niveau {user.level} — {userLevelProgress.currentLevel.name}</span>
                <span className="profile-xp-amount">{user.xp.toLocaleString()} XP</span>
              </div>
              <div className="profile-xp-track">
                <motion.div
                  className="profile-xp-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${userLevelProgress.pct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              {userLevelProgress.nextLevel && (
                <div className="profile-xp-next">
                  {(userLevelProgress.nextLevel.xp - user.xp).toLocaleString()} XP pour {userLevelProgress.nextLevel.name}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="profile-streak">
          <span>🔥 Streak actuel : <strong>{user.streak_current}</strong></span>
          <span>🏆 Record : <strong>{user.streak_best}</strong></span>
        </div>

        {stats && (
          <div className="profile-stats">
            {[
              { label: 'Parties',     value: stats.played },
              { label: 'Réussite',    value: `${stats.winRate}%` },
              { label: 'Score moyen', value: stats.avgScore },
              { label: 'Meilleur',    value: stats.bestScore },
            ].map((s, i) => (
              <motion.div key={s.label} className="stat-card"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}>
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </motion.div>
            ))}
          </div>
        )}

        <section className="profile-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <h2 style={{ marginBottom: 0 }}>Ton bestiaire</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Déverrouillés avec ton XP</span>
          </div>
          <div className="skin-grid">
            {MARINE_ITEMS.map((item) => {
              const isUnlocked = user.level >= item.level
              const isSelected = selectedSkin === item.level

              return (
                <motion.div
                  key={item.level}
                  className={`skin-card ${isUnlocked ? 'skin-card--unlocked' : 'skin-card--locked'} ${isSelected ? 'skin-card--active' : ''}`}
                  whileHover={isUnlocked && !isSelected ? { scale: 1.05 } : {}}
                  onClick={() => isUnlocked && !isSelected && handleSelectSkin(item.level)}
                >
                  <div className="skin-creature">
                    {isUnlocked ? (
                      <item.Component size={40} />
                    ) : (
                      <>
                        <item.Component size={40} style={{ opacity: 0.3 }} />
                        <div className="skin-lock">🔒</div>
                      </>
                    )}
                  </div>
                  <div className="skin-info">
                    <div className="skin-name">{item.name}</div>
                    {isSelected && <div className="skin-badge">✓ Actif</div>}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </section>

        <section className="profile-section">
          <h2>Grilles jouées</h2>
          {playHistory.length === 0 ? <p className="profile-empty">Aucune partie jouée encore.</p> : (
            <ul className="history-list">
              {playHistory.map((p, i) => (
                <li key={i} className="history-item">
                  <span className="history-clue">{p.orienta_grids?.clue_top ?? '—'}</span>
                  <span className={`history-result ${p.success ? 'success' : 'fail'}`}>
                    {p.success ? '✓' : '✗'} {p.score} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="profile-section">
          <h2>Grilles créées</h2>
          {createdGrids.length === 0 ? <p className="profile-empty">Aucune grille créée encore.</p> : (
            <ul className="history-list">
              {createdGrids.map(g => (
                <li key={g.id} className="history-item">
                  <span className="history-clue">{g.clue_top ?? '—'}</span>
                  <Link to={`/dashboard/${g.id}`} className="history-link">Dashboard →</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button className="btn-secondary profile-logout" onClick={logout}>
          Changer de pseudo
        </button>
      </main>
    </div>
  )
}
