import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { XP_CREATE } from '../../lib/scoring'
import Header from '../../components/ui/Header'
import CloverGrid from '../../components/game/CloverGrid'
import CardTray from '../../components/game/CardTray'
import WordCard from '../../components/game/WordCard'

const TIMER_DURATION = 90 // chrono pour moyen/difficile

export default function CreatePage() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuthStore()

  const [showDifficultyModal, setShowDifficultyModal] = useState(true)
  const [alreadyCreatedToday, setAlreadyCreatedToday] = useState(false)
  const [phase, setPhase] = useState('placement') // 'placement' | 'clues'
  const [difficulty, setDifficulty] = useState(null) // 'facile' | 'moyen' | 'difficile'
  const [placements, setPlacements] = useState({ 0: null, 1: null, 2: null, 3: null })
  const [trayCards, setTrayCards] = useState([])
  const [activeCard, setActiveCard] = useState(null)
  const [clues, setClues] = useState({ top: '', right: '', bottom: '', left: '' })
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION)
  const [expired, setExpired] = useState(false)
  const startTimeRef = useRef(null)
  const timerRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  // Check if user already created a grid today
  useEffect(() => {
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    supabase.from('orienta_grids')
      .select('id')
      .eq('creator_id', user.id)
      .gte('created_at', today + 'T00:00:00')
      .then(({ data }) => {
        if (data && data.length > 0) setAlreadyCreatedToday(true)
      })
  }, [user])

  // Chrono démarre seulement si pas en phase 'difficulty' et si la difficulté n'est pas 'facile'
  useEffect(() => {
    if (phase === 'difficulty' || difficulty === 'facile') {
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
  }, [phase, difficulty])

  useEffect(() => {
    if (phase !== 'placement' || !difficulty) return

    supabase.from('orienta_word_cards').select('*').limit(200)
      .then(({ data }) => {
        if (!data) return
        const cardCount = difficulty === 'difficile' ? 5 : 4
        const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, cardCount)
        setTrayCards(shuffled.map(card => ({ card, rotation: 0 })))
      })
  }, [phase, difficulty])

  // Auto-switch to clues phase when all 4 slots are occupied
  useEffect(() => {
    const allSlotsOccupied = Object.values(placements).every(v => v !== null)
    if (phase === 'placement' && allSlotsOccupied) {
      setPhase('clues')
    }
  }, [placements, phase])

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

    // From tray
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

    // From slot → slot
    for (const [pos, item] of Object.entries(placements)) {
      if (item && `placed-${item.card.id}-${pos}` === active.id) {
        const sourceSlot = parseInt(pos)
        if (sourceSlot === targetSlot) return
        const existing = placements[targetSlot]
        setPlacements(prev => ({
          ...prev,
          [targetSlot]: item,
          [sourceSlot]: existing ?? null,
        }))
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

  function handleTrayRotate(cardId) {
    setTrayCards(prev => prev.map(c =>
      c.card.id === cardId ? { ...c, rotation: (c.rotation + 90) % 360 } : c
    ))
  }

  async function handleSubmit() {
    if (expired || !difficulty) return
    if (!Object.values(clues).every(c => c.trim())) return

    const creatorTime = difficulty === 'facile' ? null : TIMER_DURATION - timeLeft

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

    // Add the decoy card in hard mode (the one left in tray)
    if (difficulty === 'difficile' && trayCards.length === 1) {
      gridCardInserts.push({
        grid_id: grid.id,
        card_id: trayCards[0].card.id,
        position: -1,
        rotation: 0,
      })
    }

    await supabase.from('orienta_grid_cards').insert(gridCardInserts)

    const xpEarned = XP_CREATE[difficulty]
    await supabase.rpc('add_user_xp', { uid: user.id, amount: xpEarned })
    await refreshUser()

    navigate('/hub')
  }

  function handleSelectDifficulty(chosen) {
    setDifficulty(chosen)
    setShowDifficultyModal(false)
  }

  const allPlaced = trayCards.length === (difficulty === 'difficile' ? 1 : 0)
  const showTimer = difficulty && difficulty !== 'facile'
  const timerPct = showTimer ? (timeLeft / TIMER_DURATION) * 100 : 100
  const timerColor = timeLeft < 20 ? 'var(--coral)' : timeLeft < 45 ? 'var(--warning)' : 'var(--accent)'

  return (
    <div className="create-page">
      <Header />

      {/* Modal de sélection de difficulté ou message limite quotidienne */}
      {showDifficultyModal && (
        <div className="difficulty-modal-backdrop">
          <div className="difficulty-modal">
            {alreadyCreatedToday ? (
              <>
                <h2 className="difficulty-modal-title">Limite quotidienne atteinte</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Tu as déjà créé une grille aujourd'hui. Reviens demain pour en créer une nouvelle ! 🎯
                </p>
                <button className="btn-primary" onClick={() => navigate('/hub')} style={{ width: '100%' }}>
                  Retour au Hub
                </button>
              </>
            ) : (
              <>
                <h2 className="difficulty-modal-title">Quel niveau de difficulté ?</h2>
                <div className="difficulty-options">
                  <button
                    className="difficulty-card"
                    onClick={() => handleSelectDifficulty('facile')}
                    type="button"
                  >
                    <div className="difficulty-name">Facile</div>
                    <div className="difficulty-desc">Temps illimité<br />4 cartes</div>
                  </button>
                  <button
                    className="difficulty-card"
                    onClick={() => handleSelectDifficulty('moyen')}
                    type="button"
                  >
                    <div className="difficulty-name">Moyen</div>
                    <div className="difficulty-desc">90 secondes<br />4 cartes</div>
                  </button>
                  <button
                    className="difficulty-card"
                    onClick={() => handleSelectDifficulty('difficile')}
                    type="button"
                  >
                    <div className="difficulty-name">Difficile</div>
                    <div className="difficulty-desc">90 secondes<br />5 cartes (1 leurre)</div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <main className="create-main">

        {/* Chrono seulement si timer actif */}
        {showTimer && (
          <div className="create-timer">
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

        {!showDifficultyModal && (
          <div className="create-phase-label">
            {phase === 'placement'
              ? `Étape 1 — Place et oriente tes ${difficulty === 'difficile' ? '4' : '4'} cartes`
              : 'Étape 2 — Écris tes 4 indices'}
          </div>
        )}

        {expired && (
          <div className="create-expired">
            <div className="create-expired-icon">⏰</div>
            <p className="create-expired-title">Le temps est écoulé !</p>
            <p className="create-expired-text">Ta grille n'a pas été sauvegardée. Pas de panique, réessaie !</p>
            <div className="create-expired-actions">
              <button className="btn-primary" onClick={() => window.location.reload()}>Réessayer</button>
              <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au Hub</button>
            </div>
          </div>
        )}

        {!expired && (
          <DndContext sensors={sensors} collisionDetection={closestCorners}
            onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

            {phase === 'clues' ? (
              <CloverWithInputs
                placements={placements} clues={clues} setClues={setClues} onRotate={handleRotate}
              />
            ) : (
              <CloverGrid
                placements={placements}
                clues={{ top: '—', right: '—', bottom: '—', left: '—' }}
                onRotate={handleRotate}
              />
            )}

            {(phase === 'placement' || phase === 'clues') && (
              <CardTray cards={trayCards} onRotate={handleTrayRotate} />
            )}

            <DragOverlay dropAnimation={null}>
              {activeCard && (
                <WordCard id="overlay" card={activeCard.card} rotation={activeCard.rotation} draggable={false} />
              )}
            </DragOverlay>
          </DndContext>
        )}

        {!expired && allPlaced && (
          <button className="btn-primary create-confirm" onClick={handleSubmit}
            disabled={!Object.values(clues).every(c => c.trim())}>
            {phase === 'clues' ? 'Publier la grille' : `Remplissez les indices (${phase})`}
          </button>
        )}
      </main>
    </div>
  )
}

function CloverWithInputs({ placements, clues, setClues, onRotate }) {
  return (
    <div className="clover-wrapper">
      <input className="clue-input clue-input--top"    value={clues.top}
        onChange={e => setClues(p => ({ ...p, top: e.target.value }))}
        placeholder="Haut" maxLength={24} />
      <input className="clue-input clue-input--left"   value={clues.left}
        onChange={e => setClues(p => ({ ...p, left: e.target.value }))}
        placeholder="Gauche" maxLength={24} />
      <div className="clover-grid">
        {[0, 1, 2, 3].map(pos => (
          <div key={pos} className="clover-slot">
            {placements[pos] ? (
              <WordCard
                id={`create-${placements[pos].card.id}-${pos}`}
                card={placements[pos].card}
                rotation={placements[pos].rotation}
                onRotate={() => onRotate(pos)}
                draggable={false}
              />
            ) : <div className="clover-slot-placeholder" />}
          </div>
        ))}
      </div>
      <input className="clue-input clue-input--right"  value={clues.right}
        onChange={e => setClues(p => ({ ...p, right: e.target.value }))}
        placeholder="Droite" maxLength={24} />
      <input className="clue-input clue-input--bottom" value={clues.bottom}
        onChange={e => setClues(p => ({ ...p, bottom: e.target.value }))}
        placeholder="Bas" maxLength={24} />
    </div>
  )
}
