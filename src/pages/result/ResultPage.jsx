import { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'

export default function ResultPage() {
  const { gridId } = useParams()
  const location = useLocation()
  const { user } = useAuthStore()
  const { score = 0, xp = 0, success = false } = location.state ?? {}

  const [leaderboard, setLeaderboard] = useState([])
  const [comment, setComment] = useState('')
  const [commentSent, setCommentSent] = useState(false)
  const [play, setPlay] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('orienta_plays')
      .select('score, orienta_users(pseudo)')
      .eq('grid_id', gridId)
      .eq('success', true)
      .order('score', { ascending: false })
      .limit(10)
      .then(({ data }) => setLeaderboard(data ?? []))

    supabase
      .from('orienta_plays')
      .select('*')
      .eq('grid_id', gridId)
      .eq('player_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setPlay(data))
  }, [gridId, user])

  async function handleCommentSubmit() {
    if (!play || !comment.trim()) return
    await supabase.from('orienta_plays').update({ comment: comment.trim() }).eq('id', play.id)
    setCommentSent(true)
  }

  return (
    <div className="result-page">
      <Header />
      <main className="result-main">
        <motion.div className="result-card"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}>
          <div className="result-icon">{success ? '🎉' : '😔'}</div>
          <h1 className="result-title">{success ? 'Bien joué !' : 'Dommage…'}</h1>
          <div className="result-score-block">
            <span className="result-score">{score}</span>
            <span className="result-score-label">points</span>
          </div>
          <div className="result-xp">+{xp} XP collectifs</div>
        </motion.div>

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
      </main>
    </div>
  )
}
