import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import StreakModal from './StreakModal'
import NotificationsPanel from './NotificationsPanel'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

const ADMIN_PSEUDO = 'Rodolphe LE BLEVENEC'

export default function Header() {
  const { user, notifCount } = useAuthStore()
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  useBodyScrollLock(showStreakModal || showNotifs)

  const streak = user?.streak_current ?? 0
  const isAdmin = user?.pseudo === ADMIN_PSEUDO
  const initial = user?.pseudo?.[0]?.toUpperCase() ?? '?'

  return (
    <>
    <header className="topbar">
      <div className="topbar-in">
        <Link to="/hub" className="brand">
          <span className="brand-mark" />
          Orienta
        </Link>

        <nav className={`top-nav${navOpen ? ' top-nav--open' : ''}`}>
          <NavLink to="/hub"        className={({ isActive }) => `nlink${isActive ? ' nlink--active' : ''}`} onClick={() => setNavOpen(false)}>Hub</NavLink>
          <NavLink to="/classement" className={({ isActive }) => `nlink${isActive ? ' nlink--active' : ''}`} onClick={() => setNavOpen(false)}>Classement</NavLink>
          <NavLink to="/tutoriel"   className={({ isActive }) => `nlink${isActive ? ' nlink--active' : ''}`} onClick={() => setNavOpen(false)}>Tutoriel</NavLink>
        </nav>

        <span className="nav-spacer" />

        <button className="streak-pill" onClick={() => setShowStreakModal(true)} type="button" title="Votre streak">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>
          </svg>
          <span className="streak-txt">{streak}</span>
        </button>

        <button className="icon-btn header-notif-btn" onClick={() => setShowNotifs(true)} type="button" title="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {notifCount > 0 && <span className="notif-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
        </button>

        {isAdmin && (
          <Link to="/admin/daily" className="icon-btn" title="Administration">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </Link>
        )}

        <span className="topbar-divider" />

        <Link to="/profile" className="me-link">
          <span className="me-ava">{initial}</span>
          <span className="me-name">{user?.pseudo}</span>
        </Link>

        <button className="icon-btn burger-btn" type="button" aria-label="Menu" onClick={() => setNavOpen(v => !v)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

    </header>
    {showStreakModal && <StreakModal onClose={() => setShowStreakModal(false)} />}
    {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
    </>
  )
}
