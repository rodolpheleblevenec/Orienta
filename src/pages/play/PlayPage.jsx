import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { computeScore, computeXp, evaluateAttempt } from '../../lib/scoring'
import Header from '../../components/ui/Header'
import CloverGrid from '../../components/game/CloverGrid'
import CardTray from '../../components/game/CardTray'
import WordCard from '../../components/game/WordCard'

const MAX_ATTEMPTS = 3

export default function PlayPage() {
  const { gridId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [grid, setGrid] = useState(null)
  const [placements, setPlacements] = useState({ 0: null, 1: null, 2: null, 3: null })
  const [trayCards, setTrayCards] = useState([])
  const [activeCard, setActiveCard] = useState(null)
  const [solution, setSolution] = useState(null) // only loaded after game over

  const [playId, setPlayId] = useState(null)
  const [attemptNumber, setAttemptNumber] = useState(1)
  const [attemptsFailed, setAttemptsFailed] = useState(0)
  const [feedbacks, setFeedbacks] = useState({})
  const [lastResult, setLastResult] = useState(null)
  const [gameOver, setGameOver] = useState(false)

  const startTimeRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [liveScore, setLiveScore] = useState(1000)

  useEffect(() => {
    if (!gridId || !user) return
    const fetchGrid = async () => {
      const { data: gridData } = await supabase
        .from('orienta_grids')
        .select('*, orienta_users(pseudo)')
        .eq('id', gridId)
        .single()

      if (!gridData) { navigate('/hub'); return }
      setGrid(gridData)

      // Cards without solution positions
      const { data: gridCards } = await supabase
        .from('orienta_grid_cards')
        .select('card_id, orienta_word_cards(*)')
        .eq('grid_id', gridId)

      const shuffled = [...(gridCards ?? [])].sort(() => Math.random() - 0.5).map(gc => ({
        card: gc.orienta_word_cards,
        rotation: [0, 90, 180, 270][Math.floor(Math.random() * 4)],
      }))
      setTrayCards(shuffled)

      const { data: play } = await supabase
        .from('orienta_plays')
        .insert({ grid_id: gridId, player_id: user.id })
        .select()
        .single()
      if (play) setPlayId(play.id)
    }
    fetchGrid()
  }, [gridId, user, navigate])

  useEffect(() => {
    if (gameOver) return
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsed(secs)
      setLiveScore(computeScore(secs, attemptsFailed))
    }, 1000)
    return () => clearInterval(interval)
  }, [gameOver, attemptsFailed])

  function handleDragStart(event) {
    const fromTray = trayCards.find(c => `tray-${c.card.id}` === event.active.id)
    setActiveCard(fromTray ?? null)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveCard(null)
    if (!over) return
    const slotIdx = parseInt(over.id.replace('slot-', ''), 10)
    if (isNaN(slotIdx)) return

    const trayIdx = trayCards.findIndex(c => `tray-${c.card.id}` === active.id)
    if (trayIdx !== -1) {
      const cardItem = trayCards[trayIdx]
      const existing = placements[slotIdx]
      setPlacements(prev => ({ ...prev, [slotIdx]: cardItem }))
      setTrayCards(prev => {
        const updated = prev.filter((_, i) => i !== trayIdx)
        if (existing) updated.push(existing)
        return updated
      })
    }
  }

  function handleRotate(pos) {
    setPlacements(prev => {
      const item = prev[pos]
      if (!item) return prev
      return { ...prev, [pos]: { ...item, rotation: (item.rotation + 90) % 360 } }
    })
  }

  async function handleSubmit() {
    if (trayCards.length > 0) return

    const answer = Object.entries(placements)
      .filter(([, v]) => v)
      .map(([pos, { card, rotation }]) => ({
        card_id: card.id,
        position: parseInt(pos, 10),
        rotation,
      }))

    // Server-side validation via Edge Function
    const { data: result, error } = await supabase.functions.invoke('check-attempt', {
      body: { play_id: playId, attempt_number: attemptNumber, answer },
    })

    if (error || !result) return

    const { correctFull, correctRotation, neither, success: won, card_feedbacks } = result

    await supabase.from('orienta_play_attempts').insert({
      play_id: playId,
      attempt_number: attemptNumber,
      answer,
      correct_full: correctFull,
      correct_rotation: correctRotation,
      neither,
    })

    // Apply per-position feedbacks
    const newFeedbacks = {}
    for (const a of answer) {
      const fb = card_feedbacks?.[a.card_id] ?? 'wrong'
      newFeedbacks[a.position] = fb
    }
    setFeedbacks(newFeedbacks)
    setLastResult({ correctFull, correctRotation, neither })

    if (won) {
      const finalScore = computeScore(elapsed, attemptsFailed)
      const xp = computeXp(finalScore, true)
      await supabase.from('orienta_plays').update({
        completed_at: new Date().toISOString(),
        time_seconds: elapsed,
        attempts_count: attemptNumber,
        success: true,
        score: finalScore,
        xp_earned: xp,
      }).eq('id', playId)
      setGameOver(true)
      navigate(`/result/${gridId}`, { state: { score: finalScore, xp, success: true } })
    } else {
      const next = attemptNumber + 1
      setAttemptNumber(next)
      setAttemptsFailed(f => f + 1)
      if (next > MAX_ATTEMPTS) {
        await supabase.from('orienta_plays').update({
          completed_at: new Date().toISOString(),
          time_seconds: elapsed,
          attempts_count: MAX_ATTEMPTS,
          success: false,
          score: 0,
          xp_earned: computeXp(0, false),
        }).eq('id', playId)
        setGameOver(true)
        navigate(`/result/${gridId}`, { state: { score: 0, xp: 0, success: false } })
      }
    }
  }

  if (!grid) return (
    <div className="play-page"><Header /><div className="play-loading">Chargement…</div></div>
  )

  const allPlaced = trayCards.length === 0
  const clues = { top: grid.clue_top, right: grid.clue_right, bottom: grid.clue_bottom, left: grid.clue_left }

  return (
    <div className="play-page">
      <Header />
      <main className="play-main">
        <div className="play-scorebar">
          <span className="play-score">{liveScore} pts</span>
          <span className="play-attempts">Essai {attemptNumber}/{MAX_ATTEMPTS}</span>
        </div>

        <AnimatePresence>
          {lastResult && !gameOver && (
            <motion.div className="play-feedback"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span className="fb-correct">🟢 {lastResult.correctFull}</span>
              <span className="fb-rotation">🟡 {lastResult.correctRotation}</span>
              <span className="fb-wrong">🔴 {lastResult.neither}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <CloverGrid placements={placements} clues={clues} feedbacks={feedbacks} onRotate={handleRotate} />
          <CardTray cards={trayCards} />
          <DragOverlay>
            {activeCard && <WordCard id="overlay" card={activeCard.card} rotation={activeCard.rotation} draggable={false} />}
          </DragOverlay>
        </DndContext>

        <button className="btn-primary play-submit" onClick={handleSubmit} disabled={!allPlaced}>
          {allPlaced ? 'Soumettre' : `Placez toutes les cartes (${trayCards.length} restante${trayCards.length > 1 ? 's' : ''})`}
        </button>
      </main>
    </div>
  )
}
