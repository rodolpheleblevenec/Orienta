import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { computeScore, computeXp, xpStreakBonus } from '../../lib/scoring'
import Header from '../../components/ui/Header'
import StaticMiniGrid from '../../components/ui/StaticMiniGrid'
import CloverGrid from '../../components/game/CloverGrid'
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

  const [playId, setPlayId] = useState(null)
  const [attemptNumber, setAttemptNumber] = useState(1)
  const [attemptsFailed, setAttemptsFailed] = useState(0)
  const [attemptHistory, setAttemptHistory] = useState([])
  const [activeHistoryTab, setActiveHistoryTab] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSwappingSlots, setIsSwappingSlots] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  const startTimeRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

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

      const { data: existingPlay } = await supabase
        .from('orienta_plays')
        .select('id, completed_at, score, xp_earned, success, time_seconds, attempts_count')
        .eq('grid_id', gridId)
        .eq('player_id', user.id)
        .maybeSingle()

      if (existingPlay?.completed_at) {
        navigate(`/result/${gridId}`, {
          replace: true,
          state: {
            score: existingPlay.score ?? 0,
            xp: existingPlay.xp_earned ?? 0,
            success: existingPlay.success ?? false,
            baseXp: existingPlay.xp_earned ?? 0,
            bonusXp: 0,
            timeSeconds: existingPlay.time_seconds ?? 0,
            attemptCount: existingPlay.attempts_count ?? 1,
            streakCurrent: 0,
          },
        })
        return
      }

      const { data: gridCards } = await supabase
        .from('orienta_grid_cards')
        .select('card_id, orienta_word_cards(*)')
        .eq('grid_id', gridId)

      const shuffled = [...(gridCards ?? [])].sort(() => Math.random() - 0.5).map((gc, i) => ({
        card: gc.orienta_word_cards,
        rotation: [0, 90, 180, 270][Math.floor(Math.random() * 4)],
        colorIndex: i,
      }))
      setTrayCards(shuffled)

      if (existingPlay) {
        setPlayId(existingPlay.id)
      } else {
        const { data: play } = await supabase
          .from('orienta_plays')
          .insert({ grid_id: gridId, player_id: user.id })
          .select()
          .single()
        if (play) setPlayId(play.id)
      }
    }
    fetchGrid()
  }, [gridId, user, navigate])

  useEffect(() => {
    if (gameOver) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [gameOver])

  function handleReset() {
    const placed = Object.values(placements).filter(Boolean)
    if (!placed.length) return
    setTrayCards(prev => [...prev, ...placed])
    setPlacements({ 0: null, 1: null, 2: null, 3: null })
  }

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

    const { data: result, error } = await supabase.functions.invoke('check-attempt', {
      body: { play_id: playId, attempt_number: attemptNumber, answer },
    })

    if (error || !result) {
      setIsSubmitting(false)
      return
    }

    const { correctFull, correctRotation, neither, success: won } = result

    supabase.from('orienta_play_attempts').insert({
      play_id: playId,
      attempt_number: attemptNumber,
      answer,
      correct_full: correctFull,
      correct_rotation: correctRotation,
      neither,
    })

    const placementsSnapshot = { ...placements }
    setAttemptHistory(prev => {
      const next = [...prev, { correctFull, correctRotation, neither, placements: placementsSnapshot }]
      setActiveHistoryTab(next.length - 1)
      return next
    })

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
      navigate(`/result/${gridId}`, { state: { score: finalScore, xp: totalXp, success: true, baseXp, bonusXp, timeSeconds: elapsed, attemptCount: attemptNumber, streakCurrent: user.streak_current } })
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

  const allPlaced = Object.values(placements).every(v => v !== null)
  const clues = { top: grid.clue_top, right: grid.clue_right, bottom: grid.clue_bottom, left: grid.clue_left }

  return (
    <div className="play-page">
      <Header />
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

        {/* ── Drawer gauche — réserve (toujours visible) ── */}
        <aside className="play-tray-drawer">
          <div className="tray-cards">
            {trayCards.map(({ card, rotation, colorIndex }) => (
              <div key={card.id} className="card-tray-item">
                <WordCard
                  id={`tray-${card.id}`}
                  card={card}
                  rotation={rotation ?? 0}
                  colorIndex={colorIndex ?? 0}
                  draggable
                />
              </div>
            ))}
          </div>
        </aside>

        {/* ── Centre — grille ── */}
        <main className="play-main">
          <button
            className="btn-reset"
            onClick={handleReset}
            type="button"
            title="Remettre toutes les cartes dans la réserve"
            disabled={Object.values(placements).every(v => v === null)}
          >
            ↺ <span>Reset</span>
          </button>
          <div className="play-grid-area">
            <CloverGrid
              placements={placements}
              clues={clues}
              onRotate={handleRotate}
              disableTransition={isSwappingSlots}
            />
          </div>
        </main>

        {/* ── Drawer droit — feedback ── */}
        <aside className="play-feedback-drawer">
          {attemptHistory.length === 0 ? (
            <div className="play-hint">
              <p>Placez vos 4 cartes dans la grille et soumettez — votre feedback apparaîtra ici.</p>
            </div>
          ) : (
            <div className="play-history">
              {/* Onglets en haut — englobent résultat + aperçu */}
              <div className="play-history-tabs">
                {attemptHistory.map((_, idx) => (
                  <button
                    key={idx}
                    className={`play-history-tab ${activeHistoryTab === idx ? 'play-history-tab--active' : ''}`}
                    onClick={() => setActiveHistoryTab(idx)}
                    type="button"
                  >
                    Essai {idx + 1}
                  </button>
                ))}
              </div>
              {/* Panneau unifié */}
              <div className="play-history-panel">
                <div className="play-feedback-rows">
                  <div className="play-feedback-row">
                    <div className="play-feedback-dot play-feedback-dot--correct" />
                    <span className="play-feedback-count">{attemptHistory[activeHistoryTab].correctFull}</span>
                    <span>bien placé et orienté</span>
                  </div>
                  <div className="play-feedback-row">
                    <div className="play-feedback-dot play-feedback-dot--rotation" />
                    <span className="play-feedback-count">{attemptHistory[activeHistoryTab].correctRotation}</span>
                    <span>bien placé, mal orienté</span>
                  </div>
                  <div className="play-feedback-row">
                    <div className="play-feedback-dot play-feedback-dot--wrong" />
                    <span className="play-feedback-count">{attemptHistory[activeHistoryTab].neither}</span>
                    <span>mal placé</span>
                  </div>
                </div>
                <div className="play-feedback-divider" />
                <div className="play-mini-grid-center">
                  <StaticMiniGrid placements={attemptHistory[activeHistoryTab].placements} clues={clues} />
                </div>
              </div>
            </div>
          )}
        </aside>

        <DragOverlay dropAnimation={null}>
          {activeCard && (
            <WordCard
              id="overlay"
              card={activeCard.card}
              rotation={activeCard.rotation}
              colorIndex={activeCard.colorIndex ?? 0}
              draggable={false}
            />
          )}
        </DragOverlay>
      </DndContext>

      <footer className="play-footer">
        <button
          className="btn-primary play-footer-submit"
          onClick={handleSubmit}
          disabled={!allPlaced || isSubmitting}
        >
          {isSubmitting ? '…' : (allPlaced ? 'Soumettre' : `Placez toutes les cartes (${trayCards.length} restante${trayCards.length > 1 ? 's' : ''})`)}
        </button>
        <Link to="/hub" className="btn-secondary play-footer-hub">Retour au Hub</Link>
      </footer>
    </div>
  )
}
