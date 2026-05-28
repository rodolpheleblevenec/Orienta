import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { XP_CREATE } from '../../lib/scoring'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import Header from '../../components/ui/Header'
import TourOverlay from '../../components/ui/TourOverlay'

const CREATE_PLACEMENT_STEPS = [
  {
    anchor: 'center',
    title: 'Crée ta grille',
    description: "Tu vas placer des cartes dans une grille en trèfle, puis écrire 4 indices pour que d'autres joueurs la résolvent.",
  },
  {
    anchor: 'center-right',
    zone: '← Plateau de cartes',
    title: 'Tes cartes disponibles',
    description: "Glisse les cartes depuis le plateau gauche vers les 4 emplacements. En mode Difficile, une 5e carte reste en réserve — c'est le leurre pour les joueurs !",
  },
  {
    anchor: 'center-right',
    zone: '← Bouton ↻ sur la carte',
    title: 'Oriente les cartes',
    description: "Utilise ↻ pour tourner chaque carte. La position d'un mot dans la carte correspond au côté de la grille — et donc à l'indice que tu vas écrire.",
  },
]

const CREATE_CLUES_STEPS = [
  {
    anchor: 'center-right',
    zone: '← Champs d\'indices',
    title: 'Écris tes 4 indices',
    description: "Un indice par côté de la grille. Chaque indice doit évoquer la carte placée de ce côté — sans être trop évident pour les joueurs !",
  },
  {
    anchor: 'center',
    zone: '⚠ Règle importante',
    title: 'Mots interdits',
    description: "Ton indice ne peut pas être l'un des mots présents sur les cartes. Trop facile ! Le jeu te préviendra si tu essaies.",
  },
  {
    anchor: 'top-center',
    zone: '↓ Bouton Publier',
    title: 'Publie ta grille',
    description: "Quand tes 4 indices sont validés, publie ! Ta grille sera visible 48h et tu gagneras de l'XP pour chaque joueur qui la réussit.",
  },
]
import CloverGrid from '../../components/game/CloverGrid'
import CloverWithInputs from '../../components/game/CloverWithInputs'
import WordCard from '../../components/game/WordCard'

const TIMER_DURATION = 90

const CLUE_SIDES = [
  { key: 'top',    label: 'Haut' },
  { key: 'right',  label: 'Droite' },
  { key: 'bottom', label: 'Bas' },
  { key: 'left',   label: 'Gauche' },
]

