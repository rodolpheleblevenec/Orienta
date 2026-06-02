import { getCardColor } from '../../lib/cardColors'

const POSITIONS = ['top', 'right', 'bottom', 'left']

function StaticMiniCard({ card, rotation, colorIndex }) {
  if (!card) return <div className="mini-slot-empty" />
  const { bg, border, text } = getCardColor(colorIndex)

  function wordStyle(originalPos) {
    const physIdx = (POSITIONS.indexOf(originalPos) + rotation / 90) % 4
    const isVertical = physIdx % 2 === 1
    const deg = isVertical ? -90 - rotation : -rotation
    return { transform: `rotate(${deg}deg)`, whiteSpace: 'nowrap', color: text }
  }

  return (
    <div className="mini-card" style={{ transform: `rotate(${rotation}deg)`, backgroundColor: bg, borderColor: border }}>
      <span className="mini-card-badge" style={{ background: border }} />
      <span className="mini-card-word mini-card-word--top"    style={wordStyle('top')}   >{card.word_top}</span>
      <span className="mini-card-word mini-card-word--right"  style={wordStyle('right')} >{card.word_right}</span>
      <span className="mini-card-word mini-card-word--bottom" style={wordStyle('bottom')}>{card.word_bottom}</span>
      <span className="mini-card-word mini-card-word--left"   style={wordStyle('left')}  >{card.word_left}</span>
    </div>
  )
}

export default function StaticMiniGrid({ placements, clues }) {
  return (
    <div className="mini-clover-wrapper">
      <div className="mini-clue mini-clue--top">{clues.top}</div>
      <div className="mini-clue mini-clue--left">{clues.left}</div>
      <div className="mini-clover-grid">
        {[0, 1, 2, 3].map(pos => (
          <div key={pos} className="mini-slot">
            <StaticMiniCard card={placements[pos]?.card} rotation={placements[pos]?.rotation ?? 0} colorIndex={placements[pos]?.colorIndex ?? 0} />
          </div>
        ))}
      </div>
      <div className="mini-clue mini-clue--right">{clues.right}</div>
      <div className="mini-clue mini-clue--bottom">{clues.bottom}</div>
    </div>
  )
}
