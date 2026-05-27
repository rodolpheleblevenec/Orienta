import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'

export default function ProfilePage() {
  const { user, logout } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [playHistory, setPlayHistory] = useState([])
  const [createdGrids, setCreatedGrids] = useState([])

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('orienta_plays').select('score, success, completed_at, orienta_grids(clue_top)')
        .eq('player_id', user.id).not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }).limit(20),

      supabase.from('orienta_grids').select('id, clue_top, created_at, status')
        .eq('creator_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]).then(([playsRes, gridsRes]) => {
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
    })
  }, [user])

  if (!user) return null

  return (
    <div className="profile-page">
      <Header />
      <main className="profile-main">
        <div className="profile-header-block">
          <div className="profile-avatar">{user.pseudo[0].toUpperCase()}</div>
          <div>
            <h1 className="profile-name">{user.pseudo}</h1>
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
