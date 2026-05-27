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
          <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <span className="header-tutorial-label">Tutoriel</span>
        </button>
        <button
          className="header-logout-btn"
          onClick={() => setShowLogoutConfirm(true)}
          title="Déconnexion"
          type="button"
        >
          <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 3l5 5M21 3l-5 5M16 17l4 0M21 17l-5 0M21 17v2a2 2 0 0 1-2 2h-4"/>
          </svg>
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
