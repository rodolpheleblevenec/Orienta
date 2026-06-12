import { getCardColor } from '../../lib/cardColors'

const NUMERALS = ['①', '②', '③', '④']
const handleIndex = (h) => Number(String(h).replace('c', '')) || 0
const SIDE_LABELS = { top: 'encoche ↑', right: '→', bottom: '↓', left: '←' }

// Panneau d'information SCOPED : n'affiche que ce que l'organe a le droit de voir
// (indices et/ou mots). Ces données viennent du serveur (action `state`), jamais
// du board public. À décrire à l'équipe via le chat.
export default function OeilPanel({ view }) {
  const clues = view?.clues
  const words = view?.words
  if (!clues && !words) return null

  return (
    <div className="raid-oeil">
      {clues && (
        <div className="raid-oeil-block">
          <div className="raid-oeil-title">🔭 Indices (cibles des côtés)</div>
          <ul className="raid-clue-list">
            <li><b>Haut</b> · {clues.top || '—'}</li>
            <li><b>Droite</b> · {clues.right || '—'}</li>
            <li><b>Bas</b> · {clues.bottom || '—'}</li>
            <li><b>Gauche</b> · {clues.left || '—'}</li>
          </ul>
        </div>
      )}

      {words && (
        <div className="raid-oeil-block">
          <div className="raid-oeil-title">📖 Mots des cartes</div>
          <div className="raid-words-grid">
            {Object.entries(words).map(([handle, w]) => {
              const idx = handleIndex(handle)
              const { border } = getCardColor(idx)
              return (
                <div key={handle} className="raid-words-card" style={{ borderColor: border }}>
                  <span className="raid-words-num" style={{ color: border }}>{NUMERALS[idx]}</span>
                  <ul className="raid-words-sides">
                    {['top', 'right', 'bottom', 'left'].map(side => (
                      <li key={side}><span className="raid-words-side">{SIDE_LABELS[side]}</span> {w?.[side] || '—'}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
