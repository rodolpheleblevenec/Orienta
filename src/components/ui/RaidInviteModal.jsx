import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

// Modale d'invitation au RAID — reçue en temps réel quand un joueur clique
// « Jouez ensemble » dans la vitrine des connectés (canal hub-online partagé).
// Accepter → rejoindre le SAS public (/raid), où tous les invités convergent.
export default function RaidInviteModal({ invite, onClose }) {
  useBodyScrollLock()
  const navigate = useNavigate()

  // Auto-expiration : une invitation laissée sans réponse disparaît au bout de 30 s.
  useEffect(() => {
    const t = setTimeout(onClose, 30000)
    return () => clearTimeout(t)
  }, [invite?.ts, onClose])

  function join() {
    onClose()
    navigate('/raid')
  }

  return (
    <div className="winner-modal-backdrop" onClick={onClose}>
      <motion.div
        className="winner-modal raid-invite-modal"
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="winner-modal-emoji">⚔️</div>
        <h2 className="winner-modal-title">
          Les joueurs en ligne vous invitent à rejoindre le raid&nbsp;!
        </h2>
        <p className="winner-modal-text">
          Affrontez le boss en équipage, en temps réel. Souhaitez-vous rejoindre le SAS&nbsp;?
        </p>
        <div className="winner-modal-actions">
          <button className="btn-primary" onClick={join} type="button">Rejoindre le SAS</button>
          <button className="btn-secondary" onClick={onClose} type="button">Plus tard</button>
        </div>
      </motion.div>
    </div>
  )
}
