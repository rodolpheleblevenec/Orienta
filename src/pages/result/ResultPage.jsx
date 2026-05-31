import { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'
import StaticMiniGrid from '../../components/ui/StaticMiniGrid'

function formatTime(seconds) {
  if (!seconds) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return s > 0 ? `${m}m${s.toString().padStart(2, '0')}` : `${m}m`
}

export default function ResultPage() {
  const { gridId } = useParams()
  const location = useLocation()
  const { user } = useAuthStore()
  const {
    score = 0, xp = 0, success = false,
    baseXp = 0, bonusXp = 0,
    timeSeconds = 0, attemptCount = 1, streakCurrent = 0,
  } = location.state ?? {}

  const [leaderboard, setLeaderboard] = useState([])
  const [playerRank, setPlayerRank] = useState(null)
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
  const [commentSent, setCommentSent] = useState(false)
  const [play, setPlay] = useState(null)
  const [grid, setGrid] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [activeTab, setActiveTab] = useState('solution')

  useEffect(() => {
    if (success) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
  }, [success])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const rankQuery = success
      ? supabase
          .from('orienta_plays')
          .select('*', { count: 'exact', head: true })
          .eq('grid_id', gridId)
          .eq('success', true)
          .gt('score', score)
      : Promise.resolve({ count: null })

    Promise.all([
      supabase
        .from('orienta_plays')
        .select('score, orienta_users(pseudo)')
        .eq('grid_id', gridId)
        .eq('success', true)
        .order('score', { ascending: false })
        .limit(5),
      supabase
        .from('orienta_plays')
        .select('*')
        .eq('grid_id', gridId)
        .eq('player_id', user.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('orienta_grids')
        .select('*, orienta_grid_cards(*, orienta_word_cards(*))')
        .eq('id', gridId)
        .single(),
      supabase
        .from('orienta_plays')
        .select('comment, completed_at, orienta_users(pseudo)')
        .eq('grid_id', gridId)
        .not('comment', 'is', null)
        .order('completed_at', { ascending: false }),
      rankQuery,
    ]).then(([leaderRes, playRes, gridRes, commentsRes, rankRes]) => {
      if (cancelled) return
      setLeaderboard(leaderRes.data ?? [])
      setPlay(playRes.data)
      setGrid(gridRes.data)
      setComments(commentsRes.data ?? [])
      if (rankRes.count !== null) setPlayerRank(rankRes.count + 1)
      if (playRes.data?.id) {
        supabase
          .from('orienta_play_attempts')
          .select('*')
          .eq('play_id', playRes.data.id)
          .order('attempt_number')
          .then(({ data }) => { if (!cancelled) setAttempts(data ?? []) })
      }
    })

    return () => { cancelled = true }
  }, [gridId, user, score, success])

  async function handleCommentSubmit() {
    if (!play || !comment.trim()) return
    await supabase.from('orienta_plays').update({ comment: comment.trim() }).eq('id', play.id)
    setCommentSent(true)
    setComments(prev => [
      { comment: comment.trim(), orienta_users: { pseudo: user?.pseudo ?? 'Moi' } },
      ...prev,
    ])
  }

  // Solution correcte
  const solutionPlacements = {}
  for (const gc of grid?.orienta_grid_cards ?? []) {
    if (gc.position >= 0 && gc.position <= 3) {
      solutionPlacements[gc.position] = { card: gc.orienta_word_cards, rotation: gc.rotation ?? 0, colorIndex: gc.position }
    }
  }

  // Lookup carte par id pour reconstruire les placements d'un essai
  const cardById = {}
  for (const gc of grid?.orienta_grid_cards ?? []) {
    if (gc.orienta_word_cards) cardById[gc.card_id] = gc.orienta_word_cards
  }

  function buildAttemptPlacements(attempt) {
    const p = {}
    for (const ans of attempt?.answer ?? []) {
      if (ans.position >= 0 && ans.position <= 3 && cardById[ans.card_id]) {
        p[ans.position] = { card: cardById[ans.card_id], rotation: ans.rotation ?? 0, colorIndex: ans.position }
      }
    }
    return p
  }

  const clues = grid
    ? { top: grid.clue_top, right: grid.clue_right, bottom: grid.clue_bottom, left: grid.clue_left }
    : { top: '', right: '', bottom: '', left: '' }

  const currentAttempt = typeof activeTab === 'number' ? attempts[activeTab] : null

  // Est-ce que le joueur est déjà dans le top 5 affiché ?
  const playerInTop5 = leaderboard.some(row => row.orienta_users?.pseudo === user?.pseudo)

  return (
    <div className="result-page">
      <Header />
      <main className="result-main">

        {/* ── Colonne 1 — Messages & Commentaires ── */}
        <div className="result-col result-col--messages">
          <div className="result-section-title">💬 Messages</div>

          {!commentSent && play ? (
            <div className="result-comment">
              <textarea className="comment-input"
                placeholder="Laisser un message aux autres joueurs…"
                value={comment} onChange={e => setComment(e.target.value)}
                rows={3} maxLength={280} />
              <button className="btn-secondary" onClick={handleCommentSubmit} disabled={!comment.trim()}>
                Envoyer
              </button>
            </div>
          ) : commentSent ? (
            <p className="result-comment-sent">Message envoyé ✓</p>
          ) : null}

          {comments.length > 0 ? (
            <ul className="comments-list">
              {comments.map((c, i) => (
                <motion.li key={i} className="comment-item"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}>
                  <span className="comment-pseudo">{c.orienta_users?.pseudo ?? '?'}</span>
                  <p className="comment-text">{c.comment}</p>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="result-empty-state">Sois le premier à laisser un message !</p>
          )}
        </div>

        {/* ── Colonne 2 — Score & Classement ── */}
        <div className="result-col result-col--score">
          <motion.div className="result-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}>
            <div className="result-icon">{success ? '🎉' : '😔'}</div>
            <h1 className="result-title">{success ? 'Bien joué !' : 'Dommage…'}</h1>

            {success && (
              <div className="result-meta">
                {formatTime(timeSeconds)} · Essai {attemptCount}/3
              </div>
            )}

            {success ? (
              <div className="result-xp-block">
                <div className="result-xp-title">✨ XP gagnée</div>
                <div className="result-xp-row">
                  <span>🕐 Score {score} pts</span>
                  <span className="result-xp-value">+{baseXp} XP</span>
                </div>
                {bonusXp > 0 && (
                  <div className="result-xp-row">
                    <span>🔥 Streak {streakCurrent}j</span>
                    <span className="result-xp-value">+{bonusXp} XP</span>
                  </div>
                )}
                <div className="result-xp-divider" />
                <div className="result-xp-total">
                  <span>Total</span>
                  <span className="result-xp-total-value">+{xp} XP</span>
                </div>
              </div>
            ) : (
              <div className="result-xp">+{xp} XP pour la participation</div>
            )}
          </motion.div>

          {leaderboard.length > 0 && (
            <div className="result-leaderboard">
              <h2>Top 5</h2>
              <ol className="leaderboard-list">
                {leaderboard.map((row, i) => {
                  const isMe = row.orienta_users?.pseudo === user?.pseudo
                  return (
                    <motion.li key={i}
                      className={`leaderboard-row ${isMe ? 'leaderboard-row--me' : ''}`}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.06 }}>
                      <span className="leaderboard-rank">#{i + 1}</span>
                      <span className="leaderboard-name">{row.orienta_users?.pseudo ?? '?'}</span>
                      <span className="leaderboard-score">{row.score} pts</span>
                    </motion.li>
                  )
                })}
              </ol>

              {success && playerRank && !playerInTop5 && (
                <>
                  <div className="leaderboard-separator">···</div>
                  <div className="leaderboard-row leaderboard-row--me">
                    <span className="leaderboard-rank">#{playerRank}</span>
                    <span className="leaderboard-name">{user?.pseudo}</span>
                    <span className="leaderboard-score">{score} pts</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Colonne 3 — Feedback & Solution ── */}
        <div className="result-col result-col--feedback">
          {grid && (
            <div className="result-feedback-panel">
              <div className="result-feedback-tabs">
                {attempts.map((att, i) => (
                  <button key={i}
                    className={`result-feedback-tab ${activeTab === i ? 'result-feedback-tab--active' : ''}`}
                    onClick={() => setActiveTab(i)}
                    type="button">
                    Essai {att.attempt_number}
                  </button>
                ))}
                <button
                  className={`result-feedback-tab result-feedback-tab--solution ${activeTab === 'solution' ? 'result-feedback-tab--active' : ''}`}
                  onClick={() => setActiveTab('solution')}
                  type="button">
                  ✓ Solution
                </button>
              </div>

              <div className="result-feedback-body">
                {activeTab === 'solution' ? (
                  <div className="result-feedback-grid-wrap">
                    <StaticMiniGrid placements={solutionPlacements} clues={clues} />
                  </div>
                ) : currentAttempt ? (
                  <>
                    <div className="result-feedback-dots">
                      <div className="play-feedback-row">
                        <div className="play-feedback-dot play-feedback-dot--correct" />
                        <span className="play-feedback-count">{currentAttempt.correct_full}</span>
                        <span>bien placé et orienté</span>
                      </div>
                      <div className="play-feedback-row" title="Position correcte + orientation incorrecte, OU position incorrecte + orientation correcte">
                        <div className="play-feedback-dot play-feedback-dot--rotation" />
                        <span className="play-feedback-count">{currentAttempt.correct_rotation}</span>
                        <span>partiellement correct</span>
                      </div>
                      <div className="play-feedback-row">
                        <div className="play-feedback-dot play-feedback-dot--wrong" />
                        <span className="play-feedback-count">{currentAttempt.neither}</span>
                        <span>mal placé</span>
                      </div>
                    </div>
                    <div className="result-feedback-divider" />
                    <div className="result-feedback-grid-wrap">
                      <StaticMiniGrid placements={buildAttemptPlacements(currentAttempt)} clues={clues} />
                    </div>
                  </>
                ) : (
                  <div className="result-feedback-loading">Chargement…</div>
                )}
              </div>
            </div>
          )}
        </div>

      </main>

      <footer className="result-footer">
        <Link to="/hub" className="btn-primary result-footer-cta">Retour au Hub</Link>
      </footer>
    </div>
  )
}
