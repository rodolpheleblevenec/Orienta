import WordCard from './WordCard'

export default function CardTray({ cards, onRotate }) {
  if (!cards || cards.length === 0) return null
  return (
    <div className="card-tray">
      <p className="card-tray-label">Cartes à placer</p>
      <div className="card-tray-items">
        {cards.map(({ card, rotation }) => (
          <div key={card.id} className="card-tray-item">
            <WordCard
              id={`tray-${card.id}`}
              card={card}
              rotation={rotation ?? 0}
              onRotate={onRotate ? () => onRotate(card.id) : undefined}
              draggable
            />
          </div>
        ))}
      </div>
    </div>
  )
}
