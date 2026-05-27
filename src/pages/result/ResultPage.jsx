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
  const [comment, setComment] = useState('')
  const [commentSent, setCommentSent] = useState(false)
  const [play, setPlay] = useState(null)
  const [grid, setGrid] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [solTab, setSolTab] = useState('solution')

  useEffect(() => {
    if (success) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
    }
  }, [success])

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase
        .from('orienta_plays')
        .select('score, orienta_users(pseudo)')
        .eq('grid_id', gridId)
        .eq('success', true)
        .order('score', { ascending: false })
        .limit(10),
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
    ]).then(([leaderRes, playRes, gridRes]) => {
      setLeaderboard(leaderRes.data ?? [])
      setPlay(playRes.data)
      setGrid(gridRes.data)
      if (playRes.data?.id) {
        supabase
          .from('orienta_play_attempts')
          .select('*')
          .eq('play_id', playRes.data.id)
          .order('attempt_number')
          .then(({ data }) => setAttempts(data ?? []))
      }
    })
  }, [gridId, user])

  async function handleCommentSubmit() {
    if (!play || !comment.trim()) return
    await supabase.from('orienta_plays').update({ comment: comment.trim() }).eq('id', play.id)
    setCommentSent(true)
  }

  const solutionPlacements = {}
  for (const gc of grid?.orienta_grid_cards ?? []) {
    if (gc.position >= 0 && gc.position <= 3) {
      solutionPlacements[gc.position] = { card: gc.orienta_word_cards, rotation: gc.rotation ?? 0 }
    }
  }

  const clues = grid
    ? { top: grid.clue_top, right: grid.clue_right, bottom: grid.clue_bottom, left: grid.clue_left }
    : { top: '', right: '', bottom: '', left: '' }

  return (
    <div className="result-page">
      <Header />
      <main className="result-main">

        {/* ── Colonne gauche ── */}
        <div className="result-col-left">
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
                  <span className="result-xp-label">🕐 Score {score} pts</span>
                  <span className="result-xp-value">+{baseXp} XP</span>
                </div>
                {bonusXp > 0 && (
                  <div className="result-xp-row">
                    <span className="result-xp-label">🔥 Streak {streakCurrent}j</span>
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

          {/* Classement */}
          {leaderboard.length > 0 && (
            <div className="result-leaderboard">
              <h2>Classement de cette grille</h2>
              <ol className="leaderboard-list">
                {leaderboard.map((row, i) => (
                  <motion.li key={i} className="leaderboard-row"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}>
                    <span className="leaderboard-rank">#{i + 1}</span>
                    <span className="leaderboard-name">{row.orienta_users?.pseudo ?? '?'}</span>
                    <span className="leaderboard-score">{row.score} pts</span>
                  </motion.li>
                ))}
              </ol>
            </div>
          )}

          {/* Commentaire */}
          {!commentSent && play && (
            <div className="result-comment">
              <textarea className="comment-input" placeholder="Laisser un commentaire au créateur…"
                value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={280} />
              <button className="btn-secondary" onClick={handleCommentSubmit} disabled={!comment.trim()}>
                Envoyer
              </button>
            </div>
          )}
          {commentSent && <p className="result-comment-sent">Commentaire envoyé ✓</p>}

          <Link to="/hub" className="btn-primary result-cta">Retour au Hub</Link>
        </div>

        {/* ── Colonne droite — Solution ── */}
        <div className="result-col-right">
          {!success && grid && (
            <div className="result-solution">
              <h2>La solution était</h2>

              <div className="result-sol-tabs">
                <button
                  className={`result-sol-tab ${solTab === 'solution' ? 'result-sol-tab--active' : ''}`}
                  onClick={() => setSolTab('solution')}
                  type="button"
                >
                  Solution
                </button>
                {attempts.map((att, i) => (
                  <button
                    key={i}
                    className={`result-sol-tab ${solTab === `attempt-${i}` ? 'result-sol-tab--active' : ''}`}
                    onClick={() => setSolTab(`attempt-${i}`)}
                    type="button"
                  >
                    Essai {att.attempt_number}
                  </button>
                ))}
              </div>

              <div className="result-sol-body">
                {solTab === 'solution' && (
                  <StaticMiniGrid placements={solutionPlacements} clues={clues} />
                )}
                {attempts.map((att, i) => solTab === `attempt-${i}` && (
                  <div key={i} className="result-attempt-detail">
                    <div className="play-feedback-row">
                      <div className="play-feedback-dot play-feedback-dot--correct" />
                      <span className="play-feedback-count">{att.correct_full}</span>
                      <span>bien placé et orienté</span>
                    </div>
                    <div className="play-feedback-row">
                      <div className="play-feedback-dot play-feedback-dot--rotation" />
                      <span className="play-feedback-count">{att.correct_rotation}</span>
                      <span>bien placé, mal orienté</span>
                    </div>
                    <div className="play-feedback-row">
                      <div className="play-feedback-dot play-feedback-dot--wrong" />
                      <span className="play-feedback-count">{att.neither}</span>
                      <span>mal placé</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
