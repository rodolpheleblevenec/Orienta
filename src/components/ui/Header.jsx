import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { getMarineItem } from '../../lib/marineItems'

export default function Header() {
  const { user, openTutorial, logout } = useAuthStore()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const streak = user?.streak_current ?? 0

  return (
    <header className="app-header">
      <Link to="/hub" className="header-logo">Orienta</Link>
      <div className="header-right">
        {streak > 0 && (
          <span className="header-streak">🔥 {streak}</span>
        )}
        <button
          className="header-tutorial"
          onClick={openTutorial}
          title="Tutoriel"
          type="button"
        >
          <span className="header-tutorial-icon">🎓</span>
          <span className="header-tutorial-label">Tutoriel</span>
        </button>
        <button
          className="header-logout-btn"
          onClick={() => setShowLogoutConfirm(true)}
          title="Déconnexion"
          type="button"
        >
          <span className="header-logout-icon">🚪</span>
        </button>
        <Link to="/profile" className="header-profile">
          <div className="header-avatar">
            {user?.selected_skin > 1 ? (
              getMarineItem(user.selected_skin).Component({ size: 20 })
            ) : (
              user?.pseudo?.[0]?.toUpperCase() ?? '?'
            )}
          </div>
          <span className="header-profile-label">Profil</span>
        </Link>
      </div>
      {showLogoutConfirm && (
        <div className="logout-modal-backdrop" onClick={() => setShowLogoutConfirm(false)}>
          <div className="logout-modal" onClick={e => e.stopPropagation()}>
            <h3>Changer de profil ?</h3>
            <p>Vous serez déconnecté et retournerez à la sélection de profil.</p>
            <div className="logout-modal-buttons">
              <button className="btn-secondary" onClick={() => setShowLogoutConfirm(false)} type="button">
                Annuler
              </button>
              <button className="btn-primary" onClick={logout} type="button">
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
