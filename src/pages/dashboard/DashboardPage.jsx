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
  const [solutionCards, setSolutionCards] = useState([])
  const [attemptsByPlay, setAttemptsByPlay] = useState({})  // play.id → [tentatives]
  const [openPlayer, setOpenPlayer] = useState(null)        // play.id déplié dans le classement
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openReply, setOpenReply] = useState(null)   // play.id en cours d'édition
  const [replyText, setReplyText] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const [replyError, setReplyError] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      const { data: g } = await supabase
        .from('orienta_grids')
        .select('*')
        .eq('id', gridId)
        .single()
      if (cancelled) return
      if (!g) { setLoading(false); return }

      const { data: playsData } = await supabase
        .from('orienta_plays')
        .select('*, orienta_users(pseudo)')
        .eq('grid_id', gridId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
      if (cancelled) return

      const allPlays = playsData ?? []
      // Accès : créateur de la grille, ou joueur ayant terminé sa partie
      // (la page révèle la solution → réservée aux finishers, anti-triche).
      const isOwner = g.creator_id === user.id
      const isFinisher = allPlays.some(p => p.player_id === user.id)
      if (!isOwner && !isFinisher) { setDenied(true); setLoading(false); return }

      setGrid(g)
      setPlays(allPlays)

      // La solution (positions/rotations) ne sort du serveur que via get-solution,
      // qui revérifie l'autorisation côté serveur.
      const { data: sol, error } = await supabase.functions.invoke('get-solution', {
        body: { grid_id: gridId, player_id: user.id },
      })
      if (cancelled) return
      if (!error && sol?.cards) setSolutionCards(sol.cards)

      // Parcours détaillé des joueurs (essai par essai) — réservé au créateur.
      // Voir le jeu des autres révèle des fausses pistes : gate côté serveur.
      if (isOwner) {
        const { data: att } = await supabase.functions.invoke('get-grid-attempts', {
          body: { grid_id: gridId, user_id: user.id },
        })
        if (cancelled) return
        if (att?.attempts) {
          const map = {}
          for (const a of att.attempts) (map[a.play_id] ??= []).push(a)
          setAttemptsByPlay(map)
        }
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [gridId, user])

  if (denied) return <Navigate to="/hub" replace />
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

  const isOwner = grid.creator_id === user?.id
  const isDaily = grid.daily_date != null
  const eyebrowLabel = isOwner ? 'Ma grille' : isDaily ? 'Grille du jour' : 'Statistiques'

  const sortedPlays = [...plays].sort((a, b) => {
    if (a.success && !b.success) return -1
    if (!a.success && b.success) return 1
    return (b.score ?? 0) - (a.score ?? 0)
  })

  // Maps issues de la solution : contenu de chaque carte + sa position attendue.
  // Les 4 cartes manipulées par les joueurs sont les mêmes que la solution, donc
  // on peut reconstruire chaque essai (mots + rotations) sans requête en plus.
  // La couleur d'une carte suit sa position dans la SOLUTION → un essai mal placé
  // se repère d'un coup d'œil aux couleurs mélangées.
  const cardById = {}
  const solPosByCard = {}
  for (const gc of solutionCards) {
    if (gc.orienta_word_cards) cardById[gc.card_id] = gc.orienta_word_cards
    if (gc.position >= 0 && gc.position <= 3) solPosByCard[gc.card_id] = gc.position
  }
  const gridClues = { top: grid.clue_top, right: grid.clue_right, bottom: grid.clue_bottom, left: grid.clue_left }

  function attemptPlacements(answer) {
    const pl = {}
    for (const a of answer ?? []) {
      pl[a.position] = { card: cardById[a.card_id], rotation: a.rotation ?? 0, colorIndex: solPosByCard[a.card_id] ?? 0 }
    }
    return pl
  }

  function openReplyEditor(p) {
    setOpenReply(p.id)
    setReplyText(p.creator_reply ?? '')
    setReplyError(false)
  }

  function cancelReply() {
    setOpenReply(null)
    setReplyText('')
    setReplyError(false)
  }

  async function submitReply(playId) {
    const text = replyText.trim()
    if (!text || replyBusy) return
    setReplyBusy(true)
    setReplyError(false)
    const { data, error } = await supabase.functions.invoke('social', {
      body: { action: 'reply', user_id: user.id, play_id: playId, reply: text },
    })
    setReplyBusy(false)
    if (error || data?.error) { setReplyError(true); return }
    setPlays(prev => prev.map(pl =>
      pl.id === playId ? { ...pl, creator_reply: text, creator_reply_at: data.reply_at } : pl))
    cancelReply()
  }

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
              {eyebrowLabel}
            </div>
            <h1 className="db-title">{clueTitle || eyebrowLabel}</h1>
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
                  solutionCards
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
                const attempts = attemptsByPlay[p.id] ?? []
                const expandable = isOwner && attempts.length > 0
                const open = openPlayer === p.id
                return (
                  <motion.div key={p.id ?? i}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}>
                    <div
                      className={`db-player ${!p.success ? 'db-player--fail' : ''} ${expandable ? 'db-player--clickable' : ''} ${open ? 'db-player--open' : ''}`}
                      role={expandable ? 'button' : undefined}
                      tabIndex={expandable ? 0 : undefined}
                      onClick={expandable ? () => setOpenPlayer(open ? null : p.id) : undefined}
                      onKeyDown={expandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenPlayer(open ? null : p.id) } } : undefined}
                    >
                      <span className={`db-rank${medalMod ? ` db-rank--${medalMod}` : ''}`}>{rank}</span>
                      <span className="db-player-name">{p.orienta_users?.pseudo ?? '?'}</span>
                      <span className="db-player-meta">
                        <span className="db-player-attempts">{p.attempts_count} essai{p.attempts_count > 1 ? 's' : ''}</span>
                        {p.time_seconds != null && <span className="db-player-time">{p.time_seconds}s</span>}
                      </span>
                      <span className={`db-player-score ${p.success ? 'db-player-score--ok' : 'db-player-score--fail'}`}>
                        {p.success ? `${p.score ?? 0} pts` : 'Échec'}
                      </span>
                      {expandable && (
                        <svg className={`db-player-chevron ${open ? 'db-player-chevron--open' : ''}`}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      )}
                    </div>

                    {expandable && open && (
                      <motion.div className="db-journey"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.25 }}>
                        <div className="db-journey-attempts">
                          {attempts.map((a) => {
                            const won = a.correct_full === 4
                            return (
                              <div key={a.attempt_number} className={`db-attempt ${won ? 'db-attempt--win' : ''}`}>
                                <div className="db-attempt-head">
                                  <span className="db-attempt-num">Essai {a.attempt_number}</span>
                                  {won && <span className="db-attempt-win-badge">✓</span>}
                                </div>
                                <div className="db-attempt-grid">
                                  <StaticMiniGrid placements={attemptPlacements(a.answer)} clues={gridClues} />
                                </div>
                                <div className="db-attempt-feedback">
                                  <span className="db-fb db-fb--ok">{a.correct_full} placée{a.correct_full !== 1 ? 's' : ''}</span>
                                  {a.correct_rotation > 0 && (
                                    <span className="db-fb db-fb--partial">{a.correct_rotation} partiel{a.correct_rotation !== 1 ? 's' : ''}</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {p.comment?.trim() && (
                          <div className="db-journey-comment">
                            <p className="db-journey-comment-body">« {p.comment} »</p>
                            {p.creator_reply && (
                              <div className="db-reply">
                                <span className="db-reply-label">↳ Ta réponse</span>
                                <p className="db-reply-body">{p.creator_reply}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
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
              {comments.map((p, i) => {
                const editing = openReply === p.id
                return (
                  <motion.div key={p.id ?? i} className="db-comment"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}>
                    <span className="db-comment-author">{p.orienta_users?.pseudo ?? '?'}</span>
                    <p className="db-comment-body">{p.comment}</p>

                    {/* Réponse du créateur (visible par tous) */}
                    {p.creator_reply && !editing && (
                      <div className="db-reply">
                        <span className="db-reply-label">↳ Réponse du créateur</span>
                        <p className="db-reply-body">{p.creator_reply}</p>
                      </div>
                    )}

                    {/* Éditeur de réponse — réservé au créateur de la grille */}
                    {isOwner && (editing ? (
                      <div className="db-reply-editor">
                        <textarea
                          className="db-reply-input"
                          placeholder="Répondre à ce joueur…"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          rows={2} maxLength={280} autoFocus
                        />
                        <div className="db-reply-actions">
                          <button type="button" className="db-reply-cancel"
                            onClick={cancelReply} disabled={replyBusy}>Annuler</button>
                          <button type="button" className="db-reply-send"
                            onClick={() => submitReply(p.id)} disabled={replyBusy || !replyText.trim()}>
                            {replyBusy ? 'Envoi…' : 'Envoyer'}
                          </button>
                        </div>
                        {replyError && <p className="db-reply-error">Échec de l'envoi — réessaie.</p>}
                      </div>
                    ) : (
                      <button type="button" className="db-reply-trigger" onClick={() => openReplyEditor(p)}>
                        {p.creator_reply ? 'Modifier ma réponse' : 'Répondre'}
                      </button>
                    ))}
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
