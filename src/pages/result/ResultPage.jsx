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

// Emojis proposés dans la palette du champ message (desktop only)
const EMOJI_PALETTE = ['😂', '🎉', '🔥', '👏', '🍀', '😭', '💪', '🤯', '😱', '❤️', '🤔', '👍']
// Emojis de réaction rapide sous chaque message
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮']

// Message de félicitations personnalisé selon la performance
function congratsMessage({ success, attemptCount, timeSeconds, streakCurrent }) {
  if (!success) return { icon: '😔', title: 'Dommage…', subtitle: null }
  if (attemptCount === 1) return { icon: '🎯', title: 'Sans faute !', subtitle: 'Résolu du premier coup, chapeau.' }
  if (streakCurrent >= 3) return { icon: '🔥', title: 'En feu !', subtitle: `${streakCurrent} jours d'affilée, continue comme ça.` }
  if (timeSeconds > 0 && timeSeconds <= 30) return { icon: '⚡', title: 'Éclair !', subtitle: `Bouclé en ${formatTime(timeSeconds)}.` }
  return { icon: '🎉', title: 'Bien joué !', subtitle: null }
}

// Pluie de trèfles 🍀 à la victoire
function rainClovers() {
  const clover = confetti.shapeFromText ? confetti.shapeFromText({ text: '🍀', scalar: 2.4 }) : undefined
  const opts = clover
    ? { shapes: [clover], scalar: 2.4, particleCount: 26, spread: 70, startVelocity: 38, ticks: 220, gravity: 1, origin: { y: 0.55 } }
    : { particleCount: 90, spread: 70, origin: { y: 0.6 } }
  const end = 700
  const burst = (delay) => setTimeout(() => confetti(opts), delay)
  burst(0); burst(220); burst(end)
}

// Chute douce depuis le haut de l'écran (défaite) — pluie / feuilles
function fallFromTop({ text, scalar, count, gravity, ticks, drift }) {
  const shape = confetti.shapeFromText ? confetti.shapeFromText({ text, scalar }) : undefined
  const cols = [0.2, 0.5, 0.8]
  cols.forEach((x, i) => setTimeout(() => confetti({
    shapes: shape ? [shape] : undefined,
    scalar, particleCount: count, ticks,
    angle: 270, spread: 50, startVelocity: 10, gravity, drift,
    origin: { x, y: 0 },
  }), i * 180))
}

// Animations de défaite — l'une des trois tirée au hasard
const LOSS_ANIMS = ['wilt', 'rain', 'leaves']
function pickLossAnim() { return LOSS_ANIMS[Math.floor(Math.random() * LOSS_ANIMS.length)] }
function rainDrops()  { fallFromTop({ text: '💧', scalar: 1.5, count: 16, gravity: 1.1, ticks: 200, drift: 0 }) }
function fallLeaves() { fallFromTop({ text: '🍂', scalar: 2,   count: 12, gravity: 0.7, ticks: 280, drift: 1 }) }

