import { useEffect, useState } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
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
  const playsWithTime = plays.filter(p => p.time_seconds != null)
  const avgTime = playsWithTime.length > 0
    ? Math.round(playsWithTime.reduce((s, p) => s + p.time_seconds, 0) / playsWithTime.length) : 0
  const successRate = plays.length > 0 ? Math.round((successPlays.length / plays.length) * 100) : 0

  const dist = { 1: 0, 2: 0, 3: 0, fail: 0 }
  for (const p of plays) {
    if (!p.success) dist.fail++
    else dist[p.attempts_count] = (dist[p.attempts_count] ?? 0) + 1
  }

  const comments = plays.filter(p => p.comment?.trim())

  const clueTitle = [grid.clue_top, grid.clue_right, grid.clue_bottom, grid.clue_left].filter(Boolean).join(' · ')

  const sortedPlays = [...plays].sort((a, b) => {
    if (a.success && !b.success) return -1
    if (!a.success && b.success) return 1
    return (b.score ?? 0) - (a.score ?? 0)
  })

  return (
    <div className="dashboard-page">
      <Header />
      <main className="dashboard-main">

        {/* Hero */}
        <div className="db-hero">
          <Link to="/hub" className="db-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>
            Hub
          </Link>
          <div className="db-hero-text">
            <div className="hub-eyebrow" style={{ marginBottom: 8 }}>
              <span className="hub-eyebrow-dot" />
              Ma grille
            </div>
            <h1 className="db-title">{clueTitle || 'Ma grille'}</h1>
          </div>
        </div>

        {/* Stats band */}
        <div className="db-stat-row">
          {[
            { label: 'Joueurs', value: plays.length, mod: '' },
            { label: 'Réussite', value: plays.length > 0 ? `${successRate}%` : '—', mod: successRate >= 50 ? 'hub-spill--teal' : plays.length > 0 ? 'hub-spill--coral' : '' },
            { label: 'Temps moyen', value: avgTime > 0 ? `${avgTime}s` : '—', mod: '' },
            { label: 'Succès', value: successPlays.length, mod: 'hub-spill--teal' },
          ].map((s, i) => (
            <motion.div key={s.label} className={`hub-spill ${s.mod}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}>
              <span className="hub-spill-k">{s.label}</span>
              <span className="hub-spill-v">{s.value}</span>
            </motion.div>
          ))}
        </div>

        {/* 01 — Solution attendue */}
        <section className="db-section">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">01</span>Solution attendue</span>
            <span className="hub-kick-rule" />
          </div>
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

        {/* 02 — Distribution */}
        <section className="db-section">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">02</span>Distribution des essais</span>
            <span className="hub-kick-rule" />
          </div>
          <div className="db-dist-card">
            {[1, 2, 3, 'fail'].map((k, idx) => {
              const count = dist[k] ?? 0
              const pct = plays.length > 0 ? Math.round((count / plays.length) * 100) : 0
              const isFail = k === 'fail'
              return (
                <div key={k} className="db-dist-row">
                  <div className={`db-dist-label ${isFail ? 'db-dist-label--fail' : ''}`}>
                    {isFail ? 'Échec' : `${k} essai${k > 1 ? 's' : ''}`}
                  </div>
                  <div className="db-dist-track">
                    <motion.div
                      className={`db-dist-fill ${isFail ? 'db-dist-fill--fail' : ''}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.2 + idx * 0.06, duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="db-dist-pct">{pct > 0 ? `${pct}%` : ''}</span>
                  <span className="db-dist-count">{count}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* 03 — Joueurs */}
        <section className="db-section">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">03</span>Joueurs</span>
            <span className="hub-kick-rule" />
            {plays.length > 0 && <span className="db-badge">{plays.length}</span>}
          </div>
          {plays.length === 0 ? (
            <div className="db-empty">Aucun joueur pour l'instant.</div>
          ) : (
            <div className="db-leaderboard">
              {sortedPlays.map((p, i) => {
                const rank = i + 1
                const medalMod = p.success && rank <= 3 ? ['gold', 'silver', 'bronze'][rank - 1] : null
                return (
                  <motion.div key={i} className={`db-player ${!p.success ? 'db-player--fail' : ''}`}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}>
                    <span className={`db-rank${medalMod ? ` db-rank--${medalMod}` : ''}`}>{rank}</span>
                    <span className="db-player-name">{p.orienta_users?.pseudo ?? '?'}</span>
                    <span className="db-player-meta">
                      <span className="db-player-attempts">{p.attempts_count} essai{p.attempts_count > 1 ? 's' : ''}</span>
                      {p.time_seconds != null && <span className="db-player-time">{p.time_seconds}s</span>}
                    </span>
                    <span className={`db-player-score ${p.success ? 'db-player-score--ok' : 'db-player-score--fail'}`}>
                      {p.success ? `${p.score ?? 0} pts` : 'Échec'}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </section>

        {/* 04 — Commentaires */}
        {comments.length > 0 && (
          <section className="db-section">
            <div className="hub-part-head">
              <span className="hub-kick"><span className="hub-kick-num">04</span>Commentaires</span>
              <span className="hub-kick-rule" />
              <span className="db-badge">{comments.length}</span>
            </div>
            <div className="db-comments">
              {comments.map((p, i) => (
                <motion.div key={i} className="db-comment"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}>
                  <span className="db-comment-author">{p.orienta_users?.pseudo ?? '?'}</span>
                  <p className="db-comment-body">{p.comment}</p>
                </motion.div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
