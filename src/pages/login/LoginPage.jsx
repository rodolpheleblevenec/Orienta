import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import { getLevelProgressCollective } from '../../lib/levels'
import { getCreature } from '../../lib/creatures'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loading, init, loginWithPseudo } = useAuthStore()
  const [pseudo, setPseudo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [collective, setCollective] = useState(null)

  useEffect(() => {
    supabase
      .from('orienta_collective_progress')
      .select('total_xp, level')
      .eq('id', 1)
      .single()
      .then(({ data }) => data && setCollective(data))
  }, [])

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
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="login-brand">
          <div className="login-brand-dot">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M7 1v12M1 7h12"/>
            </svg>
          </div>
          <span className="login-brand-name">Orienta</span>
        </div>
        <p className="login-tagline">Le jeu de mots quotidien de l'équipe WeFiiT</p>

        {collective && (() => {
          const { currentLevel } = getLevelProgressCollective(collective.total_xp)
          const creature = getCreature(currentLevel.level)
          return (
            <div className="login-mascot-preview">
              <span className="mascot-emoji">{creature.emoji}</span>
              <span className="mascot-label">Niveau {currentLevel.level} — {currentLevel.name}</span>
            </div>
          )
        })()}

        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="pseudo-input"
            type="text"
            placeholder="Ton pseudo…"
            value={pseudo}
            onChange={e => setPseudo(e.target.value)}
            maxLength={32}
            autoFocus
            autoComplete="off"
          />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" type="submit" disabled={submitting}>
            {submitting ? 'Connexion…' : 'Jouer →'}
          </button>
        </form>

        <p className="login-hint">
          Nouveau pseudo = nouveau compte. Même pseudo = même profil.
        </p>
      </motion.div>
    </div>
  )
}
