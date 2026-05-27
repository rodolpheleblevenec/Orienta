import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { getMarineItem } from '../../lib/marineItems'

export default function Header() {
  const { user, openTutorial } = useAuthStore()
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
    </header>
  )
}
