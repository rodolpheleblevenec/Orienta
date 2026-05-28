import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'
import StaticMiniGrid from '../../components/ui/StaticMiniGrid'

export default function DashboardPage() {
  const { gridId } = useParams()
  const { user } = useAuthStore()
  const [grid, setGrid] = useState(null)
  const [plays, setPlays] = useState([])
  const [notOwner, setNotOwner] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('orienta_grids').select('*, orienta_grid_cards(*, orienta_word_cards(*))').eq('id', gridId).single()
      .then(async ({ data: g }) => {
        if (!g) { setLoading(false); return }
        if (g.creator_id !== user.id) { setNotOwner(true); setLoading(false); return }
        setGrid(g)

        const { data: playsData } = await supabase
          .from('orienta_plays')
          .select('*, orienta_users(pseudo)')
          .eq('grid_id', gridId)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })

        setPlays(playsData ?? [])
        setLoading(false)
      })
  }, [gridId, user])

  if (notOwner) return <Navigate to="/hub" replace />
  if (loading) return <div className="dashboard-loading">Chargement…</div>
  if (!grid) return <Navigate to="/hub" replace />

  const successPlays = plays.filter(p => p.success)
  const avgTime = plays.length > 0
    ? Math.round(plays.reduce((s, p) => s + (p.time_seconds ?? 0), 0) / plays.length) : 0

  const dist = { 1: 0, 2: 0, 3: 0, fail: 0 }
  for (const p of plays) {
    if (!p.success) dist.fail++
    else dist[p.attempts_count] = (dist[p.attempts_count] ?? 0) + 1
  }

  const comments = plays.filter(p => p.comment?.trim())

  return (
    <div className="dashboard-page">
      <Header />
      <main className="dashboard-main">
        <h1 className="dashboard-title">Dashboard — {[grid.clue_top, grid.clue_right, grid.clue_bottom, grid.clue_left].filter(Boolean).join(' · ')}</h1>

        <div className="dashboard-stats">
          {[
            { label: 'Joueurs', value: plays.length },
            { label: 'Réussis', value: `${plays.length > 0 ? Math.round((successPlays.length / plays.length) * 100) : 0}%` },
            { label: 'Temps moyen', value: `${avgTime}s` },
          ].map((s, i) => (
            <motion.div key={s.label} className="stat-card"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </motion.div>
          ))}
        </div>

        <section className="dashboard-section">
          <h2>Solution attendue</h2>
          <div className="dashboard-solution-wrap">
            <div className="dashboard-solution-card-bg">
              <StaticMiniGrid
                placements={Object.fromEntries(
                  (grid.orienta_grid_cards ?? [])
                    .filter(gc => gc.position >= 0 && gc.position <= 3)
                    .map(gc => [gc.position, { card: gc.orienta_word_cards, rotation: gc.rotation ?? 0, colorIndex: gc.position }])
                )}
                clues={{ top: grid.clue_top, right: grid.clue_right, bottom: grid.clue_bottom, left: grid.clue_left }}
              />
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <h2>Distribution des essais</h2>
          <div className="dist-bars">
            {[1, 2, 3, 'fail'].map(k => (
              <div key={k} className="dist-bar-item">
                <div className="dist-bar-label">{k === 'fail' ? 'Échec' : `${k} essai${k > 1 ? 's' : ''}`}</div>
                <div className="dist-bar-track">
                  <motion.div
                    className={`dist-bar-fill ${k === 'fail' ? 'dist-bar-fill--fail' : ''}`}
                    initial={{ width: 0 }}
                    animate={{ width: plays.length > 0 ? `${(dist[k] / plays.length) * 100}%` : '0%' }}
                    transition={{ delay: 0.2 }}
                  />
                </div>
                <span className="dist-bar-count">{dist[k]}</span>
              </div>
            ))}
          </div>
        </section>

        {comments.length > 0 && (
          <section className="dashboard-section">
            <h2>Commentaires ({comments.length})</h2>
            <ul className="comments-list">
              {comments.map((p, i) => (
                <li key={i} className="comment-item">
                  <span className="comment-author">{p.orienta_users?.pseudo ?? '?'}</span>
                  <span className="comment-text">{p.comment}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="dashboard-section">
          <h2>Joueurs</h2>
          <ul className="players-list">
            {plays.map((p, i) => (
              <li key={i} className="player-row">
                <span>{p.orienta_users?.pseudo ?? '?'}</span>
                <span className={p.success ? 'text-success' : 'text-error'}>
                  {p.success ? `✓ ${p.score} pts` : '✗ Échec'}
                </span>
                <span className="text-muted">{p.attempts_count} essai{p.attempts_count > 1 ? 's' : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