export default function ResultPage() {
  const { gridId } = useParams()
  const location = useLocation()
  const { user } = useAuthStore()
  const {
    score = 0, xp = 0, success = false,
    baseXp = 0, bonusXp = 0, attemptBonus = 0,
    timeSeconds = 0, attemptCount = 1, streakCurrent = 0,
    justPlayed = false,
  } = location.state ?? {}

  const [leaderboard, setLeaderboard] = useState([])
  const [playerRank, setPlayerRank] = useState(null)
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
  const [commentSent, setCommentSent] = useState(false)
  const [commentError, setCommentError] = useState(false)
  const [play, setPlay] = useState(null)
  const [grid, setGrid] = useState(null)
  const [solutionCards, setSolutionCards] = useState([])
  const [attempts, setAttempts] = useState([])
  const [activeTab, setActiveTab] = useState('solution')
  const [copied, setCopied] = useState(false)
  const [tileTooltipOpen, setTileTooltipOpen] = useState(false)
  const [hasUpvoted, setHasUpvoted] = useState(false)
  const [upvoteCount, setUpvoteCount] = useState(0)
  const [upvoteBusy, setUpvoteBusy] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [reactions, setReactions] = useState({})     // { [playId]: { [emoji]: count } }
  const [myReactions, setMyReactions] = useState(new Set()) // `${playId}:${emoji}`
  const [lossAnim] = useState(() => (success ? null : pickLossAnim()))

  const isOwnGrid = grid?.creator_id && user?.id === grid.creator_id
  // Crédit créateur — uniquement pour une grille du jour conçue par un JOUEUR (pas le compte système / réserve).
  const dailyCreator = grid?.daily_date && grid?.orienta_users?.is_system === false
    ? grid.orienta_users.pseudo
    : null

  useEffect(() => {
    if (!tileTooltipOpen) return
    const close = () => setTileTooltipOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [tileTooltipOpen])

  function copyChallenge() {
    const url = success
      ? `${window.location.origin}/play/${gridId}?from=${encodeURIComponent(user?.pseudo ?? '')}&score=${score}`
      : `${window.location.origin}/play/${gridId}`
    const text = success
      ? `🍀 Orienta — ${user?.pseudo} te défie !\nPeux-tu battre son score de ${score} pts ?\n${url}`
      : `🍀 J'ai joué une grille Orienta — à ton tour !\n${url}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    if (success) { rainClovers(); return }
    if (lossAnim === 'rain') rainDrops()
    else if (lossAnim === 'leaves') fallLeaves()
    // 'wilt' : animation CSS du trèfle, gérée au rendu
  }, [success, lossAnim])

  // Ferme la palette d'emojis au clic extérieur
  useEffect(() => {
    if (!emojiOpen) return
    const close = () => setEmojiOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [emojiOpen])

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
        .select('*, orienta_users(pseudo, is_system)')
        .eq('id', gridId)
        .single(),
      supabase
        .from('orienta_plays')
        .select('id, comment, creator_reply, success, completed_at, orienta_users(pseudo)')
        .eq('grid_id', gridId)
        .not('comment', 'is', null)
        .order('completed_at', { ascending: false }),
      rankQuery,
      supabase
        .from('orienta_grid_upvotes')
        .select('id', { count: 'exact', head: true })
        .eq('grid_id', gridId)
        .eq('user_id', user.id),
    ]).then(([leaderRes, playRes, gridRes, commentsRes, rankRes, myUpvoteRes]) => {
      if (cancelled) return
      setLeaderboard(leaderRes.data ?? [])
      setPlay(playRes.data)
      setGrid(gridRes.data)
      const commentRows = commentsRes.data ?? []
      setComments(commentRows)
      if (rankRes.count !== null) setPlayerRank(rankRes.count + 1)

      // Réactions des messages affichés
      const playIds = commentRows.map(c => c.id).filter(Boolean)
      if (playIds.length) {
        supabase
          .from('orienta_comment_reactions')
          .select('play_id, user_id, emoji')
          .in('play_id', playIds)
          .then(({ data }) => {
            if (cancelled || !data) return
            const counts = {}
            const mine = new Set()
            for (const r of data) {
              counts[r.play_id] = counts[r.play_id] ?? {}
              counts[r.play_id][r.emoji] = (counts[r.play_id][r.emoji] ?? 0) + 1
              if (r.user_id === user.id) mine.add(`${r.play_id}:${r.emoji}`)
            }
            setReactions(counts)
            setMyReactions(mine)
          })
      }
      setUpvoteCount(gridRes.data?.upvotes_count ?? 0)
      setHasUpvoted((myUpvoteRes.count ?? 0) > 0)

      // Solution (positions/rotations) servie par get-solution (revérifie l'accès
      // côté serveur : finisher ou créateur). orienta_grid_cards n'est plus lue en direct.
      supabase.functions.invoke('get-solution', { body: { grid_id: gridId, player_id: user.id } })
        .then(({ data }) => { if (!cancelled && data?.cards) setSolutionCards(data.cards) })

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
    setCommentError(false)
    const text = comment.trim()
    const { data, error } = await supabase.functions.invoke('social', {
      body: { action: 'comment', user_id: user.id, play_id: play.id, comment: text },
    })
    if (error || data?.error) { setCommentError(true); return }
    setComment('')
    setCommentSent(true)
    setComments(prev => [
      { id: play.id, comment: text, success: play.success, orienta_users: { pseudo: user?.pseudo ?? 'Moi' } },
      ...prev,
    ])
  }

  function insertEmoji(emoji) {
    setComment(prev => (prev + emoji).slice(0, 280))
  }

  async function toggleReaction(playId, emoji) {
    if (!user || !playId) return
    const key = `${playId}:${emoji}`
    const mine = myReactions.has(key)
    // mise à jour optimiste
    setMyReactions(prev => {
      const next = new Set(prev)
      mine ? next.delete(key) : next.add(key)
      return next
    })
    setReactions(prev => {
      const forPlay = { ...(prev[playId] ?? {}) }
      const c = (forPlay[emoji] ?? 0) + (mine ? -1 : 1)
      if (c <= 0) delete forPlay[emoji]
      else forPlay[emoji] = c
      return { ...prev, [playId]: forPlay }
    })
    const rollback = () => {
      setMyReactions(prev => {
        const next = new Set(prev)
        mine ? next.add(key) : next.delete(key)
        return next
      })
      setReactions(prev => {
        const forPlay = { ...(prev[playId] ?? {}) }
        const c = (forPlay[emoji] ?? 0) + (mine ? 1 : -1)
        if (c <= 0) delete forPlay[emoji]
        else forPlay[emoji] = c
        return { ...prev, [playId]: forPlay }
      })
    }
    // Toggle côté serveur (l'Edge Function bascule selon l'état réel en base).
    const { data, error } = await supabase.functions.invoke('social', {
      body: { action: 'react', user_id: user.id, play_id: playId, emoji },
    })
    if (error || data?.error) rollback()
  }

  async function handleUpvoteToggle() {
    if (!user || !grid || isOwnGrid || upvoteBusy) return
    setUpvoteBusy(true)
    const wasUpvoted = hasUpvoted
    // mise à jour optimiste
    setHasUpvoted(!wasUpvoted)
    setUpvoteCount(c => Math.max(c + (wasUpvoted ? -1 : 1), 0))

    const { data, error } = await supabase.functions.invoke('social', {
      body: { action: 'upvote', user_id: user.id, grid_id: grid.id },
    })

    if (error || data?.error) {
      // rollback
      setHasUpvoted(wasUpvoted)
      setUpvoteCount(c => Math.max(c + (wasUpvoted ? 1 : -1), 0))
    } else {
      // réconciliation avec l'état serveur (compteur maintenu par trigger DB)
      setHasUpvoted(data.upvoted)
      setUpvoteCount(data.count ?? 0)
    }
    setUpvoteBusy(false)
  }

  // Solution correcte (positions 0–3) — issue de get-solution
  const solutionPlacements = {}
  for (const gc of solutionCards) {
    if (gc.position >= 0 && gc.position <= 3) {
      solutionPlacements[gc.position] = { card: gc.orienta_word_cards, rotation: gc.rotation ?? 0, colorIndex: gc.position }
    }
  }

  // Lookup carte par id pour reconstruire les placements d'un essai (inclut le leurre)
  const cardById = {}
  for (const gc of solutionCards) {
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
  const congrats = congratsMessage({ success, attemptCount, timeSeconds, streakCurrent })

  // Est-ce que le joueur est déjà dans le top 5 affiché ?
  const playerInTop5 = leaderboard.some(row => row.orienta_users?.pseudo === user?.pseudo)

  return (
    <div className="result-page">
      <Header />
      <main className="result-main">

        {/* ── Colonne principale — Score + Partage + Solution ── */}
        <div className="result-col result-col--primary">
          <motion.div className="result-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}>
            <div className="result-icon">
              {lossAnim === 'wilt'
                ? <span className="result-wilt" role="img" aria-label="trèfle fané">🍀</span>
                : congrats.icon}
            </div>
            <h1 className="result-title">{congrats.title}</h1>
            {congrats.subtitle && <p className="result-congrats-sub">{congrats.subtitle}</p>}

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
                {attemptBonus > 0 && (
                  <div className="result-xp-row">
                    <span>{attemptCount === 1 ? '🎯 Du premier coup' : '⚡ En deux essais'}</span>
                    <span className="result-xp-value">+{attemptBonus} XP</span>
                  </div>
                )}
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

          {dailyCreator && (
            <div className="result-creator-credit">
              <span className="result-creator-credit-icon">✍️</span>
              Grille du jour créée par <strong>{dailyCreator}</strong>
            </div>
          )}

          <button className="result-share-btn" onClick={copyChallenge} type="button">
            {copied ? '✓ Copié !' : success ? '🍀 Défier mes collègues' : '🍀 Partager cette grille'}
          </button>

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
                    <div className="pfd-tiles">
                      <div className="pfd-tile pfd-tile--green">
                        <span className="pfd-tile-num">{currentAttempt.correct_full}</span>
                        <div className="pfd-tile-content">
                          <div className="pfd-tile-title-row">
                            <span className="pfd-tile-dot" />
                            <span className="pfd-tile-title">Bien placé{currentAttempt.correct_full !== 1 ? 's' : ''} et orienté{currentAttempt.correct_full !== 1 ? 's' : ''}</span>
                          </div>
                          <span className="pfd-tile-subtitle">Bon emplacement et bonne orientation</span>
                        </div>
                      </div>
                      <div className="pfd-tile pfd-tile--orange">
                        <span className="pfd-tile-num">{currentAttempt.correct_rotation}</span>
                        <div className="pfd-tile-content">
                          <div className="pfd-tile-title-row">
                            <span className="pfd-tile-dot" />
                            <span className="pfd-tile-title">Partiellement correct</span>
                            <button
                              className="pfd-tile-info-btn"
                              type="button"
                              onClick={e => { e.stopPropagation(); setTileTooltipOpen(v => !v) }}
                              aria-label="En savoir plus"
                            >ⓘ
                              {tileTooltipOpen && (
                                <span className="pfd-custom-tooltip pfd-custom-tooltip--left pfd-custom-tooltip--center">
                                  <strong>Mauvaise position et bonne orientation</strong>
                                  <strong>Mauvaise orientation et bonne position</strong>
                                </span>
                              )}
                            </button>
                          </div>
                          <span className="pfd-tile-subtitle">Un seul critère sur deux est bon</span>
                        </div>
                      </div>
                      <div className="pfd-tile pfd-tile--red">
                        <span className="pfd-tile-num">{currentAttempt.neither}</span>
                        <div className="pfd-tile-content">
                          <div className="pfd-tile-title-row">
                            <span className="pfd-tile-dot" />
                            <span className="pfd-tile-title">À revoir</span>
                          </div>
                          <span className="pfd-tile-subtitle">Ni le bon emplacement, ni la bonne orientation</span>
                        </div>
                      </div>
                    </div>
                    <div className="result-feedback-grid-wrap" style={{ padding: '0 16px 4px' }}>
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

        {/* ── Colonne secondaire — Classement + Messages ── */}
        <div className="result-col result-col--secondary">
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

          {grid && !isOwnGrid && (
            <div className={`result-upvote${hasUpvoted ? ' result-upvote--done' : ''}`}>
              <button
                className="result-upvote-btn"
                onClick={handleUpvoteToggle}
                disabled={upvoteBusy}
                type="button"
                aria-pressed={hasUpvoted}
                aria-label={hasUpvoted ? 'Retirer mon vote' : 'Voter pour cette grille'}
              >
                <span className="result-upvote-thumb">👍</span>
                <span className="result-upvote-count">{upvoteCount}</span>
              </button>
              <p className="result-upvote-text">
                {hasUpvoted
                  ? 'Merci ! Ton vote aide à mettre cette grille en avant.'
                  : "Cette grille t'a plu ? Vote pour la mettre en avant auprès des autres joueurs."}
              </p>
            </div>
          )}

          <div className="result-messages">
            <div className="result-section-title">💬 Messages</div>

            {!commentSent && play ? (
              <div className="result-comment">
                <div className="comment-input-wrap">
                  <textarea className="comment-input"
                    placeholder="Laisser un message aux autres joueurs…"
                    value={comment} onChange={e => setComment(e.target.value)}
                    rows={3} maxLength={280} />
                  <div className="comment-emoji">
                    <button
                      type="button"
                      className="comment-emoji-trigger"
                      aria-label="Ajouter un emoji"
                      onClick={e => { e.stopPropagation(); setEmojiOpen(v => !v) }}
                    >😊</button>
                    {emojiOpen && (
                      <div className="comment-emoji-popover" onClick={e => e.stopPropagation()}>
                        {EMOJI_PALETTE.map(em => (
                          <button key={em} type="button" className="comment-emoji-item"
                            onClick={() => insertEmoji(em)}>{em}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button className="result-comment-btn" onClick={handleCommentSubmit} disabled={!comment.trim()}>
                  Envoyer
                </button>
                {commentError && (
                  <p className="result-comment-error">Échec de l'envoi — réessaie.</p>
                )}
              </div>
            ) : commentSent ? (
              <p className="result-comment-sent">Message envoyé ✓</p>
            ) : null}

            {comments.length > 0 ? (
              <ul className="comments-list">
                {comments.map((c, i) => {
                  const counts = reactions[c.id] ?? {}
                  return (
                    <motion.li key={c.id ?? i} className="comment-item"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}>
                      <div className="comment-head">
                        <span className="comment-pseudo">{c.orienta_users?.pseudo ?? '?'}</span>
                        {c.success != null && (
                          <span className={`comment-badge comment-badge--${c.success ? 'win' : 'fail'}`}>
                            {c.success ? '✅ Réussi' : '💔 Raté'}
                          </span>
                        )}
                      </div>
                      <p className="comment-text">{c.comment}</p>
                      {c.creator_reply && (
                        <div className="comment-reply">
                          <span className="comment-reply-label">↳ Réponse du créateur</span>
                          <p className="comment-reply-text">{c.creator_reply}</p>
                        </div>
                      )}
                      {c.id && (
                        <div className="comment-reactions">
                          {REACTION_EMOJIS.map(em => {
                            const n = counts[em] ?? 0
                            const active = myReactions.has(`${c.id}:${em}`)
                            return (
                              <button key={em} type="button"
                                className={`reaction-chip${active ? ' reaction-chip--active' : ''}${n > 0 ? ' reaction-chip--has' : ''}`}
                                onClick={() => toggleReaction(c.id, em)}>
                                <span className="reaction-emoji">{em}</span>
                                {n > 0 && <span className="reaction-count">{n}</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </motion.li>
                  )
                })}
              </ul>
            ) : (
              <p className="result-empty-state">Sois le premier à laisser un message !</p>
            )}
          </div>
        </div>

      </main>

      <footer className="result-footer">
        <Link to="/hub" className="btn-primary result-footer-cta">Retour au Hub</Link>
        {play && !justPlayed && (
          <Link to={`/play/${gridId}?replay=1`} className="result-replay-link" title="Rejouer cette grille, juste pour le fun — sans XP">
            rejouer cette grille
          </Link>
        )}
      </footer>
    </div>
  )
}
