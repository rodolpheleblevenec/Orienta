import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import { sample } from '../../lib/shuffle'
import Header from '../../components/ui/Header'
import TourOverlay from '../../components/ui/TourOverlay'

// 'YYYY-MM-DD' → 'lundi 14 juin' (date cible d'un grant)
function formatDailyDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const CREATE_PLACEMENT_STEPS = [
  {
    anchor: 'center',
    title: 'Crée ta grille',
    description: "Tu vas recevoir 4 cartes aléatoires à disposer sur la grille, puis écrire 4 indices pour que tes collègues la résolvent.",
  },
  {
    anchor: 'tray-right',
    target: '.play-tray-drawer',
    zone: 'Réserve',
    title: 'Reçois tes 4 cartes',
    description: "L'app te distribue 4 cartes aléatoires. Chaque carte a un mot différent sur chacun de ses 4 bords. En mode Difficile, une 5e carte reste en réserve : c'est le leurre pour les joueurs !",
  },
  {
    anchor: 'center-left',
    target: '.play-grid-area',
    zone: 'Grille 2×2',
    title: 'Arrange comme tu veux',
    description: "Glisse les cartes vers les 4 emplacements et oriente-les (↻). Tourne chaque carte jusqu'à ce que les mots adjacents créent une connexion intéressante — c'est toi qui décides de la solution finale !",
  },
]

