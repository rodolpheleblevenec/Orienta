import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import confetti from 'canvas-confetti'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { computeScore, computeXp, xpStreakBonus } from '../../lib/scoring'
import { getLevelFromXp } from '../../lib/levels'
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
    anchor: 'targets-center',
    targets: ['.clue--top', '.clue--right', '.clue--bottom', '.clue--left'],
    zone: 'Grille centrale',
    title: 'Lis les indices',
    description: "Les 4 mots autour de la grille sont les indices du créateur. Ils t'indiquent quelle carte va dans quel emplacement — et dans quel sens !",
  },
  {
    anchor: 'tray-right',
    target: '.play-tray-drawer',
    zone: 'Réserve',
    title: 'Glisse et oriente les cartes',
    description: "Glisse les cartes depuis la réserve vers les 4 emplacements. Chaque carte a un mot sur chacune de ses faces — tourne-la (↻) pour que les mots pointent vers les bons indices. L'orientation compte autant que la position.",
  },
  {
    anchor: 'footer-center',
    target: '.play-submit-btn',
    zone: 'Bouton Soumettre',
    title: 'Soumets et observe',
    description: "Tu as 3 essais. Après chaque tentative : vert = bon emplacement et bonne orientation · orange = bonne orientation, mauvais emplacement · rouge = ni l'un ni l'autre.",
  },
]
import CloverGrid from '../../components/game/CloverGrid'
import WordCard from '../../components/game/WordCard'

const MAX_ATTEMPTS = 3

// Pluie de trèfles 🍀 — célébration légère d'une victoire en mode rejeu
function rainCloversBurst() {
  const clover = confetti.shapeFromText ? confetti.shapeFromText({ text: '🍀', scalar: 2.4 }) : undefined
  const opts = clover
    ? { shapes: [clover], scalar: 2.4, particleCount: 26, spread: 70, startVelocity: 38, ticks: 220, gravity: 1, origin: { y: 0.55 } }
    : { particleCount: 90, spread: 70, origin: { y: 0.6 } }
  confetti(opts)
  setTimeout(() => confetti(opts), 220)
}

