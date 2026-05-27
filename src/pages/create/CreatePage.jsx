import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'
import CloverGrid from '../../components/game/CloverGrid'
import CardTray from '../../components/game/CardTray'
import WordCard from '../../components/game/WordCard'

const TOTAL_TIME = 90 // chrono unique pour tout

export default function CreatePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [phase, setPhase] = useState('placement') // 'placement' | 'clues'
  const [placements, setPlacements] = useState({ 0: null, 1: null, 2: null, 3: null })
  const [trayCards, setTrayCards] = useState([])
  const [activeCard, setActiveCard] = useState(null)
  const [clues, setClues] = useState({ top: '', right: '', bottom: '', left: '' })
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const [expired, setExpired] = useState(false)
  const startTimeRef = useRef(null)
  const timerRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  // Chrono démarre dès le chargement
  useEffect(() => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const remaining = TOTAL_TIME - Math.floor((Date.now() - startTimeRef.current) / 1000)
      if (remaining <= 0) {
        setTimeLeft(0); setExpired(true); clearInterval(timerRef.current)
      } else {
        setTimeLeft(remaining)
      }
    }, 500)
    return () => clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    supabase.from('orienta_word_cards').select('*').limit(200)
      .then(({ data }) => {
        if (!data) return
        const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 4)
        setTrayCards(shuffled.map(card => ({ card, rotation: 0 })))
      })
  }, [])

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
    if (expired) return
    if (!Object.values(clues).every(c => c.trim())) return

    const { data: grid } = await supabase.from('orienta_grids').insert({
      creator_id: user.id,
      status: 'published',
      clue_top:    clues.top.trim(),
      clue_right:  clues.right.trim(),
      clue_bottom: clues.bottom.trim(),
      clue_left:   clues.left.trim(),
      creator_time_seconds: TOTAL_TIME - timeLeft,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    }).select().single()

    if (!grid) return

    await supabase.from('orienta_grid_cards').insert(
      Object.entries(placements)
        .filter(([, v]) => v)
        .map(([pos, { card, rotation }]) => ({
          grid_id: grid.id, card_id: card.id,
          position: parseInt(pos), rotation,
        }))
    )
    navigate('/hub')
  }

  const allPlaced = trayCards.length === 0
  const timerPct = (timeLeft / TOTAL_TIME) * 100
  const timerColor = timeLeft < 20 ? 'var(--coral)' : timeLeft < 45 ? 'var(--warning)' : 'var(--accent)'

  return (
    <div className="create-page">
      <Header />
      <main className="create-main">

        {/* Chrono toujours visible */}
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

        <div className="create-phase-label">
          {phase === 'placement'
            ? 'Étape 1 — Place et oriente tes 4 cartes'
            : 'Étape 2 — Écris tes 4 indices'}
        </div>

        {expired && (
          <div className="create-expired">
            Temps écoulé — la grille n'a pas été sauvegardée.
            <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au Hub</button>
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

            {phase === 'placement' && (
              <CardTray cards={trayCards} onRotate={handleTrayRotate} />
            )}

            <DragOverlay dropAnimation={null}>
              {activeCard && (
                <WordCard id="overlay" card={activeCard.card} rotation={activeCard.rotation} draggable={false} />
              )}
            </DragOverlay>
          </DndContext>
        )}

        {!expired && phase === 'placement' && (
          <button className="btn-primary create-confirm" onClick={() => setPhase('clues')} disabled={!allPlaced}>
            {allPlaced ? 'Passer aux indices →' : `Place toutes les cartes (${trayCards.length} restante${trayCards.length > 1 ? 's' : ''})`}
          </button>
        )}

        {!expired && phase === 'clues' && (
          <button className="btn-primary create-confirm" onClick={handleSubmit}
            disabled={!Object.values(clues).every(c => c.trim())}>
            Publier la grille
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
