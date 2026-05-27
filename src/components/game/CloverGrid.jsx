import { useDroppable } from '@dnd-kit/core'
import WordCard from './WordCard'

// pos: 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right
function DroppableSlot({ pos, card, rotation, feedback, onRotate, clues }) {
  const { isOver, setNodeRef } = useDroppable({ id: `slot-${pos}` })

  return (
    <div
      ref={setNodeRef}
      className={`clover-slot ${isOver ? 'clover-slot--over' : ''} ${card ? '' : 'clover-slot--empty'}`}
      data-pos={pos}
    >
      {card ? (
        <WordCard
          id={`placed-${card.id}-${pos}`}
          card={card}
          rotation={rotation}
          feedback={feedback}
          onRotate={onRotate}
          draggable
        />
      ) : (
        <div className="clover-slot-placeholder" />
      )}
    </div>
  )
}

export default function CloverGrid({ placements, clues, feedbacks = {}, onRotate }) {
  // placements: { 0: { card, rotation }, 1: ..., 2: ..., 3: ... }
  // clues: { top, right, bottom, left }

  return (
    <div className="clover-wrapper">
      {/* Top clue */}
      <div className="clue clue--top">{clues?.top || ''}</div>

      {/* Left clue */}
      <div className="clue clue--left">{clues?.left || ''}</div>

      {/* The 2x2 grid */}
      <div className="clover-grid">
        {[0, 1, 2, 3].map(pos => (
          <DroppableSlot
            key={pos}
            pos={pos}
            card={placements[pos]?.card}
            rotation={placements[pos]?.rotation ?? 0}
            feedback={feedbacks[pos]}
            onRotate={onRotate ? () => onRotate(pos) : undefined}
          />
        ))}
      </div>

      {/* Right clue */}
      <div className="clue clue--right">{clues?.right || ''}</div>

      {/* Bottom clue */}
      <div className="clue clue--bottom">{clues?.bottom || ''}</div>
    </div>
  )
}
