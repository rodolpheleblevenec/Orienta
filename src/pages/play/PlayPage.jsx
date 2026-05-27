import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { computeScore, computeXp, xpStreakBonus, evaluateAttempt } from '../../lib/scoring'
import Header from '../../components/ui/Header'
import CloverGrid from '../../components/game/CloverGrid'
import CardTray from '../../components/game/CardTray'
import WordCard from '../../components/game/WordCard'

const MAX_ATTEMPTS = 3

export default function PlayPage() {
  const { gridId } = useParams()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuthStore()

  const [grid, setGrid] = useState(null)
  const [placements, setPlacements] = useState({ 0: null, 1: null, 2: null, 3: null })
  const [trayCards, setTrayCards] = useState([])
  const [activeCard, setActiveCard] = useState(null)
  const [solution, setSolution] = useState(null) // only loaded after game over
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)

  const [playId, setPlayId] = useState(null)
  const [attemptNumber, setAttemptNumber] = useState(1)
  const [attemptsFailed, setAttemptsFailed] = useState(0)
  const [attemptHistory, setAttemptHistory] = useState([])
  const [gameOver, setGameOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSwappingSlots, setIsSwappingSlots] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

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

      // Check if user already played this grid
      const { data: existingPlay } = await supabase
        .from('orienta_plays')
        .select('id')
        .eq('grid_id', gridId)
        .eq('player_id', user.id)
        .single()

      if (existingPlay) {
        setAlreadyPlayed(true)
        setPlayId(existingPlay.id)
        return
      }

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

  function handleDragStart({ active }) {
    const fromTray = trayCards.find(c => `tray-${c.card.id}` === active.id)
    if (fromTray) { setActiveCard(fromTray); return }
    for (const [pos, item] of Object.entries(placements)) {
      if (item && `placed-${item.card.id}-${pos}` === active.id) {
        setActiveCard(item); return
      }
    }
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null)
    if (!over) return
    const slotIdx = parseInt(over.id.replace('slot-', ''), 10)
    if (isNaN(slotIdx)) return

    // Tray → slot
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
      return
    }

    // Slot → slot
    for (const [pos, item] of Object.entries(placements)) {
      if (item && `placed-${item.card.id}-${pos}` === active.id) {
        const sourceSlot = parseInt(pos)
        if (sourceSlot === slotIdx) return
        const existing = placements[slotIdx]
        setIsSwappingSlots(true)
        setPlacements(prev => ({
          ...prev,
          [slotIdx]: item,
          [sourceSlot]: existing ?? null,
        }))
        setTimeout(() => setIsSwappingSlots(false), 50)
        return
      }
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
    setIsSubmitting(true)

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

    if (error || !result) {
      setIsSubmitting(false)
      return
    }

    const { correctFull, correctRotation, neither, success: won } = result

    // Fire & forget: log attempt (not critical path)
    supabase.from('orienta_play_attempts').insert({
      play_id: playId,
      attempt_number: attemptNumber,
      answer,
      correct_full: correctFull,
      correct_rotation: correctRotation,
      neither,
    })

    // Add to history
    setAttemptHistory(prev => [...prev, { correctFull, correctRotation, neither }])

    if (won) {
      const finalScore = computeScore(elapsed, attemptsFailed)
      const baseXp = computeXp(finalScore, true)
      const bonusXp = xpStreakBonus(user.streak_current)
      const totalXp = baseXp + bonusXp
      await supabase.from('orienta_plays').update({
        completed_at: new Date().toISOString(),
        time_seconds: elapsed,
        attempts_count: attemptNumber,
        success: true,
        score: finalScore,
        xp_earned: totalXp,
      }).eq('id', playId)
      await supabase.rpc('add_user_xp', { uid: user.id, amount: totalXp })
      await refreshUser()
      setGameOver(true)
      navigate(`/result/${gridId}`, { state: { score: finalScore, xp: totalXp, success: true } })
    } else {
      const next = attemptNumber + 1
      setAttemptNumber(next)
      setAttemptsFailed(f => f + 1)
      setIsSubmitting(false)
      if (next > MAX_ATTEMPTS) {
        const participationXp = computeXp(0, false)
        await supabase.from('orienta_plays').update({
          completed_at: new Date().toISOString(),
          time_seconds: elapsed,
          attempts_count: MAX_ATTEMPTS,
          success: false,
          score: 0,
          xp_earned: participationXp,
        }).eq('id', playId)
        await supabase.rpc('add_user_xp', { uid: user.id, amount: participationXp })
        await refreshUser()
        setGameOver(true)
        navigate(`/result/${gridId}`, { state: { score: 0, xp: participationXp, success: false } })
      }
    }
  }

  if (!grid) return (
    <div className="play-page"><Header /><div className="play-loading">Chargement…</div></div>
  )

  if (alreadyPlayed) return (
    <div className="play-page">
      <Header />
      <main className="play-main" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ marginBottom: '12px' }}>Tu as déjà joué à cette grille</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Tu peux jouer à chaque grille une seule fois. Reviens plus tard pour découvrir de nouvelles grilles !
          </p>
          <button className="btn-primary" onClick={() => navigate('/hub')} style={{ width: '100%' }}>
            Retour au Hub
          </button>
        </div>
      </main>
    </div>
  )

  const allPlaced = Object.values(placements).every(v => v !== null)
  const clues = { top: grid.clue_top, right: grid.clue_right, bottom: grid.clue_bottom, left: grid.clue_left }

  return (
    <div className="play-page">
      <Header />
      <main className="play-main">
        <div className="play-left">
          <div className="play-scorebar">
            <span className="play-score">{liveScore} pts</span>
            <span className="play-attempts">Essai {attemptNumber}/{MAX_ATTEMPTS}</span>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <CloverGrid placements={placements} clues={clues} onRotate={handleRotate} disableTransition={isSwappingSlots} />

            {attemptHistory.length > 0 && (
              <div className="play-feedback-section">
                <div className="play-feedback-title">Essai {attemptHistory.length}</div>
                <div className="play-feedback-row">
                  <div className="play-feedback-dot play-feedback-dot--correct" />
                  <span className="play-feedback-count">{attemptHistory[attemptHistory.length - 1].correctFull}</span>
                  <span>bien placé et bien orienté</span>
                </div>
                <div className="play-feedback-row">
                  <div className="play-feedback-dot play-feedback-dot--rotation" />
                  <span className="play-feedback-count">{attemptHistory[attemptHistory.length - 1].correctRotation}</span>
                  <span>bien placé, mal orienté</span>
                </div>
                <div className="play-feedback-row">
                  <div className="play-feedback-dot play-feedback-dot--wrong" />
                  <span className="play-feedback-count">{attemptHistory[attemptHistory.length - 1].neither}</span>
                  <span>mal placé, mal orienté</span>
                </div>
              </div>
            )}

            <CardTray cards={trayCards} />
            <DragOverlay dropAnimation={null}>
              {activeCard && <WordCard id="overlay" card={activeCard.card} rotation={activeCard.rotation} draggable={false} />}
            </DragOverlay>
          </DndContext>

          <button className="btn-primary play-submit" onClick={handleSubmit} disabled={!allPlaced || isSubmitting}>
            {isSubmitting ? '…' : (allPlaced ? 'Soumettre' : `Placez toutes les cartes (${trayCards.length} restante${trayCards.length > 1 ? 's' : ''})`)}
          </button>
        </div>

        <div className="play-right">
          {attemptHistory.map((attempt, idx) => (
            <div key={idx} className="play-attempt-row">
              <div className="play-attempt-label">Essai {idx + 1}</div>
              <div className="play-pegs">
                {Array(attempt.correctFull).fill(0).map((_, i) => <div key={i} className="play-peg play-peg--correct" />)}
                {Array(attempt.correctRotation).fill(0).map((_, i) => <div key={i} className="play-peg play-peg--rotation" />)}
                {Array(attempt.neither).fill(0).map((_, i) => <div key={i} className="play-peg play-peg--wrong" />)}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
