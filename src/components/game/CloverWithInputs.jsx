import WordCard from './WordCard'
import { DroppableSlot } from './CloverGrid'

export default function CloverWithInputs({ placements, clues, setClues, onRotate, draggable = false }) {
  return (
    <div className="clover-wrapper">
      <input
        className="clue-input clue-input--top"
        value={clues.top}
        onChange={e => setClues(p => ({ ...p, top: e.target.value }))}
        placeholder="Haut"
        maxLength={24}
      />
      <input
        className="clue-input clue-input--left"
        value={clues.left}
        onChange={e => setClues(p => ({ ...p, left: e.target.value }))}
        placeholder="Gauche"
        maxLength={24}
      />
      <div className="clover-grid">
        {[0, 1, 2, 3].map(pos => (
          draggable ? (
            <DroppableSlot
              key={pos}
              pos={pos}
              card={placements[pos]?.card}
              rotation={placements[pos]?.rotation ?? 0}
              colorIndex={placements[pos]?.colorIndex ?? 0}
              onRotate={onRotate ? () => onRotate(pos) : undefined}
            />
          ) : (
            <div key={pos} className="clover-slot">
              {placements[pos] ? (
                <WordCard
                  id={`placed-${placements[pos].card.id}-${pos}`}
                  card={placements[pos].card}
                  rotation={placements[pos].rotation}
                  colorIndex={placements[pos].colorIndex ?? 0}
                  onRotate={() => onRotate(pos)}
                  draggable={false}
                />
              ) : (
                <div className="clover-slot-placeholder" />
              )}
            </div>
          )
        ))}
      </div>
      <input
        className="clue-input clue-input--right"
        value={clues.right}
        onChange={e => setClues(p => ({ ...p, right: e.target.value }))}
        placeholder="Droite"
        maxLength={24}
      />
      <input
        className="clue-input clue-input--bottom"
        value={clues.bottom}
        onChange={e => setClues(p => ({ ...p, bottom: e.target.value }))}
        placeholder="Bas"
        maxLength={24}
      />
    </div>
  )
}
