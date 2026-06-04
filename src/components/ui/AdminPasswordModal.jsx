import { useState, useRef, useEffect } from 'react'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

// Modal intégrée de saisie du mot de passe admin (remplace window.prompt).
// onSubmit(secret) : async, renvoie un message d'erreur (string) en cas d'échec,
// ou rien si OK — le parent ferme alors la modal.
export default function AdminPasswordModal({ onClose, onSubmit }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const inputRef = useRef(null)
  useBodyScrollLock()

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !verifying) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, verifying])

  async function submit(e) {
    e.preventDefault()
    if (verifying || !value.trim()) return
    setVerifying(true)
    setError('')
    const err = await onSubmit(value)
    if (err) {
      setError(err)
      setVerifying(false)
    }
    // En cas de succès, le parent démonte la modal — pas besoin d'en faire plus.
  }

  return (
    <div className="admin-pwd-backdrop" onClick={() => !verifying && onClose()}>
      <form className="admin-pwd-modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <div className="admin-pwd-header">
          <h2 className="admin-pwd-title">🔒 Accès administration</h2>
          <button type="button" className="admin-pwd-close" onClick={onClose} disabled={verifying}>✕</button>
        </div>

        <p className="admin-pwd-desc">
          Saisissez le mot de passe administrateur pour ouvrir l'interface.
        </p>

        <input
          ref={inputRef}
          type="password"
          className="admin-pwd-input"
          placeholder="Mot de passe"
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          disabled={verifying}
          autoComplete="current-password"
        />

        {error && <p className="admin-pwd-error">{error}</p>}

        <div className="admin-pwd-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={verifying}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={verifying || !value.trim()}>
            {verifying ? 'Vérification…' : 'Entrer'}
          </button>
        </div>
      </form>
    </div>
  )
}
