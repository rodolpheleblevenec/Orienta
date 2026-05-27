import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export default function Header() {
  const { user } = useAuthStore()
  const streak = user?.streak_current ?? 0

  return (
    <header className="app-header">
      <Link to="/hub" className="header-logo">Orienta</Link>
      <div className="header-right">
        {streak > 0 && (
          <span className="header-streak">🔥 {streak}</span>
        )}
        <Link to="/profile" className="header-avatar">
          {user?.pseudo?.[0]?.toUpperCase() ?? '?'}
        </Link>
      </div>
    </header>
  )
}
