import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export default function RequireAuth({ children }) {
  const { user, loading, init } = useAuthStore()

  useEffect(() => { init() }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--text-secondary)' }}>
        Chargement…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return children
}
