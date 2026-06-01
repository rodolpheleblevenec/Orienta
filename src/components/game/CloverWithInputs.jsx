import { useState, useRef, useEffect } from 'react'
import WordCard from './WordCard'
import { DroppableSlot } from './CloverGrid'

const SIDE_LABELS = { left: '← Gauche', right: 'Droite →' }

export default function CloverWithInputs({ placements, clues, setClues, onRotate, draggable = false }) {
  const [editingSide, setEditingSide] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editingSide && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingSide])

  const closeSide = () => setEditingSide(null)

  return (
    <div className="clover-wrapper">
      <input
        className="clue-input clue-input--top"
        value={clues.top}
        onChange={e => setClues(p => ({ ...p, top: e.target.value }))}
        onFocus={closeSide}
        placeholder="Haut"
        maxLength={24}
      />

      {/* Desktop (>680px) : input horizontal direct dans la colonne gauche */}
      <input
        className="clue-input clue-input--left clue-lateral--desktop"
        value={clues.left}
        onChange={e => setClues(p => ({ ...p, left: e.target.value }))}
        placeholder="Gauche"
        maxLength={24}
      />
      {/* Mobile (≤680px) : bouton vertical cliquable → overlay centré */}
      <button
        type="button"
        className={`clue-side-btn clue-side-btn--left clue-lateral--mobile${editingSide === 'left' ? ' clue-side-btn--active' : ''}${!clues.left ? ' clue-side-btn--empty' : ''}`}
        onClick={() => setEditingSide('left')}
        title="Indice gauche"
      >
        <span className="clue-side-btn__text">{clues.left || 'Gauche'}</span>
      </button>

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

      {/* Desktop (>680px) : input horizontal direct dans la colonne droite */}
      <input
        className="clue-input clue-input--right clue-lateral--desktop"
        value={clues.right}
        onChange={e => setClues(p => ({ ...p, right: e.target.value }))}
        placeholder="Droite"
        maxLength={24}
      />
      {/* Mobile (≤680px) : bouton vertical cliquable → overlay centré */}
      <button
        type="button"
        className={`clue-side-btn clue-side-btn--right clue-lateral--mobile${editingSide === 'right' ? ' clue-side-btn--active' : ''}${!clues.right ? ' clue-side-btn--empty' : ''}`}
        onClick={() => setEditingSide('right')}
        title="Indice droite"
      >
        <span className="clue-side-btn__text">{clues.right || 'Droite'}</span>
      </button>

      <input
        className="clue-input clue-input--bottom"
        value={clues.bottom}
        onChange={e => setClues(p => ({ ...p, bottom: e.target.value }))}
        onFocus={closeSide}
        placeholder="Bas"
        maxLength={24}
      />

      {/* Overlay de saisie centré — mobile uniquement, quand editingSide est défini */}
      {editingSide && (
        <div className="clue-lateral-editor">
          <span className="clue-lateral-label">{SIDE_LABELS[editingSide]}</span>
          <input
            ref={inputRef}
            className="clue-lateral-input"
            value={clues[editingSide]}
            onChange={e => setClues(p => ({ ...p, [editingSide]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && closeSide()}
            placeholder="Indice…"
            maxLength={24}
          />
          <button type="button" className="clue-lateral-confirm" onClick={closeSide}>✓</button>
        </div>
      )}
    </div>
  )
}