export default function CreatePage() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuthStore()

  const [showDifficultyModal, setShowDifficultyModal] = useState(true)
  const [showExitWarning, setShowExitWarning] = useState(false)
  const [missedCreation, setMissedCreation] = useState(false)
  const [showPlacementTour, setShowPlacementTour] = useState(false)
  const [showCluesTour, setShowCluesTour] = useState(false)
  useBodyScrollLock(showDifficultyModal || showExitWarning)
  const [alreadyCreatedToday, setAlreadyCreatedToday] = useState(false)
  const [unlockedDifficulties, setUnlockedDifficulties] = useState(['facile'])
  const [phase, setPhase] = useState('placement')
  const [difficulty, setDifficulty] = useState(null)
  const [tourFinished, setTourFinished] = useState(false)
  const [placements, setPlacements] = useState({ 0: null, 1: null, 2: null, 3: null })
  const [trayCards, setTrayCards] = useState([])
  const [activeCard, setActiveCard] = useState(null)
  const [clues, setClues] = useState({ top: '', right: '', bottom: '', left: '' })
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION)
  const [expired, setExpired] = useState(false)
  const [isSwappingSlots, setIsSwappingSlots] = useState(false)
  const startTimeRef = useRef(null)
  const timerRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  useEffect(() => {
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      supabase.from('orienta_grids')
        .select('id')
        .eq('creator_id', user.id)
        .is('daily_date', null)
        .gte('created_at', today + 'T00:00:00'),
      supabase.from('orienta_grids')
        .select('difficulty')
        .eq('creator_id', user.id)
        .is('daily_date', null)
        .eq('status', 'published'),
    ]).then(([todayRes, allRes]) => {
      if (todayRes.data && todayRes.data.length > 0) setAlreadyCreatedToday(true)
      const allCreated = allRes.data ?? []
      const hasFacile = allCreated.some(g => g.difficulty === 'facile')
      const hasMoyen = allCreated.some(g => g.difficulty === 'moyen')
      const unlocked = ['facile']
      if (hasFacile) unlocked.push('moyen')
      if (hasMoyen) unlocked.push('difficile')
      setUnlockedDifficulties(unlocked)
    })
  }, [user])

  useEffect(() => {
    if (phase === 'difficulty' || difficulty === 'facile' || !tourFinished) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    if (phase === 'placement' && !startTimeRef.current) {
      startTimeRef.current = Date.now()
    }
    timerRef.current = setInterval(() => {
      const remaining = TIMER_DURATION - Math.floor((Date.now() - startTimeRef.current) / 1000)
      if (remaining <= 0) {
        setTimeLeft(0); setExpired(true); clearInterval(timerRef.current)
      } else {
        setTimeLeft(remaining)
      }
    }, 500)
    return () => clearInterval(timerRef.current)
  }, [phase, difficulty, tourFinished])

  useEffect(() => {
    if (phase !== 'placement' || !difficulty) return
    supabase.from('orienta_word_cards').select('*').limit(200)
      .then(({ data }) => {
        if (!data) return
        const cardCount = difficulty === 'difficile' ? 5 : 4
        const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, cardCount)
        setTrayCards(shuffled.map((card, i) => ({ card, rotation: 0, colorIndex: i })))
      })
  }, [phase, difficulty])

  useEffect(() => {
    const allSlotsOccupied = Object.values(placements).every(v => v !== null)
    if (phase === 'placement' && allSlotsOccupied) setPhase('clues')
  }, [placements, phase])

  function handleReset() {
    const placed = Object.values(placements).filter(Boolean)
    if (!placed.length) return
    setTrayCards(prev => [...prev, ...placed])
    setPlacements({ 0: null, 1: null, 2: null, 3: null })
    if (phase === 'clues') setPhase('placement')
  }

  function handleDragStart({ active }) {
    const fromTray = trayCards.find(c => `tray-${c.card.id}` === active.id)
    if (fromTray) { setActiveCard(fromTray); return }
    for (const [pos, item] of Object.entries(placements)) {
      if (item && `placed-${item.card.id}-${pos}` === active.id) {
        setActiveCard({ ...item, fromSlot: parseInt(pos) }); return
      }
    }
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null)
    if (!over || expired) return
    const targetSlot = parseInt(over.id.replace('slot-', ''), 10)
    if (isNaN(targetSlot)) return

    const trayIdx = trayCards.findIndex(c => `tray-${c.card.id}` === active.id)
    if (trayIdx !== -1) {
      const cardItem = trayCards[trayIdx]
      const existing = placements[targetSlot]
      setPlacements(prev => ({ ...prev, [targetSlot]: cardItem }))
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
        if (sourceSlot === targetSlot) return
        const existing = placements[targetSlot]
        setIsSwappingSlots(true)
        setPlacements(prev => ({ ...prev, [targetSlot]: item, [sourceSlot]: existing ?? null }))
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

  async function publishGrid(usedTime) {
    const creatorTime = difficulty === 'facile' ? null : usedTime ?? (TIMER_DURATION - timeLeft)

    const { data: grid, error: gridError } = await supabase.from('orienta_grids').insert({
      creator_id: user.id,
      status: 'published',
      difficulty,
      clue_top:    clues.top.trim(),
      clue_right:  clues.right.trim(),
      clue_bottom: clues.bottom.trim(),
      clue_left:   clues.left.trim(),
      creator_time_seconds: creatorTime,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    }).select().single()

    if (gridError || !grid) { console.error('Grid insert error:', gridError); return }

    const gridCardInserts = Object.entries(placements)
      .filter(([, v]) => v)
      .map(([pos, { card, rotation }]) => ({
        grid_id: grid.id, card_id: card.id,
        position: parseInt(pos), rotation,
      }))

    if (difficulty === 'difficile' && trayCards.length === 1) {
      gridCardInserts.push({ grid_id: grid.id, card_id: trayCards[0].card.id, position: -1, rotation: 0 })
    }

    await supabase.from('orienta_grid_cards').insert(gridCardInserts)
    await supabase.rpc('add_user_xp', { uid: user.id, amount: XP_CREATE[difficulty] })
    await refreshUser()
    navigate('/hub')
  }

  useEffect(() => {
    if (!expired || difficulty === 'facile') return
    if (allCluesFilled && !hasClueConflict) {
      publishGrid(TIMER_DURATION)
    } else {
      localStorage.setItem(`orienta_create_forfeit_${user?.id}`, new Date().toISOString().split('T')[0])
      setMissedCreation(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])

  async function handleSubmit() {
    if (expired || !difficulty) return
    if (!Object.values(clues).every(c => c.trim())) return
    if (hasClueConflict) return
    await publishGrid()
  }

  function handleSelectDifficulty(chosen) {
    setDifficulty(chosen)
    setShowDifficultyModal(false)
    setTourFinished(false)
    if (user && !localStorage.getItem(`orienta_tour_create_placement_${user.id}`)) {
      setShowPlacementTour(true)
    } else {
      setTourFinished(true)
    }
  }

  useEffect(() => {
    if (phase !== 'clues' || !user) return
    if (!localStorage.getItem(`orienta_tour_create_clues_${user.id}`)) {
      setShowCluesTour(true)
      setTourFinished(false)
    } else {
      setTourFinished(true)
    }
  }, [phase, user])

  const allCardWords = useMemo(() => {
    const fields = ['word_top', 'word_right', 'word_bottom', 'word_left']
    const cards = [
      ...trayCards.map(t => t.card),
      ...Object.values(placements).filter(Boolean).map(p => p.card),
    ]
    return new Set(cards.flatMap(card => fields.map(f => card[f]?.toLowerCase().trim()).filter(Boolean)))
  }, [trayCards, placements])

  const clueConflicts = Object.fromEntries(
    Object.entries(clues).map(([side, val]) => [
      side,
      val.trim() !== '' && allCardWords.has(val.toLowerCase().trim()),
    ])
  )
  const hasClueConflict = Object.values(clueConflicts).some(Boolean)

  const placedCount = Object.values(placements).filter(Boolean).length
  const allPlaced = trayCards.length === (difficulty === 'difficile' ? 1 : 0)
  const allCluesFilled = Object.values(clues).every(c => c.trim())
  const showTimer = difficulty && difficulty !== 'facile'
  const timerPct = showTimer ? (timeLeft / TIMER_DURATION) * 100 : 100
  const timerColor = timeLeft < 20 ? 'var(--coral)' : timeLeft < 45 ? 'var(--warning)' : 'var(--accent)'
  const dummyClues = { top: '—', right: '—', bottom: '—', left: '—' }

  return (
    <div className="create-page">
      <Header />

      {/* ── Modal de difficulté ── */}
      {showDifficultyModal && (
        <div className="difficulty-modal-backdrop">
          <div className="difficulty-modal">
            {alreadyCreatedToday ? (
              <>
                <h2 className="difficulty-modal-title">Limite quotidienne atteinte</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Tu as déjà créé une grille aujourd'hui. Reviens demain pour en créer une nouvelle !
                </p>
                <button className="btn-primary" onClick={() => navigate('/hub')} style={{ width: '100%' }}>
                  Retour au Hub
                </button>
              </>
            ) : (
              <>
                <h2 className="difficulty-modal-title">Quel niveau de difficulté ?</h2>
                <div className="difficulty-options">
                  {[
                    { id: 'facile',    name: 'Facile',    desc: 'Temps illimité — 4 cartes' },
                    { id: 'moyen',     name: 'Moyen',     desc: '90 secondes — 4 cartes', lockMsg: 'Crée une grille Facile pour débloquer' },
                    { id: 'difficile', name: 'Difficile', desc: '90 secondes — 5 cartes (1 leurre)', lockMsg: 'Crée une grille Moyen pour débloquer' },
                  ].map(d => {
                    const isLocked = !unlockedDifficulties.includes(d.id)
                    return (
                      <button key={d.id} className={`difficulty-card ${isLocked ? 'difficulty-card--locked' : ''}`} onClick={() => !isLocked && handleSelectDifficulty(d.id)} disabled={isLocked} type="button">
                        <div className="difficulty-name">{d.name}</div>
                        <div className="difficulty-desc">{isLocked ? d.lockMsg : d.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showExitWarning && (
        <div className="logout-modal-backdrop" onClick={() => setShowExitWarning(false)}>
          <div className="logout-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3>Abandonner la grille ?</h3>
            <p>Tu as choisi le mode <strong>{difficulty === 'moyen' ? 'Moyen' : 'Difficile'}</strong> avec chrono. Si tu quittes maintenant, ta grille est perdue et tu ne pourras plus en créer une autre aujourd'hui.</p>
            <div className="logout-modal-buttons">
              <button className="btn-secondary" onClick={() => setShowExitWarning(false)} type="button">Continuer</button>
              <button className="btn-primary" style={{ background: '#F0440A' }} onClick={() => { localStorage.setItem(`orienta_create_forfeit_${user?.id}`, new Date().toISOString().split('T')[0]); navigate('/hub') }} type="button">Quitter quand même</button>
            </div>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

        {/* ── Drawer gauche — réserve ── */}
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
          {!expired && phase === 'placement' && (
            <button
              className="btn-reset"
              onClick={handleReset}
              type="button"
              title="Remettre toutes les cartes dans la réserve"
              disabled={Object.values(placements).every(v => v === null)}
            >
              ↺ <span>Reset</span>
            </button>
          )}
          <div className="play-grid-area">
            {missedCreation ? (
              <div className="create-expired">
                <div className="create-expired-icon">⌛</div>
                <p className="create-expired-title">Grille non publiée</p>
                <p className="create-expired-text">Tu n'as pas rempli tous les indices à temps. Tu ne pourras plus créer de grille aujourd'hui — reviens demain !</p>
                <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au Hub</button>
              </div>
            ) : expired ? (
              <div className="create-expired">
                <div className="create-expired-icon">⏰</div>
                <p className="create-expired-title">Le temps est écoulé !</p>
                <p className="create-expired-text">Ta grille n'a pas été sauvegardée. Pas de panique, réessaie !</p>
                <div className="create-expired-actions">
                  <button className="btn-primary" onClick={() => window.location.reload()}>Réessayer</button>
                  <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au Hub</button>
                </div>
              </div>
            ) : phase === 'clues' ? (
              <CloverWithInputs
                placements={placements}
                clues={clues}
                setClues={setClues}
                onRotate={handleRotate}
                draggable={difficulty === 'difficile'}
              />
            ) : (
              <CloverGrid
                placements={placements}
                clues={dummyClues}
                onRotate={handleRotate}
                disableTransition={isSwappingSlots}
              />
            )}
          </div>
        </main>

        {/* ── Drawer droit — info création ── */}
        <aside className="play-feedback-drawer create-info-drawer">
          {!showDifficultyModal && !expired && (
            <div className="create-phase-panel">
              {showTimer && (
                <div className="create-timer-block">
                  <div className="timer-bar-track">
                    <motion.div
                      className="timer-bar-fill"
                      animate={{ width: `${timerPct}%`, backgroundColor: timerColor }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <span className="timer-value" style={{ color: timerColor }}>
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </span>
                </div>
              )}

              <div className="create-step-header">
                <span className="create-step-badge">
                  {phase === 'placement' ? 'Étape 1' : 'Étape 2'}
                </span>
                <p className="create-step-title">
                  {phase === 'placement'
                    ? `Place et oriente tes ${difficulty === 'difficile' ? '5' : '4'} cartes`
                    : 'Écris tes 4 indices'}
                </p>
              </div>

              {phase === 'placement' ? (
                <div className="create-placement-status">
                  <p className="create-status-hint">
                    Glisse les cartes dans la grille, oriente-les avec ↻
                  </p>
                  <div className="create-progress-dots">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`create-dot ${placements[i] ? 'create-dot--filled' : ''}`} />
                    ))}
                    <span className="create-dot-label">{placedCount} / 4</span>
                  </div>
                </div>
              ) : (
                <div className="create-clues-check">
                  {CLUE_SIDES.map(({ key, label }) => (
                    <div key={key} className={`create-clue-item ${clueConflicts[key] ? 'create-clue-item--conflict' : clues[key].trim() ? 'create-clue-item--done' : ''}`}>
                      <span className="create-clue-icon">{clueConflicts[key] ? '✕' : clues[key].trim() ? '✓' : '○'}</span>
                      <span className="create-clue-label">{label}</span>
                      {clues[key].trim() && (
                        <span className="create-clue-value">« {clues[key]} »</span>
                      )}
                      {clueConflicts[key] && (
                        <span className="create-clue-conflict-hint">mot interdit</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
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

      {/* ── Footer ── */}
      <footer className="play-footer">
        {!expired && phase === 'clues' && (
          <button
            className="btn-primary play-footer-submit"
            onClick={handleSubmit}
            disabled={!allCluesFilled || hasClueConflict}
          >
            {!allCluesFilled ? 'Remplis les 4 indices pour publier' : hasClueConflict ? 'Un indice est un mot des cartes' : 'Publier la grille'}
          </button>
        )}
        {!expired && phase === 'placement' && (
          <span className="play-footer-hint">
            {allPlaced ? 'Passe aux indices →' : `Place toutes les cartes (${placedCount}/4)`}
          </span>
        )}
        {showTimer && !expired && !missedCreation
          ? <button className="btn-secondary play-footer-hub" onClick={() => setShowExitWarning(true)} type="button">Retour au Hub</button>
          : <Link to="/hub" className="btn-secondary play-footer-hub">Retour au Hub</Link>
        }
      </footer>

      {showPlacementTour && (
        <TourOverlay
          steps={CREATE_PLACEMENT_STEPS}
          onDone={() => {
            localStorage.setItem(`orienta_tour_create_placement_${user.id}`, '1')
            setShowPlacementTour(false)
            setTourFinished(true)
          }}
        />
      )}
      {showCluesTour && (
        <TourOverlay
          steps={CREATE_CLUES_STEPS}
          onDone={() => {
            localStorage.setItem(`orienta_tour_create_clues_${user.id}`, '1')
            setShowCluesTour(false)
            setTourFinished(true)
          }}
        />
      )}
    </div>
  )
}
