import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import { setAdminSecret } from '../../lib/adminSecret'
import StreakModal from './StreakModal'
import NotificationsPanel from './NotificationsPanel'
import AdminPasswordModal from './AdminPasswordModal'
import { OnlinePlayerItem } from './OnlinePlayersPanel'
import RankAvatar from './RankAvatar'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import { useOnlinePlayers } from '../../lib/useOnlinePlayers'
import { canSeeRaid, isRaidLaunched } from '../../lib/raid'

const ADMIN_PSEUDO = 'Rodolphe LE BLEVENEC'

export default function Header() {
  const { user, notifCount, logout } = useAuthStore()
  const onlinePlayers = useOnlinePlayers(user)
  const navigate = useNavigate()
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)
  useBodyScrollLock(showStreakModal || showNotifs || navOpen)

  // Fermeture du tiroir mobile à la touche Échap.
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  // Contrôle du mot de passe admin AU CLIC sur la roue crantée : la modal appelle
  // verifyAdminSecret, qui valide le secret côté serveur. L'interface ne s'ouvre
  // que si le mot de passe est correct.
  async function verifyAdminSecret(secret) {
    const { data, error } = await supabase.functions.invoke('admin', {
      body: { admin_secret: secret, action: 'verify' },
    })
    if (error || data?.error) return 'Mot de passe incorrect.'
    setAdminSecret(secret)
    setShowAdminModal(false)
    navigate('/admin/daily')
  }

  const streak = user?.streak_current ?? 0
  const jetons = user?.jetons ?? 0
  const freezes = user?.streak_freeze_tokens ?? 0
  const isAdmin = user?.pseudo === ADMIN_PSEUDO

  return (
    <>
    <header className="topbar">
      <div className="topbar-in">
        <Link to="/hub" className="brand">
          <img src="/favicon.svg" alt="" className="brand-mark" />
          <span className="brand-name">Orienta</span>
        </Link>

        <nav className="top-nav">
          <NavLink to="/hub"        className={({ isActive }) => `nlink${isActive ? ' nlink--active' : ''}`}>Hub</NavLink>
          <NavLink to="/classement" className={({ isActive }) => `nlink${isActive ? ' nlink--active' : ''}`}>Classement</NavLink>
          <NavLink to="/tutoriel"   className={({ isActive }) => `nlink${isActive ? ' nlink--active' : ''}`}>Tutoriel</NavLink>
          {/* Lien RAID : public dès le lancement (lundi 8h) ; avant, admin + testeurs seulement. */}
          {(isRaidLaunched() || canSeeRaid(user?.pseudo)) && (
            <NavLink to="/raid" className={({ isActive }) => `nlink nlink--raid${isActive ? ' nlink--active' : ''}`}>⚔️ Raid</NavLink>
          )}
        </nav>

        <span className="nav-spacer" />

        <button className="jetons-pill" onClick={() => navigate('/quetes')} type="button" title="Tes quêtes & jetons">
          <span className="jetons-coin" aria-hidden="true">🪙</span>
          <span className="jetons-txt">{jetons}</span>
        </button>

        <button className="streak-pill" onClick={() => setShowStreakModal(true)} type="button" title={freezes > 0 ? `Streak ${streak} · ${freezes} protège-série en stock` : 'Votre streak'}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>
          </svg>
          <span className="streak-txt">{streak}</span>
          {freezes > 0 && <span className="streak-shield" aria-hidden="true">🛡️</span>}
        </button>

        <div className="notif-anchor">
          <button className="icon-btn header-notif-btn" onClick={() => setShowNotifs(v => !v)} type="button" title="Notifications" aria-haspopup="true" aria-expanded={showNotifs}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notifCount > 0 && <span className="notif-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
          </button>
          {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
        </div>

        {isAdmin && (
          <button className="icon-btn header-admin-btn" type="button" title="Administration" onClick={() => setShowAdminModal(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        )}

        <span className="topbar-divider" />

        <Link to="/profile" className="me-link">
          <RankAvatar player={user} className="me-ava" />
          <span className="me-name" style={user?.equipped_color ? { color: user.equipped_color } : undefined}>{user?.pseudo}</span>
        </Link>

        <button className="icon-btn logout-btn" type="button" title="Se déconnecter" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>

        <button className="icon-btn burger-btn" type="button" aria-label="Menu" onClick={() => setNavOpen(v => !v)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          {notifCount > 0 && <span className="burger-badge" aria-hidden="true" />}
        </button>
      </div>

    </header>

    {/* ─── Tiroir de navigation mobile ───────────────────────────────
        Rendu HORS de .topbar : le backdrop-filter de la topbar crée un
        bloc englobant qui piégerait un enfant position:fixed. */}
    <div
      className={`nav-scrim${navOpen ? ' nav-scrim--show' : ''}`}
      onClick={() => setNavOpen(false)}
      aria-hidden="true"
    />
    <aside className={`nav-drawer${navOpen ? ' nav-drawer--open' : ''}`} aria-label="Menu" aria-hidden={!navOpen}>
      <div className="nav-drawer-head">
        <Link to="/profile" className="nav-drawer-me" onClick={() => setNavOpen(false)}>
          <RankAvatar player={user} className="nav-drawer-ava" />
          <span className="nav-drawer-id">
            <span className="nav-drawer-name" style={user?.equipped_color ? { color: user.equipped_color } : undefined}>{user?.pseudo}</span>
            <span className="nav-drawer-link">Voir mon profil →</span>
          </span>
        </Link>
        <button className="nav-drawer-close" type="button" aria-label="Fermer le menu" onClick={() => setNavOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="nav-drawer-stats">
        <button className="nav-stat" type="button" onClick={() => { setNavOpen(false); navigate('/quetes') }}>
          <span className="nav-stat-ic nav-stat-ic--jetons" aria-hidden="true">🪙</span>
          <span className="nav-stat-val">{jetons}</span>
          <span className="nav-stat-lbl">jetons</span>
        </button>
        <button className="nav-stat" type="button" onClick={() => { setNavOpen(false); setShowStreakModal(true) }}>
          <span className="nav-stat-ic nav-stat-ic--streak" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>
            </svg>
          </span>
          <span className="nav-stat-val">{streak}</span>
          <span className="nav-stat-lbl">{freezes > 0 ? `série · 🛡️${freezes}` : 'série'}</span>
        </button>
      </div>

      <nav className="nav-drawer-links">
        <NavLink to="/hub"        className={({ isActive }) => `nav-drawer-link-item${isActive ? ' nav-drawer-link-item--active' : ''}`} onClick={() => setNavOpen(false)}>Hub</NavLink>
        <NavLink to="/classement" className={({ isActive }) => `nav-drawer-link-item${isActive ? ' nav-drawer-link-item--active' : ''}`} onClick={() => setNavOpen(false)}>Classement</NavLink>
        <NavLink to="/tutoriel"   className={({ isActive }) => `nav-drawer-link-item${isActive ? ' nav-drawer-link-item--active' : ''}`} onClick={() => setNavOpen(false)}>Tutoriel</NavLink>
        {(isRaidLaunched() || canSeeRaid(user?.pseudo)) && (
          <NavLink to="/raid" className={({ isActive }) => `nav-drawer-link-item nav-drawer-link-item--raid${isActive ? ' nav-drawer-link-item--active' : ''}`} onClick={() => setNavOpen(false)}>⚔️ Raid</NavLink>
        )}
      </nav>

      <div className="nav-drawer-sec">
        <button className="nav-drawer-row" type="button" onClick={() => { setNavOpen(false); setShowNotifs(true) }}>
          <span className="nav-drawer-row-ic" aria-hidden="true">🔔</span>
          Notifications
          {notifCount > 0 && <span className="nav-drawer-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
        </button>
        {isAdmin && (
          <button className="nav-drawer-row" type="button" onClick={() => { setNavOpen(false); setShowAdminModal(true) }}>
            <span className="nav-drawer-row-ic" aria-hidden="true">⚙️</span>
            Administration
          </button>
        )}
      </div>

      {onlinePlayers.length > 0 && (
        <div className="nav-drawer-online">
          <div className="nav-online-head">
            <span className="hub-ldot" />
            En ligne
            <span className="nav-online-count">{onlinePlayers.length}</span>
          </div>
          <ul className="nav-online-list">
            {onlinePlayers.map(p => (
              <OnlinePlayerItem key={p.id} player={p} isMe={p.id === user?.id} />
            ))}
          </ul>
        </div>
      )}

      <button className="nav-drawer-logout" type="button" onClick={() => { setNavOpen(false); logout() }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Se déconnecter
      </button>
    </aside>

    {showStreakModal && <StreakModal onClose={() => setShowStreakModal(false)} />}
    {showAdminModal && <AdminPasswordModal onClose={() => setShowAdminModal(false)} onSubmit={verifyAdminSecret} />}
    </>
  )
}
