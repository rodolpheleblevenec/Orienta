import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useRef, useEffect } from 'react'

export default function WordCard({ card, rotation = 0, feedback = 'neutral', onRotate, draggable = true, id, disableTransition = false }) {
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

  const cardInnerStyle = {
    transform: `rotate(${rotation}deg)`,
    transition: (isDragging || isInitialRender.current || disableTransition) ? 'none' : 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
  }

  // Compute style based on the word's PHYSICAL position after card rotation,
  // not its original label (top/right/bottom/left).
  // Physical position determines horizontal vs vertical-bottom-to-top rendering.
  const ease = isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)'
  const POSITIONS = ['top', 'right', 'bottom', 'left']
  function wordStyle(originalPos) {
    const physIdx = (POSITIONS.indexOf(originalPos) + rotation / 90) % 4
    const isVertical = physIdx % 2 === 1  // physically at right(1) or left(3)
    const deg = isVertical ? -90 - rotation : -rotation
    return { transform: `rotate(${deg}deg)`, whiteSpace: 'nowrap', transition: ease }
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
        <span className="word-card-top"    style={wordStyle('top')}   >{card.word_top}</span>
        <span className="word-card-right"  style={wordStyle('right')} >{card.word_right}</span>
        <span className="word-card-bottom" style={wordStyle('bottom')}>{card.word_bottom}</span>
        <span className="word-card-left"   style={wordStyle('left')}  >{card.word_left}</span>
      </div>

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
  )
}
