import { useState } from 'react'

// Petite bannière d'aide en tête de l'arène : rappelle en 3 temps comment se joue
// le RAID, pour guider les nouveaux venus. Masquable (mémorisé en localStorage).
const STORAGE_KEY = 'orienta_raid_intro_dismissed'

const STEPS = [
  { emoji: '🎭', title: 'Prends un rôle', text: 'Chaque organe a des pouvoirs uniques — et personne ne voit tout.' },
  { emoji: '🗣️', title: 'Parlez-vous', text: 'L’un voit, l’autre agit : coordonnez-vous dans le chat pour avancer.' },
  { emoji: '⚔️', title: 'Battez le boss', text: 'Placez les 4 bonnes cartes à chaque assaut, avant la fin du chrono.' },
]

export default function RaidIntroBanner() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })
  if (hidden) return null
  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setHidden(true)
  }

  return (
    <div className="raid-intro">
      <button type="button" className="raid-intro-close" onClick={dismiss} aria-label="Masquer l’aide">✕</button>
      <div className="raid-intro-head">
        <span className="raid-intro-emoji">⚔️</span>
        <div>
          <h2 className="raid-intro-title">Le Boss d’Équipage, en 30 secondes</h2>
          <p className="raid-intro-sub">Un boss coopératif : seuls vous n’y arriverez pas — à plusieurs, oui.</p>
        </div>
      </div>
      <ol className="raid-intro-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="raid-intro-step">
            <span className="raid-intro-step-emoji">{s.emoji}</span>
            <span className="raid-intro-step-txt">
              <b>{i + 1}. {s.title}</b>
              {s.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
