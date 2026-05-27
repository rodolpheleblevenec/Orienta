import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

export default function WordCard({ card, rotation = 0, feedback = 'neutral', onRotate, draggable = true, id }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: !draggable,
  })

  const dragStyle = transform
    ? { transform: CSS.Translate.toString(transform) }
    : {}

  const containerStyle = {
    ...dragStyle,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : 'auto',
    touchAction: 'none',
  }

  const cardInnerStyle = {
    transform: `rotate(${rotation}deg)`,
    transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
  }

  const feedbackClass = feedback !== 'neutral' ? `word-card--${feedback}` : ''

  return (
    <div
      ref={setNodeRef}
      style={containerStyle}
      className="word-card-draggable"
      {...(draggable ? { ...listeners, ...attributes } : {})}
    >
      <div className={`word-card ${feedbackClass} ${isDragging ? 'word-card--dragging' : ''}`} style={cardInnerStyle}>
        <span className="word-card-top">{card.word_top}</span>
        <span className="word-card-right">{card.word_right}</span>
        <span className="word-card-bottom">{card.word_bottom}</span>
        <span className="word-card-left">{card.word_left}</span>

        {onRotate && (
          <button
            className="word-card-rotate"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRotate() }}
            title="Tourner la carte"
            type="button"
          >
            ↻
          </button>
        )}
      </div>
    </div>
  )
}
