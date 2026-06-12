import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import { CREATURES } from '../../lib/creatures'
import { MARINE_ITEMS } from '../../lib/marineItems'

// Premier palier ajouté par la mise à jour : tout ce qui est >= à ce niveau
// est « nouveau » et présenté dans la modale d'annonce.
const NEW_FROM_LEVEL = 11

// Modale « Découvrez vos nouveaux compagnons » — annoncée une seule fois par
// joueur à la connexion (flag new_wojo_seen, via l'action `flag` de l'edge
// function account). Liste les nouvelles créatures collectives + les nouveaux
// skins persos, puis renvoie vers le profil pour les voir/débloquer.
export default function NewWojoModal({ onClose }) {
  useBodyScrollLock()
  const navigate = useNavigate()
  const { markTourDone } = useAuthStore()

  const newCreatures = CREATURES.filter(c => c.level >= NEW_FROM_LEVEL)
  const newSkins = MARINE_ITEMS.filter(m => m.level >= NEW_FROM_LEVEL)

  // Marque comme vu (optimiste + persistance serveur). markTourDone gère le
  // resync en cas d'échec réseau.
  function markSeen() {
    markTourDone('new_wojo_seen')
  }
  function handleSee() {
    markSeen()
    navigate('/profile')
  }
  function handleClose() {
    markSeen()
    onClose()
  }

  // Animation en cascade partagée entre les deux grilles.
  let order = 0
  const pop = () => ({
    initial: { opacity: 0, scale: 0.5, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { delay: 0.12 + (order++) * 0.035, type: 'spring', stiffness: 320, damping: 22 },
  })

  return (
    <div className="wojo-modal-backdrop" onClick={handleClose}>
      <motion.div
        className="wojo-modal"
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        onClick={e => e.stopPropagation()}
      >
        <button className="wojo-modal-close" onClick={handleClose} type="button" aria-label="Fermer">✕</button>

        <div className="wojo-modal-spark">✨</div>
        <h2 className="wojo-modal-title">Découvrez vos nouveaux compagnons</h2>
        <p className="wojo-modal-sub">
          De nouveaux paliers viennent d'arriver&nbsp;! Voici tout ce qu'il reste à débloquer.
        </p>

        <div className="wojo-modal-scroll">
          <section className="wojo-modal-section">
            <div className="wojo-modal-section-head">
              <span className="wojo-modal-section-title">🌊 Créatures collectives</span>
              <span className="wojo-modal-count">{newCreatures.length}</span>
            </div>
            <div className="wojo-modal-grid">
              {newCreatures.map(c => (
                <motion.div key={`c-${c.level}`} className="wojo-modal-item" {...pop()}>
                  <span className="wojo-modal-emoji">{c.emoji}</span>
                  <span className="wojo-modal-name">{c.name}</span>
                  <span className="wojo-modal-lvl">Niv {c.level}</span>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="wojo-modal-section">
            <div className="wojo-modal-section-head">
              <span className="wojo-modal-section-title">🎨 Skins à débloquer</span>
              <span className="wojo-modal-count">{newSkins.length}</span>
            </div>
            <div className="wojo-modal-grid">
              {newSkins.map(m => (
                <motion.div key={`m-${m.level}`} className="wojo-modal-item" {...pop()}>
                  <span className="wojo-modal-emoji">{m.name.split(' ')[0]}</span>
                  <span className="wojo-modal-name">{m.name.split(' ').slice(1).join(' ')}</span>
                  <span className="wojo-modal-lvl">Niv {m.level}</span>
                </motion.div>
              ))}
            </div>
          </section>
        </div>

        <div className="wojo-modal-actions">
          <button className="btn-primary" onClick={handleSee} type="button">Voir →</button>
          <button className="btn-secondary" onClick={handleClose} type="button">Plus tard</button>
        </div>
      </motion.div>
    </div>
  )
}
