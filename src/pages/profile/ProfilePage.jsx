import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { LEVELS, getLevelProgress, getLevelProgressCollective } from '../../lib/levels'
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
    if (user?.selected_skin != null) setSelectedSkin(user.selected_skin)
  }, [user?.selected_skin])

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('orienta_plays').select('id, grid_id, score, success, completed_at, attempts_count, time_seconds, xp_earned, orienta_grids(clue_top, clue_right, clue_bottom, clue_left, difficulty)')
        .eq('player_id', user.id).not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }).limit(20),

      supabase.from('orienta_grids').select('id, clue_top, created_at, status, difficulty, orienta_plays(success)')
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
        const collectiveProgress = getLevelProgressCollective(collectiveRes.data.total_xp)
        setCollectiveLevel(collectiveProgress.currentLevel.level)
      }
    })
  }, [user])

  if (!user) return null

  const handleSelectSkin = async (level) => {
    await supabase.from('orienta_users').update({ selected_skin: level }).eq('id', user.id)
    await refreshUser()
    setSelectedSkin(level)
  }

  const userLevelProgress = getLevelProgress(user.xp)

  const DIFF_LABEL = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' }
  const DIFF_COLOR = { facile: '#00A889', moyen: '#E89010', difficile: '#F0440A' }

  function relativeDate(dateStr) {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    if (days === 0) return "Aujourd'hui"
    if (days === 1) return 'Hier'
    return `Il y a ${days} jours`
  }

  function formatTime(secs) {
    if (!secs) return null
    return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m${secs % 60 > 0 ? String(secs % 60).padStart(2, '0') : ''}`
  }

  return (
    <div className="profile-page">
      <Header />
      <main className="profile-main">
        <div className="profile-header-block">
          <div className="profile-avatar">
            {selectedSkin > 1 ? (
              getMarineItem(selectedSkin).name.split(' ')[0]
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
          <div className="profile-stats-block">
            <h2 className="profile-stats-title">Statistiques</h2>
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
          </div>
        )}

        <section className="profile-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <h2 style={{ marginBottom: 0 }}>Ton bestiaire</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Déverrouillés avec ton XP</span>
          </div>
          <div className="skin-grid">
            {MARINE_ITEMS.map((item) => {
              const isUnlocked = user.level >= item.level || collectiveLevel >= item.level
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
                      <span style={{ fontSize: '44px', lineHeight: 1 }}>{item.name.split(' ')[0]}</span>
                    ) : (
                      <>
                        <span style={{ fontSize: '44px', lineHeight: 1, opacity: 0.3 }}>{item.name.split(' ')[0]}</span>
                        <div className="skin-lock">🔒</div>
                      </>
                    )}
                  </div>
                  <div className="skin-info">
                    <div className="skin-name">{item.name}</div>
                    <div className="skin-xp-threshold">{item.xpThreshold.toLocaleString()} XP</div>
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
              {playHistory.map((p, i) => {
                const diff = p.orienta_grids?.difficulty
                const time = formatTime(p.time_seconds)
                return (
                  <li key={i} className="history-item history-item--rich">
                    <div className="history-item-main">
                      <div className="history-item-top">
                        <span className="history-clue">
                          {[p.orienta_grids?.clue_top, p.orienta_grids?.clue_right, p.orienta_grids?.clue_bottom, p.orienta_grids?.clue_left].filter(Boolean).join(' · ')}
                        </span>
                        {diff && <span className="history-diff-badge" style={{ color: DIFF_COLOR[diff] }}>{DIFF_LABEL[diff]}</span>}
                      </div>
                      <div className="history-item-meta">
                        <span>{p.attempts_count} essai{p.attempts_count > 1 ? 's' : ''}</span>
                        {time && <span>{time}</span>}
                        <span className="history-date">{relativeDate(p.completed_at)}</span>
                      </div>
                    </div>
                    <div className="history-item-right">
                      <span className={`history-result ${p.success ? 'success' : 'fail'}`}>
                        {p.success ? '✓' : '✗'} {p.score} pts
                      </span>
                      <Link
                        to={`/result/${p.grid_id}`}
                        state={{ score: p.score ?? 0, success: p.success ?? false, timeSeconds: p.time_seconds ?? 0, attemptCount: p.attempts_count ?? 1, xp: p.xp_earned ?? 0, baseXp: p.xp_earned ?? 0, bonusXp: 0, streakCurrent: 0 }}
                        className="history-replay-btn"
                      >Voir les essais →</Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="profile-section">
          <h2>Grilles créées</h2>
          {createdGrids.length === 0 ? <p className="profile-empty">Aucune grille créée encore.</p> : (
            <ul className="history-list">
              {createdGrids.map(g => {
                const plays = g.orienta_plays ?? []
                const completedPlays = plays.filter(p => p.success !== null)
                const successRate = completedPlays.length > 0
                  ? Math.round((completedPlays.filter(p => p.success).length / completedPlays.length) * 100)
                  : null
                return (
                  <li key={g.id} className="history-item history-item--rich">
                    <div className="history-item-main">
                      <div className="history-item-top">
                        <span className="history-clue">{g.clue_top ?? '—'}</span>
                        {g.difficulty && <span className="history-diff-badge" style={{ color: DIFF_COLOR[g.difficulty] }}>{DIFF_LABEL[g.difficulty]}</span>}
                      </div>
                      <div className="history-item-meta">
                        <span>{completedPlays.length} joueur{completedPlays.length !== 1 ? 's' : ''}</span>
                        {successRate !== null && <span>{successRate}% réussite</span>}
                        <span className="history-date">{relativeDate(g.created_at)}</span>
                      </div>
                    </div>
                    <div className="history-item-right">
                      <Link to={`/dashboard/${g.id}`} className="history-link">Dashboard →</Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
