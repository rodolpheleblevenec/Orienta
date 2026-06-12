import { useState } from 'react'
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
import { canSeeRaid } from '../../lib/raid'

const ADMIN_PSEUDO = 'Rodolphe LE BLEVENEC'

export default function Header() {
  const { user, notifCount, logout } = useAuthStore()
  const onlinePlayers = useOnlinePlayers(user)
  const navigate = useNavigate()
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)
  useBodyScrollLock(showStreakModal || showNotifs)

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

        <nav className={`top-nav${navOpen ? ' top-nav--open' : ''}`}>
          <NavLink to="/hub"        className={({ isActive }) => `nlink${isActive ? ' nlink--active' : ''}`} onClick={() => setNavOpen(false)}>Hub</NavLink>
          <NavLink to="/classement" className={({ isActive }) => `nlink${isActive ? ' nlink--active' : ''}`} onClick={() => setNavOpen(false)}>Classement</NavLink>
          <NavLink to="/tutoriel"   className={({ isActive }) => `nlink${isActive ? ' nlink--active' : ''}`} onClick={() => setNavOpen(false)}>Tutoriel</NavLink>
          {/* Lien RAID visible pour l'admin ET les comptes testeurs (Testeur 1–4) tant que la feature est en test en prod. */}
          {canSeeRaid(user?.pseudo) && (
            <NavLink to="/raid" className={({ isActive }) => `nlink nlink--raid${isActive ? ' nlink--active' : ''}`} onClick={() => setNavOpen(false)}>⚔️ RAID</NavLink>
          )}

          {/* Notifications — déplacées dans le burger sur mobile (header allégé). */}
          <button className="nlink nav-notif-mobile" type="button" onClick={() => { setNavOpen(false); setShowNotifs(true) }}>
            🔔 Notifications
            {notifCount > 0 && <span className="nav-notif-count">{notifCount > 9 ? '9+' : notifCount}</span>}
          </button>

          {/* Joueurs en ligne — visible uniquement dans le burger (mobile). */}
          {onlinePlayers.length > 0 && (
            <div className="nav-online">
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

          <button className="nlink nlink-logout-mobile" type="button" onClick={() => { setNavOpen(false); logout() }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{marginRight: '6px', flexShrink: 0}}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Se déconnecter
          </button>
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
    {showStreakModal && <StreakModal onClose={() => setShowStreakModal(false)} />}
    {showAdminModal && <AdminPasswordModal onClose={() => setShowAdminModal(false)} onSubmit={verifyAdminSecret} />}
    </>
  )
}
