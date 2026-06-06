import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

// 'YYYY-MM-DD' → 'lundi 14 juin'
function formatDailyDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Modale d'accompagnement du gagnant : à la connexion, on lui annonce sa victoire
// et son droit de créer la grille du jour de J+3. Affichée une seule fois (onboarding_seen_at).
export default function WinnerWelcomeModal({ grant, onClose }) {
  useBodyScrollLock()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  async function markSeen() {
    if (!user || !grant) return
    await supabase.functions
      .invoke('account', { body: { action: 'grant-seen', user_id: user.id, grant_id: grant.id } })
      .catch(() => {})
  }

  function handleCreate() {
    markSeen()
    navigate(`/create?grant=${grant.id}`)
  }

  function handleLater() {
    markSeen()
    onClose()
  }

  return (
    <div className="winner-modal-backdrop" onClick={handleLater}>
      <motion.div
        className="winner-modal"
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="winner-modal-emoji">🏆</div>
        <h2 className="winner-modal-title">Tu as gagné la grille d'hier&nbsp;!</h2>
        <p className="winner-modal-text">
          Bravo, tu termines <strong>1ᵉʳ</strong> du classement. Ta récompense&nbsp;: tu gagnes le droit de composer
          {' '}<strong>la grille du jour du {formatDailyDate(grant?.target_date)}</strong> — celle que toute la communauté jouera ce jour-là.
        </p>
        <p className="winner-modal-sub">
          Prends ton temps pour la créer d'ici là. Prêt à relever le défi&nbsp;?
        </p>
        <div className="winner-modal-actions">
          <button className="btn-primary" onClick={handleCreate} type="button">Créer ma grille du jour</button>
          <button className="btn-secondary" onClick={handleLater} type="button">Plus tard</button>
        </div>
      </motion.div>
    </div>
  )
}
