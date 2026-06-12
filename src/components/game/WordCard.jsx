import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useRef, useEffect } from 'react'
import { getCardColor } from '../../lib/cardColors'

export default function WordCard({ card, rotation = 0, feedback = 'neutral', onRotate, draggable = true, id, disableTransition = false, colorIndex = 0, neutral = false, label = '', blur = false, showNotch = false }) {
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
      <div className={`word-card ${neutral ? 'word-card--neutral' : ''} ${feedbackClass} ${isDragging ? 'word-card--dragging' : ''}`} style={cardInnerStyle}>
        <span className="word-card-badge" style={badgeStyle} />
        {neutral ? (
          <>
            {/* Encoche = bord « haut » actuel de la carte ; tourne avec elle → orientation lisible par tous */}
            <span className="word-card-notch" style={{ borderBottomColor: border }} />
            {/* Numéro maintenu droit (contre-rotation) pour rester lisible */}
            <span className="word-card-label" style={{ color: text, transform: `rotate(${-rotation}deg)` }}>{label}</span>
          </>
        ) : (
          <>
            {/* Encoche d'orientation (raid) : fixée à la carte, tourne avec elle */}
            {showNotch && <span className="word-card-notch" style={{ borderBottomColor: border }} />}
            {/* Numéro d'identité au centre (raid), maintenu droit */}
            {label && <span className="word-card-num" style={{ color: text, transform: `rotate(${-rotation}deg)` }}>{label}</span>}
            <span className={`word-card-top${blur ? ' word-card-word--blur' : ''}`}    style={wordStyle('top')}   >{card.word_top}</span>
            <span className={`word-card-right${blur ? ' word-card-word--blur' : ''}`}  style={wordStyle('right')} >{card.word_right}</span>
            <span className={`word-card-bottom${blur ? ' word-card-word--blur' : ''}`} style={wordStyle('bottom')}>{card.word_bottom}</span>
            <span className={`word-card-left${blur ? ' word-card-word--blur' : ''}`}   style={wordStyle('left')}  >{card.word_left}</span>
          </>
        )}
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