// Réserve « droppable » : on peut y ramener une carte depuis la grille
function TrayDropZone({ empty, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'tray' })
  return (
    <aside
      ref={setNodeRef}
      className={[
        'play-tray-drawer',
        empty ? 'play-tray-drawer--empty' : '',
        isOver ? 'play-tray-drawer--over' : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
    </aside>
  )
}

export default function PlayPage() {
  const { gridId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, refreshUser, markTourDone } = useAuthStore()

  const challengeFrom = searchParams.get('from')
  const challengeScore = searchParams.get('score')
  const [challengeDismissed, setChallengeDismissed] = useState(false)

  // Mode rejeu : on rejoue une grille déjà terminée « juste pour le fun ».
  // Aucune écriture en base, aucun XP, aucun commentaire.
  const isReplay = searchParams.get('replay') === '1'
  const [replayResult, setReplayResult] = useState(null) // 'won' | 'lost' | null

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
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const [isSwappingSlots, setIsSwappingSlots] = useState(false)
  const [configTooltipOpen, setConfigTooltipOpen] = useState(false)
  const [tileTooltipOpen, setTileTooltipOpen] = useState(false)

  useEffect(() => {
    if (!configTooltipOpen && !tileTooltipOpen) return
    const close = () => { setConfigTooltipOpen(false); setTileTooltipOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [configTooltipOpen, tileTooltipOpen])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  const startTimeRef = useRef(null)
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

      if (existingPlay?.completed_at && !isReplay) {
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

      const arr = [...(gridCards ?? [])]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
      }
      const ROTATIONS = [0, 90, 180, 270]
      const shuffled = arr.map((gc, i) => ({
        card: gc.orienta_word_cards,
        rotation: ROTATIONS[Math.floor(Math.random() * 4)],
        colorIndex: i,
      }))
      setTrayCards(shuffled)
      startTimeRef.current = Date.now()

      const cardMap = new Map(shuffled.map(({ card, colorIndex }) => [card.id, { card, colorIndex }]))

      if (isReplay) {
        // Mode rejeu : partie neuve, on n'écrit rien et on ne restaure
        // aucun historique. playId reste null.
      } else if (existingPlay) {
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
  }, [gridId, user, navigate, isReplay])

  useEffect(() => {
    if (!user?.id) return
    if (!user.tour_play_done) setShowTour(true)
  }, [user?.id])

  useEffect(() => {
    if (gameOver) return
    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [gameOver])

  function handleReset() {
    const placed = Object.values(placements).filter(Boolean)
    if (!placed.length) return
    setTrayCards(prev => [...prev, ...placed])
    setPlacements({ 0: null, 1: null, 2: null, 3: null })
  }

  // Mode rejeu : relance une partie neuve avec les mêmes cartes, rebattues.
  function restartReplay() {
    const all = [...trayCards, ...Object.values(placements).filter(Boolean)]
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]]
    }
    const ROTATIONS = [0, 90, 180, 270]
    setTrayCards(all.map((it, i) => ({
      card: it.card,
      rotation: ROTATIONS[Math.floor(Math.random() * 4)],
      colorIndex: i,
    })))
    setPlacements({ 0: null, 1: null, 2: null, 3: null })
    setAttemptHistory([])
    setActiveHistoryTab(0)
    setAttemptNumber(1)
    setAttemptsFailed(0)
    setFeedbackOpen(false)
    setGameOver(false)
    setReplayResult(null)
    startTimeRef.current = Date.now()
    setElapsed(0)
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

    // Drop sur la réserve : une carte de la grille y retourne
    if (over.id === 'tray') {
      for (const [pos, item] of Object.entries(placements)) {
        if (item && `placed-${item.card.id}-${pos}` === active.id) {
          setPlacements(prev => ({ ...prev, [pos]: null }))
          setTrayCards(prev => [...prev, item])
          return
        }
      }
      return
    }

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
      // Rotation cumulative (90→180→270→360…) pour toujours tourner en avant ;
      // on normalise (% 360) seulement à la soumission.
      return { ...prev, [pos]: { ...item, rotation: item.rotation + 90 } }
    })
  }

  function handleTrayRotate(cardId) {
    setTrayCards(prev => prev.map(c =>
      c.card.id === cardId ? { ...c, rotation: (c.rotation ?? 0) + 90 } : c
    ))
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setSubmitError(false)

    const answer = Object.entries(placements)
      .filter(([, v]) => v)
      .map(([pos, { card, rotation }]) => ({
        card_id: card.id,
        position: parseInt(pos, 10),
        rotation: ((rotation % 360) + 360) % 360,
      }))

    const { data: result, error } = await supabase.functions.invoke('check-attempt', {
      body: isReplay
        ? { grid_id: gridId, attempt_number: attemptNumber, answer, replay: true }
        : { play_id: playId, attempt_number: attemptNumber, answer },
    })

    if (error || !result) {
      setIsSubmitting(false)
      setSubmitError(true)
      return
    }

    const { correctFull, correctRotation, neither, success: won } = result

    // En mode rejeu, on n'enregistre aucune tentative en base.
    if (!isReplay) {
      await supabase.from('orienta_play_attempts').insert({
        play_id: playId,
        attempt_number: attemptNumber,
        answer,
        correct_full: correctFull,
        correct_rotation: correctRotation,
        neither,
      })
    }

    const placementsSnapshot = { ...placements }
    setAttemptHistory(prev => {
      const next = [...prev, { correctFull, correctRotation, neither, placements: placementsSnapshot }]
      setActiveHistoryTab(next.length - 1)
      setFeedbackOpen(true)
      return next
    })

    // Mode rejeu : aucun XP, aucune écriture, on reste sur la page.
    if (isReplay) {
      if (won) {
        rainCloversBurst()
        setGameOver(true)
        setReplayResult('won')
      } else {
        const next = attemptNumber + 1
        setAttemptNumber(next)
        setAttemptsFailed(f => f + 1)
        setIsSubmitting(false)
        if (next > MAX_ATTEMPTS) {
          setGameOver(true)
          setReplayResult('lost')
        }
      }
      return
    }

    if (won) {
      const finalScore = computeScore(elapsed, attemptsFailed)
      const baseXp = computeXp(finalScore, true)
      const bonusXp = xpStreakBonus(user.streak_current)
      const totalXp = baseXp + bonusXp
      const oldLevel = getLevelFromXp(user.xp || 0).level
      await supabase.from('orienta_plays').update({
        completed_at: new Date().toISOString(),
        time_seconds: elapsed,
        attempts_count: attemptNumber,
        success: true,
        score: finalScore,
        xp_earned: totalXp,
      }).eq('id', playId)
      await supabase.rpc('award_xp_on_play', { p_grid_id: gridId, p_player_id: user.id, p_success: true, p_streak_bonus: bonusXp })
      await refreshUser()
      const freshUser = useAuthStore.getState().user
      const newLevelData = getLevelFromXp(freshUser?.xp || 0)
      if (newLevelData.level > oldLevel) {
        await supabase.from('orienta_notifications').insert({
          user_id: user.id,
          type: 'level_up',
          payload: { level: newLevelData.level, level_name: newLevelData.name },
        })
        useAuthStore.getState().fetchNotifCount()
      }
      setGameOver(true)
      navigate(`/result/${gridId}`, { state: { score: finalScore, xp: totalXp, success: true, baseXp, bonusXp, timeSeconds: elapsed, attemptCount: attemptNumber, streakCurrent: user.streak_current, justPlayed: true } })
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
        await supabase.rpc('award_xp_on_play', { p_grid_id: gridId, p_player_id: user.id, p_success: false, p_streak_bonus: 0 })
        await refreshUser()
        setGameOver(true)
        navigate(`/result/${gridId}`, { state: { score: 0, xp: participationXp, success: false, justPlayed: true } })
      } else {
        // Mise à jour intermédiaire : Hub affiche le bon nb d'essais en cours
        supabase.from('orienta_plays').update({ attempts_count: attemptNumber }).eq('id', playId)
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

        {/* ── Drawer gauche — réserve ── */}
        <TrayDropZone empty={trayCards.length === 0}>
          <div className="tray-header">
            <span className="tray-header-label">Réserve</span>
            <span className="tray-header-count">{trayCards.length} carte{trayCards.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="tray-cards">
            {trayCards.map(({ card, rotation, colorIndex }) => (
              <div key={card.id} className="card-tray-item">
                <WordCard
                  id={`tray-${card.id}`}
                  card={card}
                  rotation={rotation ?? 0}
                  colorIndex={colorIndex ?? 0}
                  onRotate={() => handleTrayRotate(card.id)}
                  draggable
                />
              </div>
            ))}
          </div>
        </TrayDropZone>

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
          {isReplay && !replayResult && (
            <div className="replay-banner" role="status">
              <svg className="replay-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Mode rejeu — juste pour le fun, aucun XP en jeu</span>
            </div>
          )}
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
        <aside className={[
          'play-feedback-drawer',
          attemptHistory.length === 0 ? 'play-feedback-drawer--collapsed' : '',
          attemptHistory.length > 0 && !feedbackOpen ? 'play-feedback-drawer--hidden' : '',
        ].filter(Boolean).join(' ')}>
          {attemptHistory.length > 0 && (
            <div className="play-history">
              {/* Onglets essais + croix (pas de header séparé) */}
              <div className="play-history-tabs">
                {[0, 1, 2].map(idx => {
                  const played = idx < attemptHistory.length
                  const isActive = activeHistoryTab === idx
                  return (
                    <button
                      key={idx}
                      className={`play-history-tab ${isActive ? 'play-history-tab--active' : ''} ${!played ? 'play-history-tab--locked' : ''}`}
                      onClick={() => played && setActiveHistoryTab(idx)}
                      type="button"
                      disabled={!played}
                    >
                      Essai {idx + 1}
                    </button>
                  )
                })}
                <button className="play-feedback-close" onClick={() => setFeedbackOpen(false)} type="button" aria-label="Fermer">✕</button>
              </div>

              {/* Scorecard — 3 cartes verticales */}
              <div className="pfd-tiles">
                <div className="pfd-tile pfd-tile--green">
                  <span className="pfd-tile-num">{attemptHistory[activeHistoryTab].correctFull}</span>
                  <div className="pfd-tile-content">
                    <div className="pfd-tile-title-row">
                      <span className="pfd-tile-dot" />
                      <span className="pfd-tile-title">Bien placé{attemptHistory[activeHistoryTab].correctFull !== 1 ? 's' : ''} et orienté{attemptHistory[activeHistoryTab].correctFull !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="pfd-tile-subtitle">Bon emplacement et bonne orientation</span>
                  </div>
                </div>

                <div className="pfd-tile pfd-tile--orange">
                  <span className="pfd-tile-num">{attemptHistory[activeHistoryTab].correctRotation}</span>
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
                  <span className="pfd-tile-num">{attemptHistory[activeHistoryTab].neither}</span>
                  <div className="pfd-tile-content">
                    <div className="pfd-tile-title-row">
                      <span className="pfd-tile-dot" />
                      <span className="pfd-tile-title">À revoir</span>
                    </div>
                    <span className="pfd-tile-subtitle">Ni le bon emplacement, ni la bonne orientation</span>
                  </div>
                </div>
              </div>

              {/* « Ta configuration » — mini-grille de l'essai */}
              <div className="pfd-config-section">
                <div className="pfd-config-header">
                  <span className="pfd-config-label">Ta configuration</span>
                  <button
                    className="pfd-config-info-btn"
                    type="button"
                    onClick={e => { e.stopPropagation(); setConfigTooltipOpen(v => !v) }}
                    aria-label="En savoir plus"
                  >ⓘ
                    {configTooltipOpen && (
                      <span className="pfd-custom-tooltip">
                        On t'indique <strong>combien</strong> de cartes sont bien placées — à toi de deviner lesquelles&nbsp;!
                      </span>
                    )}
                  </button>
                </div>
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

      {attemptHistory.length > 0 && !feedbackOpen && (
        <button className="play-feedback-reopen" onClick={() => setFeedbackOpen(true)} type="button">
          <span className="pfr-text">Feedback</span>
          <span className="pfr-badge">{attemptHistory.length}</span>
        </button>
      )}

      {challengeFrom && challengeScore && !challengeDismissed && (
        <div className="challenge-banner">
          <span>🍀 <strong>{challengeFrom}</strong> te défie — bats ses <strong>{parseInt(challengeScore).toLocaleString()} pts</strong> !</span>
          <button className="challenge-banner-close" onClick={() => setChallengeDismissed(true)} type="button">✕</button>
        </div>
      )}


      {replayResult && (
        <div className="replay-end-overlay">
          <div className="replay-end-card">
            <div className="replay-end-icon">{replayResult === 'won' ? '🍀' : '🙂'}</div>
            <h2 className="replay-end-title">
              {replayResult === 'won' ? 'Rejoué avec brio !' : 'Bien tenté !'}
            </h2>
            <p className="replay-end-sub">
              {replayResult === 'won'
                ? 'Juste pour le plaisir — rien n’a été enregistré.'
                : 'C’était juste pour le fun. Tu peux retenter ta chance.'}
            </p>
            <div className="replay-end-actions">
              <button className="replay-end-btn replay-end-btn--primary" onClick={restartReplay} type="button">
                🔁 Rejouer
              </button>
              <Link to={`/result/${gridId}`} className="replay-end-btn replay-end-btn--ghost">
                Retour aux résultats
              </Link>
            </div>
          </div>
        </div>
      )}

      <footer className="play-footer">
        {submitError && (
          <p className="play-submit-error">Erreur réseau — réessaie.</p>
        )}

        {/* Gauche : chip essai + chrono */}
        <div className="play-footer-left">
          <div className="play-attempt-chip">
            <span className="pac-label">Essai</span>
            <span className="pac-num">{attemptNumber}/{MAX_ATTEMPTS}</span>
            <span className="pac-dots">
              {[0, 1, 2].map(i => (
                <span key={i} className={`pac-dot${i < attemptNumber - 1 ? ' pac-dot--used' : i === attemptNumber - 1 ? ' pac-dot--active' : ''}`} />
              ))}
            </span>
          </div>
          <span className="play-chrono">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </span>
        </div>

        {/* Centre : bouton à états */}
        <button
          className={`play-submit-btn${allPlaced ? ' play-submit-btn--ready' : ''}`}
          onClick={handleSubmit}
          disabled={!allPlaced || isSubmitting}
        >
          {isSubmitting ? '…' : (allPlaced ? 'Valider l\'essai' : `${trayCards.length} carte${trayCards.length > 1 ? 's' : ''} à placer`)}
        </button>

        {/* Droite : retour hub */}
        <div className="play-footer-right">
          <Link to="/hub" className="play-footer-hub-btn">Retour au Hub</Link>
        </div>
      </footer>

      {showTour && (
        <TourOverlay
          steps={PLAY_TOUR_STEPS}
          onDone={() => {
            markTourDone('tour_play_done')
            setShowTour(false)
          }}
        />
      )}
    </div>
  )
}
