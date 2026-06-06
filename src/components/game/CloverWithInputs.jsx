import { useState, useRef, useEffect } from 'react'
import WordCard from './WordCard'
import { DroppableSlot } from './CloverGrid'

const SIDE_LABELS = { left: '← Gauche', right: 'Droite →' }

export default function CloverWithInputs({ placements, clues, setClues, onRotate, draggable = false, slotAction, disableTransition = false }) {
  const [editingSide, setEditingSide] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editingSide && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingSide])

  const closeSide = () => setEditingSide(null)

  // Règle : un seul mot par indice → on refuse toute saisie contenant un espace.
  const setClue = (side, value) => {
    if (value.includes(' ')) return
    setClues(p => ({ ...p, [side]: value }))
  }

  return (
    <div className="clover-wrapper">
      <input
        className="clue-input clue-input--top"
        value={clues.top}
        onChange={e => setClue('top', e.target.value)}
        onFocus={closeSide}
        placeholder="Haut"
        maxLength={24}
      />

      {/* Desktop (>680px) : input horizontal direct dans la colonne gauche */}
      <input
        className="clue-input clue-input--left clue-lateral--desktop"
        value={clues.left}
        onChange={e => setClue('left', e.target.value)}
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
              disableTransition={disableTransition}
              slotAction={slotAction}
            />
          ) : (
            <div key={pos} className={`clover-slot${slotAction ? ' clover-slot--action' : ''}`}>
              {placements[pos] ? (
                <WordCard
                  id={`placed-${placements[pos].card.id}-${pos}`}
                  card={placements[pos].card}
                  rotation={placements[pos].rotation}
                  colorIndex={placements[pos].colorIndex ?? 0}
                  onRotate={() => onRotate(pos)}
                  disableTransition={disableTransition}
                  draggable={false}
                />
              ) : (
                <div className="clover-slot-placeholder" />
              )}
              {slotAction && slotAction(pos)}
            </div>
          )
        ))}
      </div>

      {/* Desktop (>680px) : input horizontal direct dans la colonne droite */}
      <input
        className="clue-input clue-input--right clue-lateral--desktop"
        value={clues.right}
        onChange={e => setClue('right', e.target.value)}
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
        onChange={e => setClue('bottom', e.target.value)}
        onFocus={closeSide}
        placeholder="Bas"
        maxLength={24}
      />

      {/* Overlay de saisie centré — mobile uniquement, quand editingSide est défini */}
      {editingSide && (
        <>
          <div className="clue-lateral-backdrop" onClick={closeSide} />
          <div className="clue-lateral-editor">
            <span className="clue-lateral-label">{SIDE_LABELS[editingSide]}</span>
            <input
              ref={inputRef}
              className="clue-lateral-input"
              value={clues[editingSide]}
              onChange={e => setClue(editingSide, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && closeSide()}
              onBlur={closeSide}
              placeholder="Indice…"
              maxLength={24}
            />
          </div>
        </>
      )}
    </div>
  )
}
