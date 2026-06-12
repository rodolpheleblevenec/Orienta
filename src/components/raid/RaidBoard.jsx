import { DndContext, DragOverlay, closestCorners, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useState, useRef } from 'react'
import WordCard from '../game/WordCard'

const handleIndex = (h) => Number(String(h).replace('c', '')) || 0

// Placeholders flottés pour les joueurs NON autorisés : on ne leur envoie JAMAIS
// le vrai texte (il n'est pas dans leur DOM → impossible à « déflouter »). Ils
// voient juste une grille classique au texte illisible.
const DUMMY = ['varech', 'récif', 'marée', 'abysse', 'courant', 'écume', 'lagon', 'brume', 'dérive', 'sel', 'corail', 'nasse']
const SIDES = ['top', 'right', 'bottom', 'left']
const dummyWord = (handle, side) => DUMMY[(handleIndex(handle) * 4 + SIDES.indexOf(side)) % DUMMY.length]
const dummyClue = (side) => DUMMY[(SIDES.indexOf(side) * 3 + 5) % DUMMY.length]

function Slot({ pos, cell, feedback, interactive, onRotate, cardFor, blurWords }) {
  const { isOver, setNodeRef } = useDroppable({ id: `raid-slot-${pos}`, disabled: !interactive })
  return (
    <div ref={setNodeRef} className={`clover-slot raid-slot${isOver ? ' clover-slot--over' : ''}${!cell ? ' clover-slot--empty' : ''}`}>
      {cell ? (
        <WordCard
          id={`raid-placed-${cell.handle}`}
          card={cardFor(cell.handle)}
          blur={blurWords}
          colorIndex={handleIndex(cell.handle)}
          rotation={cell.rotation}
          feedback={feedback ?? 'neutral'}
          draggable={interactive}
          onRotate={interactive ? () => onRotate(pos) : undefined}
        />
      ) : <div className="clover-slot-placeholder" />}
    </div>
  )
}

function Tray({ handles, interactive, cardFor, blurWords }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'raid-tray', disabled: !interactive })
  return (
    <div ref={setNodeRef} className={`raid-tray${isOver ? ' raid-tray--over' : ''}`}>
      {handles.length === 0 && <span className="raid-tray-empty">Toutes les cartes sont posées</span>}
      {handles.map(h => (
        <WordCard
          key={h}
          id={`raid-tray-${h}`}
          card={cardFor(h)}
          blur={blurWords}
          colorIndex={handleIndex(h)}
          rotation={0}
          draggable={interactive}
        />
      ))}
    </div>
  )
}

// Plateau partagé du raid, façon grille classique. Indices + mots sont AFFICHÉS
// sur la grille : nets pour l'organe autorisé (Œil/Vigie/Cartographe), floutés
// (placeholders) pour les autres → on garde l'info cachée tout en gardant le look.
export default function RaidBoard({
  board, cardOrder, feedbacks = {}, interactive = false, onChange, onPreview,
  clues = null, words = null, canSeeClues = false, canSeeWords = false,
}) {
  const [activeId, setActiveId] = useState(null)
  const lastOverRef = useRef(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  const placedHandles = Object.values(board).map(c => c.handle)
  const tray = cardOrder.filter(h => !placedHandles.includes(h))
  const slotOfHandle = (h) => Object.keys(board).find(s => board[s].handle === h)

  // Mots affichés pour une carte : réels si autorisé, sinon placeholders flottés.
  const cardFor = (handle) => {
    if (canSeeWords && words?.[handle]) {
      const w = words[handle]
      return { id: handle, word_top: w.top, word_right: w.right, word_bottom: w.bottom, word_left: w.left }
    }
    return {
      id: handle,
      word_top: dummyWord(handle, 'top'), word_right: dummyWord(handle, 'right'),
      word_bottom: dummyWord(handle, 'bottom'), word_left: dummyWord(handle, 'left'),
    }
  }
  const clueText = (side) => (canSeeClues ? (clues?.[side] || '') : dummyClue(side))
  const clueCls = (side) => `clue clue--${side}${canSeeClues ? '' : ' raid-clue--blur'}`

  function handleRotate(pos) {
    const cell = board[pos]
    if (!cell) return
    onChange({ ...board, [pos]: { ...cell, rotation: (cell.rotation + 90) % 360 } })
  }

  function computeNext(handle, overId) {
    const fromSlot = slotOfHandle(handle)
    const next = { ...board }
    if (overId === 'raid-tray') { if (fromSlot != null) delete next[fromSlot]; return next }
    const toSlot = String(overId).replace('raid-slot-', '')
    if (fromSlot === toSlot) return null
    const occupant = next[toSlot]
    const moving = fromSlot != null ? next[fromSlot] : { handle, rotation: 0 }
    if (fromSlot != null) delete next[fromSlot]
    next[toSlot] = moving
    if (occupant && fromSlot != null) next[fromSlot] = occupant // swap
    return next
  }

  function handleDragOver({ active, over }) {
    if (!over || !onPreview || lastOverRef.current === over.id) return
    lastOverRef.current = over.id
    const handle = String(active.id).replace('raid-tray-', '').replace('raid-placed-', '')
    onPreview(computeNext(handle, over.id) || board)
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null); lastOverRef.current = null
    if (!over) { onPreview?.(board); return }
    const handle = String(active.id).replace('raid-tray-', '').replace('raid-placed-', '')
    const next = computeNext(handle, over.id)
    if (next) onChange(next); else onPreview?.(board)
  }

  function handleDragCancel() { setActiveId(null); lastOverRef.current = null; onPreview?.(board) }

  const blurWords = !canSeeWords
  const grid = (
    <div className="clover-wrapper raid-board">
      <div className={clueCls('top')}>{clueText('top')}</div>
      <div className={clueCls('left')}>{clueText('left')}</div>
      <div className="clover-grid">
        {[0, 1, 2, 3].map(pos => (
          <Slot key={pos} pos={pos} cell={board[pos]} feedback={feedbacks[pos]} interactive={interactive}
            onRotate={handleRotate} cardFor={cardFor} blurWords={blurWords} />
        ))}
      </div>
      <div className={clueCls('right')}>{clueText('right')}</div>
      <div className={clueCls('bottom')}>{clueText('bottom')}</div>
    </div>
  )

  if (!interactive) {
    return (
      <div className="raid-board-wrap">
        {grid}
        <Tray handles={tray} interactive={false} cardFor={cardFor} blurWords={blurWords} />
      </div>
    )
  }

  const activeHandle = activeId ? String(activeId).replace('raid-tray-', '').replace('raid-placed-', '') : null
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id)} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="raid-board-wrap">
        {grid}
        <Tray handles={tray} interactive cardFor={cardFor} blurWords={blurWords} />
      </div>
      <DragOverlay>
        {activeHandle != null && (
          <WordCard id="raid-overlay" card={cardFor(activeHandle)} blur={blurWords} colorIndex={handleIndex(activeHandle)}
            rotation={board[slotOfHandle(activeHandle)]?.rotation ?? 0} draggable={false} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
