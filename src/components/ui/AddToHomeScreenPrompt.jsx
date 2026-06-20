import { useEffect, useState } from 'react'
import { isIosSafari, isStandalone } from '../../lib/pwa'

// Bandeau d'aide « Ajouter à l'écran d'accueil », montré UNIQUEMENT aux visiteurs
// iPhone/iPad sous Safari qui n'ont pas encore installé le site. iOS n'autorisant
// pas l'installation automatique, on se contente d'indiquer la marche à suivre
// (bouton Partager → « Sur l'écran d'accueil »). Refermable, et on ne le remontre
// pas avant un bon moment une fois fermé.

const DISMISS_KEY = 'orienta_a2hs_dismissed_at'
const SNOOZE_MS = 21 * 24 * 60 * 60 * 1000 // 3 semaines avant de reproposer
const SHOW_DELAY_MS = 1500 // petit délai pour ne pas surgir brutalement à l'arrivée

function recentlyDismissed() {
  try {
    const v = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return v > 0 && Date.now() - v < SNOOZE_MS
  } catch {
    return false
  }
}

// Icône « Partager » d'iOS (carré + flèche vers le haut).
function ShareGlyph() {
  return (
    <svg className="a2hs-share" width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V4" />
      <path d="M8.5 7.5 12 4l3.5 3.5" />
      <path d="M6 11H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" />
    </svg>
  )
}

export default function AddToHomeScreenPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isIosSafari() || isStandalone() || recentlyDismissed()) return
    const t = setTimeout(() => setShow(true), SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  if (!show) return null

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* stockage indispo */ }
    setShow(false)
  }

  return (
    <div className="a2hs" role="dialog" aria-label="Ajouter Orienta à l'écran d'accueil">
      <button type="button" className="a2hs-close" onClick={close} aria-label="Fermer">×</button>
      <img className="a2hs-icon" src="/apple-touch-icon.png" alt="" width="44" height="44" />
      <div className="a2hs-text">
        <strong>Installez Orienta sur votre iPhone</strong>
        <span>
          Appuyez sur <ShareGlyph /> <b>Partager</b> en bas, puis sur{' '}
          <b>« Sur l'écran d'accueil »</b> — vous le retrouverez comme une appli.
        </span>
      </div>
      <span className="a2hs-arrow" aria-hidden="true">⌄</span>
    </div>
  )
}
