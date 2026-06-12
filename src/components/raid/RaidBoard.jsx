import { DndContext, DragOverlay, closestCorners, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useState } from 'react'
import WordCard from '../game/WordCard'

const SLOT_LABELS = { 0: 'Haut', 1: 'Droite', 2: 'Bas', 3: 'Gauche' }
const NUMERALS = ['①', '②', '③', '④']
const handleIndex = (h) => Number(String(h).replace('c', '')) || 0

function Slot({ pos, cell, feedback, interactive, onRotate }) {
  const { isOver, setNodeRef } = useDroppable({ id: `raid-slot-${pos}`, disabled: !interactive })
  return (
    <div ref={setNodeRef} className={`clover-slot raid-slot${isOver ? ' clover-slot--over' : ''}${!cell ? ' clover-slot--empty' : ''}`}>
      {cell ? (
        <WordCard
          id={`raid-placed-${cell.handle}`}
          card={{ id: cell.handle }}
          neutral
          label={NUMERALS[handleIndex(cell.handle)]}
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

function Tray({ handles, interactive }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'raid-tray', disabled: !interactive })
  return (
    <div ref={setNodeRef} className={`raid-tray${isOver ? ' raid-tray--over' : ''}`}>
      {handles.length === 0 && <span className="raid-tray-empty">Toutes les cartes sont posées</span>}
      {handles.map(h => (
        <WordCard
          key={h}
          id={`raid-tray-${h}`}
          card={{ id: h }}
          neutral
          label={NUMERALS[handleIndex(h)]}
          colorIndex={handleIndex(h)}
          rotation={0}
          draggable={interactive}
        />
      ))}
    </div>
  )
}

// Plateau partagé du raid. `board` = { slot: {handle, rotation} } ; `cardOrder` =
// handles opaques (c0..c3). Seul l'organe qui contrôle (la Main) a `interactive`.
export default function RaidBoard({ board, cardOrder, feedbacks = {}, interactive = false, onChange, clues = null }) {
  const [activeId, setActiveId] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  const placedHandles = Object.values(board).map(c => c.handle)
  const tray = cardOrder.filter(h => !placedHandles.includes(h))

  const slotOfHandle = (h) => Object.keys(board).find(s => board[s].handle === h)

  function handleRotate(pos) {
    const cell = board[pos]
    if (!cell) return
    onChange({ ...board, [pos]: { ...cell, rotation: (cell.rotation + 90) % 360 } })
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return
    const id = String(active.id)
    const handle = id.replace('raid-tray-', '').replace('raid-placed-', '')
    const fromSlot = slotOfHandle(handle)
    const next = { ...board }

    if (over.id === 'raid-tray') {
      if (fromSlot != null) delete next[fromSlot]
      onChange(next)
      return
    }
    const toSlot = String(over.id).replace('raid-slot-', '')
    if (fromSlot === toSlot) return
    const occupant = next[toSlot]
    const moving = fromSlot != null ? next[fromSlot] : { handle, rotation: 0 }
    if (fromSlot != null) delete next[fromSlot]
    next[toSlot] = moving
    // Swap : l'occupant retourne à l'ancien slot (sinon il file au tray).
    if (occupant && fromSlot != null) next[fromSlot] = occupant
    onChange(next)
  }

  const grid = (
    <div className="clover-wrapper raid-board">
      <div className={`clue clue--top${clues ? '' : ' clue--ph'}`}>{clues?.top || 'Haut'}</div>
      <div className={`clue clue--left${clues ? '' : ' clue--ph'}`}>{clues?.left || 'Gauche'}</div>
      <div className="clover-grid">
        {[0, 1, 2, 3].map(pos => (
          <Slot key={pos} pos={pos} cell={board[pos]} feedback={feedbacks[pos]} interactive={interactive} onRotate={handleRotate} />
        ))}
      </div>
      <div className={`clue clue--right${clues ? '' : ' clue--ph'}`}>{clues?.right || 'Droite'}</div>
      <div className={`clue clue--bottom${clues ? '' : ' clue--ph'}`}>{clues?.bottom || 'Bas'}</div>
    </div>
  )

  if (!interactive) {
    return (
      <div className="raid-board-wrap">
        {grid}
        <Tray handles={tray} interactive={false} />
      </div>
    )
  }

  const activeHandle = activeId ? String(activeId).replace('raid-tray-', '').replace('raid-placed-', '') : null
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="raid-board-wrap">
        {grid}
        <Tray handles={tray} interactive />
      </div>
      <DragOverlay>
        {activeHandle != null && (
          <WordCard id="raid-overlay" card={{ id: activeHandle }} neutral label={NUMERALS[handleIndex(activeHandle)]}
            colorIndex={handleIndex(activeHandle)} rotation={board[slotOfHandle(activeHandle)]?.rotation ?? 0} draggable={false} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
