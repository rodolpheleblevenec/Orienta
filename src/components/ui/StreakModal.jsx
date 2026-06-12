import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import { useAuthStore } from '../../stores/authStore'

export default function StreakModal({ onClose }) {
  useBodyScrollLock()
  const { user } = useAuthStore()
  const freezes = user?.streak_freeze_tokens ?? 0

  return (
    <div className="streak-modal-backdrop" onClick={onClose}>
      <div className="streak-modal" onClick={e => e.stopPropagation()}>
        <div className="streak-modal-header">
          <h2 className="streak-modal-title">🔥 Votre Streak</h2>
          <button className="streak-modal-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="streak-modal-content">
          <div className="streak-section streak-section--freeze">
            <h3>🛡️ Protège-série : {freezes} en stock</h3>
            <p>
              {freezes > 0
                ? <>Si tu rates un jour, un protège-série est <strong>utilisé automatiquement</strong> à ta prochaine partie pour ne pas casser ta série. Aucune action à faire.</>
                : <>Tu n'en as aucun. Achètes-en dans la <strong>boutique 🪙</strong> : si tu rates un jour, il sauve ta série automatiquement.</>}
            </p>
          </div>
          <div className="streak-section">
            <h3>C'est quoi un streak ?</h3>
            <p>
              Votre streak, c'est le nombre de jours consécutifs où vous avez <strong>joué une grille</strong>.
              Chaque jour joué fait monter votre streak. Un jour sans jouer le remet à zéro.
            </p>
          </div>

          <div className="streak-section">
            <h3>Bonus XP streak</h3>
            <p>
              À chaque grille réussie, votre streak vous rapporte des XP supplémentaires :
            </p>
            <ul className="streak-list">
              <li>+2 XP par jour de streak</li>
              <li>Plafonné à +30 XP maximum (15 jours et plus)</li>
            </ul>
          </div>

          <div className="streak-section highlight">
            <p>
              💡 Jouez chaque jour pour faire grimper votre streak et maximiser vos gains d'XP !
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
