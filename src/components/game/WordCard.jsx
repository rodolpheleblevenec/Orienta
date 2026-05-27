import { motion } from 'framer-motion'
import { useDraggable } from '@dnd-kit/core'

const FEEDBACK_COLORS = {
  correct: '#00D4AA',
  rotation: '#F5D04A',
  wrong: '#FF6B6B',
  neutral: undefined,
}

export default function WordCard({ card, rotation = 0, feedback = 'neutral', onRotate, draggable = true, id }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: !draggable,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${rotation}deg)`,
  } : {
    transform: `rotate(${rotation}deg)`,
  }

  const borderColor = FEEDBACK_COLORS[feedback]

  return (
    <motion.div
      ref={setNodeRef}
      className={`word-card word-card--${feedback} ${isDragging ? 'word-card--dragging' : ''}`}
      style={{
        ...style,
        borderColor: borderColor || undefined,
        opacity: isDragging ? 0.4 : 1,
        cursor: draggable ? 'grab' : 'default',
        touchAction: 'none',
      }}
      {...listeners}
      {...attributes}
    >
      <span className="word-card-top">{card.word_top}</span>
      <span className="word-card-right">{card.word_right}</span>
      <span className="word-card-bottom">{card.word_bottom}</span>
      <span className="word-card-left">{card.word_left}</span>

      {onRotate && (
        <button
          className="word-card-rotate"
          onClick={e => { e.stopPropagation(); onRotate() }}
          title="Tourner"
        >
          ↻
        </button>
      )}
    </motion.div>
  )
}
