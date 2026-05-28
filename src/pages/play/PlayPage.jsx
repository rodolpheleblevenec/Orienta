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
import TourOverlay from '../../components/ui/TourOverlay'

const PLAY_TOUR_STEPS = [
  {
    anchor: 'center',
    title: 'Bienvenue dans le jeu !',
    description: "Tu dois placer 4 cartes dans les bons emplacements de la grille, bien orientées. Les indices autour de la grille sont tes seuls repères.",
  },
  {
    anchor: 'tray-right',
    zone: '← Plateau de cartes',
    title: 'Tes cartes à jouer',
    description: "Glisse les cartes depuis le plateau gauche vers les emplacements de la grille. Chaque carte a 4 mots.",
  },
  {
    anchor: 'center-right',
    zone: '← Grille centrale',
    title: 'Lis les indices',
    description: "Les 4 mots autour de la grille sont les indices du créateur. Ils t'indiquent quelle carte va dans quel emplacement — et dans quel sens !",
  },
  {
    anchor: 'center',
    zone: 'Bouton ↻',
    title: 'Oriente les cartes',
    description: "Appuie sur ↻ pour tourner une carte. Le mot de la carte doit pointer dans la bonne direction pour correspondre à l'indice de ce côté.",
  },
  {
    anchor: 'footer-center',
    zone: '↓ Bouton Soumettre',
    title: 'Soumets et observe',
    description: "Une fois tes 4 cartes placées, soumets ta réponse. Tu as 3 essais. Après chaque essai : ✓ bien placée, ↻ mal orientée, ✗ mauvaise carte.",
  },
]
import CloverGrid from '../../components/game/CloverGrid'
import WordCard from '../../components/game/WordCard'

const MAX_ATTEMPTS = 3

export default function PlayPage() {
  const { gridId } = useParams()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuthStore()

  const [showTour, setShowTour] = useState(false)
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

      const cardMap = new Map(shuffled.map(({ card, colorIndex }) => [card.id, { card, colorIndex }]))

      if (existingPlay) {
        setPlayId(existingPlay.id)

        const { data: prevAttempts } = await supabase
          .from('orienta_play_attempts')
          .select('attempt_number, answer, correct_full, correct_rotation, neither')
          .eq('play_id', existingPlay.id)
          .order('attempt_number', { ascending: true })

        if (prevAttempts?.length > 0) {
          const history = prevAttempts.map(attempt => {
            const placements = {}
            attempt.answer.forEach(({ card_id, position, rotation }) => {
              const entry = cardMap.get(card_id)
              if (entry) placements[position] = { ...entry, rotation }
            })
            return {
              correctFull: attempt.correct_full,
              correctRotation: attempt.correct_rotation,
              neither: attempt.neither,
              placements,
            }
          })
          setAttemptHistory(history)
          setActiveHistoryTab(history.length - 1)
          setAttemptNumber(prevAttempts.length + 1)
          setAttemptsFailed(prevAttempts.length)
        }
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
    if (!user) return
    const key = `orienta_tour_play_${user.id}`
    if (!localStorage.getItem(key)) setShowTour(true)
  }, [user])

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

    await supabase.from('orienta_play_attempts').insert({
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
            <div className="play-history">
              <div className="play-history-tabs">
                <div className="play-tab-ghost" />
              </div>
              <div className="play-history-panel play-history-panel--ghost">
                <div className="play-feedback-rows">
                  {[
                    { cls: 'play-feedback-dot--correct', label: 'bien placé et orienté' },
                    { cls: 'play-feedback-dot--rotation', label: 'bien placé, mal orienté' },
                    { cls: 'play-feedback-dot--wrong', label: 'mal placé' },
                  ].map(({ cls, label }) => (
                    <div key={label} className="play-feedback-row play-feedback-row--ghost">
                      <div className={`play-feedback-dot ${cls}`} />
                      <span className="play-ghost-count" />
                      <span className="play-ghost-label" />
                    </div>
                  ))}
                </div>
                <div className="play-feedback-divider" />
                <div className="play-mini-grid-center">
                  <div className="play-ghost-minigrid" />
                </div>
              </div>
              <p className="play-ghost-caption">Soumets pour voir ton résultat</p>
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

      {showTour && (
        <TourOverlay
          steps={PLAY_TOUR_STEPS}
          onDone={() => {
            localStorage.setItem(`orienta_tour_play_${user.id}`, '1')
            setShowTour(false)
          }}
        />
      )}
    </div>
  )
}
