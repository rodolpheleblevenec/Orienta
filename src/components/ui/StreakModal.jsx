export default function StreakModal({ onClose }) {
  return (
    <div className="streak-modal-backdrop" onClick={onClose}>
      <div className="streak-modal" onClick={e => e.stopPropagation()}>
        <div className="streak-modal-header">
          <h2 className="streak-modal-title">🔥 Votre Streak</h2>
          <button className="streak-modal-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="streak-modal-content">
          <div className="streak-section">
            <h3>Comment ça marche ?</h3>
            <p>
              Votre streak représente le nombre de jours consécutifs où vous vous êtes connecté ET avez créé une grille.
            </p>
          </div>

          <div className="streak-section">
            <h3>Maintenir votre streak</h3>
            <ul className="streak-list">
              <li>✓ Connectez-vous tous les jours</li>
              <li>✓ Créez une grille chaque jour</li>
              <li>→ Votre streak augmente de 1 jour</li>
            </ul>
          </div>

          <div className="streak-section">
            <h3>Coefficient multiplicateur</h3>
            <p>
              Plus votre streak est élevé, plus vous gagnez d'XP ! Chaque jour de streak augmente votre coefficient multiplicateur.
            </p>
          </div>

          <div className="streak-section highlight">
            <p>
              💡 Gardez votre streak actif pour maximiser vos gains d'expérience !
            </p>
          </div>
        </div>

        <button className="btn-primary streak-modal-btn" onClick={onClose} type="button">
          Compris
        </button>
      </div>
    </div>
  )
}
