import { useDroppable } from '@dnd-kit/core'
import WordCard from './WordCard'

function DroppableSlot({ pos, card, rotation, feedback, onRotate, disableTransition }) {
  const { isOver, setNodeRef } = useDroppable({ id: `slot-${pos}` })

  return (
    <div
      ref={setNodeRef}
      className={`clover-slot${isOver ? ' clover-slot--over' : ''}${!card ? ' clover-slot--empty' : ''}`}
    >
      {card ? (
        <WordCard
          id={`placed-${card.id}-${pos}`}
          card={card}
          rotation={rotation}
          feedback={feedback ?? 'neutral'}
          onRotate={onRotate}
          draggable
          disableTransition={disableTransition}
        />
      ) : (
        <div className="clover-slot-placeholder" />
      )}
    </div>
  )
}

export default function CloverGrid({ placements, clues, feedbacks = {}, onRotate, disableTransition }) {
  return (
    <div className="clover-wrapper">
      <div className="clue clue--top">{clues?.top || ''}</div>
      <div className="clue clue--left">{clues?.left || ''}</div>

      <div className="clover-grid">
        {[0, 1, 2, 3].map(pos => (
          <DroppableSlot
            key={pos}
            pos={pos}
            card={placements[pos]?.card}
            rotation={placements[pos]?.rotation ?? 0}
            feedback={feedbacks[pos]}
            onRotate={onRotate ? () => onRotate(pos) : undefined}
            disableTransition={disableTransition}
          />
        ))}
      </div>

      <div className="clue clue--right">{clues?.right || ''}</div>
      <div className="clue clue--bottom">{clues?.bottom || ''}</div>
    </div>
  )
}
