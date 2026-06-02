import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useRef, useEffect } from 'react'
import { getCardColor } from '../../lib/cardColors'

export default function WordCard({ card, rotation = 0, feedback = 'neutral', onRotate, draggable = true, id, disableTransition = false, colorIndex = 0 }) {
  const isInitialRender = useRef(true)
  useEffect(() => {
    isInitialRender.current = false
  }, [])

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: !draggable,
  })

  const dragStyle = transform ? { transform: CSS.Translate.toString(transform) } : {}

  const containerStyle = {
    ...dragStyle,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : 'auto',
    touchAction: 'none',
    position: 'relative',
  }

  const { bg, border, text } = getCardColor(colorIndex)
  const cardInnerStyle = {
    transform: `rotate(${rotation}deg)`,
    transition: (isDragging || isInitialRender.current || disableTransition) ? 'none' : 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
    backgroundColor: bg,
    borderColor: border,
  }

  const badgeStyle = { background: border }
  /* --card-color exposé en CSS variable pour que le :hover puisse passer le texte en blanc */
  const rotateStyle = { '--card-color': border }

  const POSITIONS = ['top', 'right', 'bottom', 'left']
  function wordStyle(originalPos) {
    const physIdx = (POSITIONS.indexOf(originalPos) + rotation / 90) % 4
    const isVertical = physIdx % 2 === 1
    const deg = isVertical ? -90 - rotation : -rotation
    const transition = isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)'
    return { transform: `rotate(${deg}deg)`, whiteSpace: 'nowrap', transition, color: text }
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
        <span className="word-card-badge" style={badgeStyle} />
        <span className="word-card-top"    style={wordStyle('top')}   >{card.word_top}</span>
        <span className="word-card-right"  style={wordStyle('right')} >{card.word_right}</span>
        <span className="word-card-bottom" style={wordStyle('bottom')}>{card.word_bottom}</span>
        <span className="word-card-left"   style={wordStyle('left')}  >{card.word_left}</span>
      </div>

      {onRotate && (
        <button
          className="word-card-rotate"
          style={rotateStyle}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRotate() }}
          title="Tourner la carte"
          type="button"
        >
          ↻
        </button>
      )}
    </div>
  )
}
