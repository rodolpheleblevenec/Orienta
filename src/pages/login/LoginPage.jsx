import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loading, init, loginWithPseudo } = useAuthStore()
  const [pseudo, setPseudo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { init() }, [])

  useEffect(() => {
    if (!loading && user) navigate('/hub', { replace: true })
  }, [user, loading, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!pseudo.trim()) { setError('Entre un pseudo pour continuer.'); return }
    setSubmitting(true)
    const result = await loginWithPseudo(pseudo)
    setSubmitting(false)
    if (result.error) setError(result.error)
    else navigate('/hub', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-bg-glow" />

      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="login-brand">
          <img src="/favicon.svg" alt="Orienta" className="login-logo" />
          <span className="login-brand-name">Orienta</span>
        </div>

        <h1 className="login-headline">Le jeu de mots<br />de l'équipe WeFiiT</h1>
        <p className="login-tagline">Vos mots, une seule aventure. Relevez le défi du jour, ensemble.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label" htmlFor="pseudo-input">Ton pseudo</label>
          <input
            id="pseudo-input"
            className="pseudo-input"
            type="text"
            placeholder="Entre ton pseudo…"
            value={pseudo}
            onChange={e => setPseudo(e.target.value)}
            maxLength={32}
            autoFocus
            autoComplete="off"
          />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" type="submit" disabled={submitting}>
            {submitting ? (
              <span>Connexion…</span>
            ) : (
              <>
                <span>Jouer maintenant</span>
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="login-hint">
          Nouveau pseudo = nouveau compte<br />Même pseudo = même profil
        </p>
      </motion.div>
    </div>
  )
}
