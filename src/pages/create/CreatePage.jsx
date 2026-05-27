import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'
import CloverGrid from '../../components/game/CloverGrid'
import CardTray from '../../components/game/CardTray'
import WordCard from '../../components/game/WordCard'

const CLUE_TIME = 90

export default function CreatePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [phase, setPhase] = useState('placement')
  const [placements, setPlacements] = useState({ 0: null, 1: null, 2: null, 3: null })
  const [trayCards, setTrayCards] = useState([])
  const [activeCard, setActiveCard] = useState(null)
  const [clues, setClues] = useState({ top: '', right: '', bottom: '', left: '' })
  const [timeLeft, setTimeLeft] = useState(CLUE_TIME)
  const [expired, setExpired] = useState(false)
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
    supabase
      .from('orienta_word_cards')
      .select('*')
      .limit(100)
      .then(({ data }) => {
        if (!data) return
        const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 4)
        setTrayCards(shuffled.map(card => ({
          card,
          rotation: [0, 90, 180, 270][Math.floor(Math.random() * 4)],
        })))
      })
  }, [])

  useEffect(() => {
    if (phase !== 'clues') return
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const remaining = CLUE_TIME - Math.floor((Date.now() - startTimeRef.current) / 1000)
      if (remaining <= 0) {
        setTimeLeft(0); setExpired(true); clearInterval(timerRef.current)
      } else {
        setTimeLeft(remaining)
      }
    }, 500)
    return () => clearInterval(timerRef.current)
  }, [phase])

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
    if (trayIdx === -1) return

    const cardItem = trayCards[trayIdx]
    const existing = placements[slotIdx]
    setPlacements(prev => ({ ...prev, [slotIdx]: cardItem }))
    setTrayCards(prev => {
      const updated = prev.filter((_, i) => i !== trayIdx)
      if (existing) updated.push(existing)
      return updated
    })
  }

  function handleRotate(pos) {
    setPlacements(prev => {
      const item = prev[pos]
      if (!item) return prev
      return { ...prev, [pos]: { ...item, rotation: (item.rotation + 90) % 360 } }
    })
  }

  async function handleSubmit() {
    if (expired) return
    const allFilled = Object.values(clues).every(c => c.trim().length > 0)
    if (!allFilled) return

    const { data: grid, error } = await supabase
      .from('orienta_grids')
      .insert({
        creator_id: user.id,
        status: 'published',
        clue_top: clues.top.trim(),
        clue_right: clues.right.trim(),
        clue_bottom: clues.bottom.trim(),
        clue_left: clues.left.trim(),
        creator_time_seconds: CLUE_TIME - timeLeft,
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      })
      .select()
      .single()

    if (error || !grid) return

    await supabase.from('orienta_grid_cards').insert(
      Object.entries(placements)
        .filter(([, v]) => v)
        .map(([pos, { card, rotation }]) => ({
          grid_id: grid.id,
          card_id: card.id,
          position: parseInt(pos, 10),
          rotation,
        }))
    )

    navigate('/hub')
  }

  const allPlaced = trayCards.length === 0
  const timerPct = (timeLeft / CLUE_TIME) * 100
  const timerColor = timeLeft < 20 ? 'var(--coral)' : timeLeft < 45 ? 'var(--warning)' : 'var(--accent)'

  return (
    <div className="create-page">
      <Header />
      <main className="create-main">
        <div className="create-phase-label">
          {phase === 'placement' ? 'Étape 1 — Place tes cartes' : 'Étape 2 — Écris tes indices'}
        </div>

        {phase === 'clues' && (
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

        {expired && (
          <div className="create-expired">
            Temps écoulé — la grille n'a pas été sauvegardée.
            <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au Hub</button>
          </div>
        )}

        <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {phase === 'clues' ? (
            <CloverGridWithClueInputs
              placements={placements}
              clues={clues}
              setClues={setClues}
              onRotate={handleRotate}
              disabled={expired}
            />
          ) : (
            <CloverGrid
              placements={placements}
              clues={{ top: '?', right: '?', bottom: '?', left: '?' }}
              onRotate={handleRotate}
            />
          )}

          {phase === 'placement' && <CardTray cards={trayCards} />}

          <DragOverlay>
            {activeCard && (
              <WordCard id="overlay" card={activeCard.card} rotation={activeCard.rotation} draggable={false} />
            )}
          </DragOverlay>
        </DndContext>

        {phase === 'placement' && (
          <button
            className="btn-primary create-confirm"
            onClick={() => setPhase('clues')}
            disabled={!allPlaced}
          >
            {allPlaced ? 'Confirmer le placement →' : `Placez toutes les cartes (${trayCards.length} restantes)`}
          </button>
        )}

        {phase === 'clues' && !expired && (
          <button
            className="btn-primary create-confirm"
            onClick={handleSubmit}
            disabled={!Object.values(clues).every(c => c.trim().length > 0)}
          >
            Publier la grille
          </button>
        )}
      </main>
    </div>
  )
}

function CloverGridWithClueInputs({ placements, clues, setClues, onRotate, disabled }) {
  return (
    <div className="clover-wrapper">
      <input className="clue-input clue-input--top" value={clues.top}
        onChange={e => setClues(p => ({ ...p, top: e.target.value }))}
        placeholder="Indice haut…" maxLength={32} disabled={disabled} />
      <input className="clue-input clue-input--left" value={clues.left}
        onChange={e => setClues(p => ({ ...p, left: e.target.value }))}
        placeholder="Gauche" maxLength={32} disabled={disabled} />
      <div className="clover-grid">
        {[0, 1, 2, 3].map(pos => (
          <div key={pos} className="clover-slot">
            {placements[pos] ? (
              <WordCard
                id={`create-placed-${placements[pos].card.id}-${pos}`}
                card={placements[pos].card}
                rotation={placements[pos].rotation}
                feedback="neutral"
                onRotate={() => onRotate(pos)}
                draggable={false}
              />
            ) : (
              <div className="clover-slot-placeholder" />
            )}
          </div>
        ))}
      </div>
      <input className="clue-input clue-input--right" value={clues.right}
        onChange={e => setClues(p => ({ ...p, right: e.target.value }))}
        placeholder="Droite" maxLength={32} disabled={disabled} />
      <input className="clue-input clue-input--bottom" value={clues.bottom}
        onChange={e => setClues(p => ({ ...p, bottom: e.target.value }))}
        placeholder="Indice bas…" maxLength={32} disabled={disabled} />
    </div>
  )
}
