import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { getMarineItem } from '../../lib/marineItems'
import StreakModal from './StreakModal'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

const ADMIN_PSEUDO = 'Rodolphe LE BLEVENEC'

export default function Header() {
  const { user, openTutorial, logout } = useAuthStore()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showStreakModal, setShowStreakModal] = useState(false)
  useBodyScrollLock(showLogoutConfirm)
  const streak = user?.streak_current ?? 0
  const isAdmin = user?.pseudo === ADMIN_PSEUDO

  return (
    <header className="app-header">
      <Link to="/hub" className="header-logo">Orienta</Link>
      <div className="header-right">
        {isAdmin && (
          <Link to="/admin/daily" className="header-item header-item--admin" title="Administration">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </Link>
        )}
        <button
          className="header-item"
          onClick={() => setShowStreakModal(true)}
          title="Votre Streak"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>
          </svg>
          {streak}
        </button>
        <button
          className="header-item"
          onClick={openTutorial}
          title="Tutoriel"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <line x1="10" y1="8" x2="14" y2="8"/>
            <line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
          Tutoriel
        </button>
        <Link to="/profile" className="header-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Profil
        </Link>
        <button
          className="logout-btn"
          onClick={() => setShowLogoutConfirm(true)}
          title="Déconnexion"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
      {showStreakModal && <StreakModal onClose={() => setShowStreakModal(false)} />}
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