const CREATE_CLUES_STEPS = [
  {
    anchor: 'targets-center',
    targets: [
      '.clue-input--top', '.clue-input--bottom',
      '.clue-input--left', '.clue-input--right',         // desktop
      '.clue-side-btn--left', '.clue-side-btn--right',   // mobile
    ],
    zone: 'Grille et indices',
    title: 'Écris tes 4 indices',
    description: "Un indice par bord de la grille. Il doit relier les deux mots qui se font face — les deux en même temps, pas juste l'un des deux.",
  },
  {
    anchor: 'center',
    zone: '⚠ Règle importante',
    title: 'Anticipe avant le timer',
    description: "Le chrono de 90 secondes démarre dès que tu vois ta grille. Anticipe tes indices avant de lancer ! Évite aussi les dérivés directs — le jeu te préviendra si ton indice reprend un mot des cartes.",
  },
  {
    anchor: 'footer-center',
    target: '.play-submit-btn',
    zone: 'Bouton Publier',
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

// Réserve « droppable » : on peut y ramener une carte depuis la grille (phase placement)
function TrayDropZone({ empty, disabled, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'tray', disabled })
  return (
    <aside
      ref={setNodeRef}
      className={[
        'play-tray-drawer',
        empty ? 'play-tray-drawer--empty' : '',
        isOver && !disabled ? 'play-tray-drawer--over' : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
    </aside>
  )
}

export default function CreatePage() {
  const navigate = useNavigate()
  const { user, refreshUser, markTourDone } = useAuthStore()

  // Mode « grant » : le gagnant d'un jour crée la grille du jour de J+3 (?grant=ID).
  const [searchParams] = useSearchParams()
  const grantId = searchParams.get('grant')
  const grantMode = !!grantId
  const [grant, setGrant] = useState(null)
  const [grantInvalid, setGrantInvalid] = useState(false)

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
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState(false)
  const [published, setPublished] = useState(false)
  const startTimeRef = useRef(null)
  const timerRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  // Charge + valide le grant (mode gagnant). Date verrouillée, toutes difficultés débloquées.
  useEffect(() => {
    if (!grantId || !user) return
    supabase.from('orienta_grid_grants')
      .select('id, target_date, status, winner_user_id')
      .eq('id', grantId)
      .maybeSingle()
      .then(({ data }) => {
        const todayParis = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })
        if (!data || data.winner_user_id !== user.id || data.status !== 'pending' || data.target_date <= todayParis) {
          setGrantInvalid(true)
        } else {
          setGrant(data)
        }
      })
  }, [grantId, user])

  useEffect(() => {
    if (!user) return
    // Mode grant : pas de quota communautaire, toutes les difficultés sont ouvertes.
    if (grantMode) { setUnlockedDifficulties(['facile', 'moyen', 'difficile']); return }

    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      supabase.from('orienta_grids')
        .select('id')
        .eq('creator_id', user.id)
        .is('daily_date', null)
        .is('daily_status', null)
        .gte('created_at', today + 'T00:00:00'),
      supabase.from('orienta_grids')
        .select('difficulty')
        .eq('creator_id', user.id)
        .is('daily_date', null)
        .is('daily_status', null)
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
  }, [user, grantMode])

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
    supabase.from('orienta_word_cards').select('*').limit(1000)
      .then(({ data }) => {
        if (!data) return
        const cardCount = difficulty === 'difficile' ? 5 : 4
        const shuffled = sample(data, cardCount)
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

    // Drop sur la réserve : une carte de la grille y retourne (phase placement uniquement)
    if (over.id === 'tray') {
      if (phase !== 'placement') return
      for (const [pos, item] of Object.entries(placements)) {
        if (item && `placed-${item.card.id}-${pos}` === active.id) {
          setPlacements(prev => ({ ...prev, [pos]: null }))
          setTrayCards(prev => [...prev, item])
          return
        }
      }
      return
    }

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
      // Rotation cumulative ; normalisée (% 360) à la publication.
      return { ...prev, [pos]: { ...item, rotation: item.rotation + 90 } }
    })
  }

  function handleTrayRotate(cardId) {
    setTrayCards(prev => prev.map(c =>
      c.card.id === cardId ? { ...c, rotation: (c.rotation ?? 0) + 90 } : c
    ))
  }

  async function publishGrid(usedTime) {
    if (publishing) return
    setPublishing(true)
    setPublishError(false)
    const creatorTime = difficulty === 'facile' ? null : usedTime ?? (TIMER_DURATION - timeLeft)

    const gridPlacements = Object.entries(placements)
      .filter(([, v]) => v)
      .map(([pos, { card, rotation }]) => ({
        card_id: card.id,
        position: parseInt(pos),
        rotation: ((rotation % 360) + 360) % 360,
      }))

    const decoyCardId = (difficulty === 'difficile' && trayCards.length === 1)
      ? trayCards[0].card.id
      : null

    // Création serveur (validations + écritures côté Edge Function)
    const { data, error } = await supabase.functions.invoke('create-grid', {
      body: {
        user_id: user.id,
        difficulty,
        clues: { top: clues.top, right: clues.right, bottom: clues.bottom, left: clues.left },
        placements: gridPlacements,
        decoy_card_id: decoyCardId,
        creator_time_seconds: creatorTime,
        grant_id: grant?.id ?? null,
      },
    })

    if (error || !data || data.error) {
      console.error('create-grid error:', error || data?.error)
      setPublishError(true)
      setPublishing(false)
      return
    }

    await refreshUser()
    setPublished(true)
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
    if (user && !user.tour_create_placement_done) {
      setShowPlacementTour(true)
    } else {
      setTourFinished(true)
    }
  }

  // Grille du jour (mode grant) : difficulté imposée = facile, directement, sans pop-in de choix.
  useEffect(() => {
    if (grantMode && grant && !difficulty) {
      handleSelectDifficulty('facile')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grantMode, grant, difficulty])

  useEffect(() => {
    if (phase !== 'clues' || !user?.id) return
    if (!user.tour_create_clues_done) {
      setShowCluesTour(true)
      setTourFinished(false)
    } else {
      setTourFinished(true)
    }
  }, [phase, user?.id])

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

  return (
    <div className="create-page">
      <Header />

      {/* ── Modal de difficulté — création COMMUNAUTAIRE uniquement ──
          (Grille du jour / mode grant : pas de choix, difficulté = facile imposée, aucune pop-in.) */}
      {showDifficultyModal && !grantMode && (
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
                    { id: 'facile',    name: 'Facile',    desc: 'Temps illimité · 4 cartes' },
                    { id: 'moyen',     name: 'Moyen',     desc: '90 secondes · 4 cartes', lockMsg: 'Crée une grille Facile pour débloquer' },
                    { id: 'difficile', name: 'Difficile', desc: '90 secondes · 5 cartes (1 leurre)', lockMsg: 'Crée une grille Moyen pour débloquer' },
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

      {/* Grille du jour (gagnant) : droit invalide → message d'erreur dédié */}
      {grantInvalid && (
        <div className="difficulty-modal-backdrop">
          <div className="difficulty-modal">
            <h2 className="difficulty-modal-title">Droit de création expiré</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Ce droit de création n'est plus valable (déjà utilisé, ou la date est dépassée).
            </p>
            <button className="btn-primary" onClick={() => navigate('/hub')} style={{ width: '100%' }}>
              Retour au Hub
            </button>
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
        <TrayDropZone empty={allPlaced} disabled={phase !== 'placement' || expired}>
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
          {!expired && !published && (
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
          {grant && !published && !expired && !missedCreation && (
            <div className="create-grant-bar">
              🏆 Tu crées la <strong>grille du jour</strong> du {formatDailyDate(grant.target_date)}
            </div>
          )}
          <div className="play-grid-area">
            {(grantMode && !grantInvalid && !difficulty) ? (
              <div className="create-expired create-expired--success">
                <p className="create-expired-title">Préparation de ta grille du jour…</p>
              </div>
            ) : published ? (
              <div className="create-expired create-expired--success">
                <div className="create-expired-icon">{grantMode ? '🏆' : '🎉'}</div>
                {grantMode ? (
                  <>
                    <p className="create-expired-title">Ta grille du jour est programmée !</p>
                    <p className="create-expired-text">Elle sera <strong>la grille du jour du {formatDailyDate(grant?.target_date)}</strong>, jouée par toute la communauté. Merci d'avoir relevé le défi&nbsp;!</p>
                  </>
                ) : (
                  <>
                    <p className="create-expired-title">Bravo, ta grille est créée !</p>
                    <p className="create-expired-text">Ta grille a été publiée. Les autres joueurs peuvent maintenant la résoudre — tu gagneras de l'XP à chaque réussite.</p>
                  </>
                )}
                <button className="btn-primary" onClick={() => navigate('/hub')}>Retour au Hub</button>
              </div>
            ) : missedCreation ? (
              <div className="create-expired">
                <div className="create-expired-icon">⌛</div>
                <p className="create-expired-title">Grille non publiée</p>
                <p className="create-expired-text">Tu n'as pas rempli tous les indices à temps. Tu ne pourras plus créer de grille aujourd'hui. Reviens demain !</p>
                <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au Hub</button>
              </div>
            ) : expired && publishError ? (
              <div className="create-expired">
                <div className="create-expired-icon">⏰</div>
                <p className="create-expired-title">La publication a échoué</p>
                <p className="create-expired-text">Le temps est écoulé et ta grille n'a pas pu être enregistrée. Pas de panique, réessaie !</p>
                <div className="create-expired-actions">
                  <button className="btn-primary" onClick={() => window.location.reload()}>Réessayer</button>
                  <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au Hub</button>
                </div>
              </div>
            ) : expired ? (
              <div className="create-expired create-expired--success">
                <div className="create-expired-icon">⏳</div>
                <p className="create-expired-title">Publication en cours…</p>
                <p className="create-expired-text">On enregistre ta grille, un instant.</p>
              </div>
            ) : phase === 'clues' ? (
              <CloverWithInputs
                placements={placements}
                clues={clues}
                setClues={setClues}
                onRotate={handleRotate}
                draggable
              />
            ) : (
              <CloverGrid
                placements={placements}
                directional
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
              {/* En-tête sticky */}
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

              {/* Timer (moyen / difficile) */}
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
        {/* Gauche : phase ou timer */}
        <div className="play-footer-left">
          {showTimer && !expired && !missedCreation && !published ? (
            <div className="play-attempt-chip">
              <span className="pac-label">Chrono</span>
              <span className="pac-num" style={{ color: timerColor }}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
            </div>
          ) : (
            <span className="play-footer-hint">
              {phase === 'placement'
                ? (allPlaced ? 'Passe aux indices →' : `Place toutes les cartes (${placedCount}/4)`)
                : null}
            </span>
          )}
        </div>

        {/* Centre : bouton publier */}
        {!expired && !published && phase === 'clues' && (
          <div className="create-publish-wrap">
            {publishError && (
              <p className="play-submit-error">La publication a échoué — réessaie.</p>
            )}
            <button
              className={`play-submit-btn${allCluesFilled && !hasClueConflict ? ' play-submit-btn--ready' : ''}`}
              onClick={handleSubmit}
              disabled={!allCluesFilled || hasClueConflict || publishing}
            >
              {publishing ? 'Publication…' : !allCluesFilled ? 'Remplis les 4 indices' : hasClueConflict ? 'Mot interdit dans un indice' : 'Publier ma grille'}
            </button>
          </div>
        )}
        {(!expired && phase === 'placement') && <div />}

        {/* Droite : retour hub */}
        <div className="play-footer-right">
          {showTimer && !expired && !missedCreation && !published
            ? <button className="play-footer-hub-btn" onClick={() => setShowExitWarning(true)} type="button">Retour au Hub</button>
            : <Link to="/hub" className="play-footer-hub-btn">Retour au Hub</Link>
          }
        </div>
      </footer>

      {showPlacementTour && (
        <TourOverlay
          steps={CREATE_PLACEMENT_STEPS}
          onDone={() => {
            markTourDone('tour_create_placement_done')
            setShowPlacementTour(false)
            setTourFinished(true)
          }}
        />
      )}
      {showCluesTour && (
        <TourOverlay
          steps={difficulty === 'facile' ? CREATE_CLUES_STEPS.filter(s => s.zone !== '⚠ Règle importante') : CREATE_CLUES_STEPS}
          onDone={() => {
            markTourDone('tour_create_clues_done')
            setShowCluesTour(false)
            setTourFinished(true)
          }}
        />
      )}
    </div>
  )
}
