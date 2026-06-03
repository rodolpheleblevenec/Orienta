import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import WordCard from './WordCard'

export function DroppableSlot({ pos, card, rotation, colorIndex, feedback, onRotate, disableTransition, slotAction }) {
  const { isOver, setNodeRef } = useDroppable({ id: `slot-${pos}` })
  // Pendant le glissement d'un swap : on élève la carte et on déclenche un halo teal.
  const [moving, setMoving] = useState(false)

  return (
    <div
      ref={setNodeRef}
      className={`clover-slot${isOver ? ' clover-slot--over' : ''}${!card ? ' clover-slot--empty' : ''}${slotAction ? ' clover-slot--action' : ''}`}
    >
      {card ? (
        // layoutId stable par carte → quand deux cartes échangent de slot,
        // framer-motion les fait glisser visiblement vers leur nouvelle position.
        <motion.div
          layoutId={`clovercard-${card.id}`}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          onLayoutAnimationStart={() => setMoving(true)}
          onLayoutAnimationComplete={() => setMoving(false)}
          className={`clovercard-motion${moving ? ' clovercard-motion--moving' : ''}`}
        >
          <WordCard
            id={`placed-${card.id}-${pos}`}
            card={card}
            rotation={rotation}
            colorIndex={colorIndex}
            feedback={feedback ?? 'neutral'}
            onRotate={onRotate}
            draggable
            disableTransition={disableTransition}
          />
        </motion.div>
      ) : (
        <div className="clover-slot-placeholder" />
      )}
      {slotAction && slotAction(pos)}
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
            colorIndex={placements[pos]?.colorIndex ?? 0}
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
