import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { useAuthStore } from '../../stores/authStore'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

const CX = 120, CY = 128, R = 104

// Point sur le cercle (angle en degrés depuis le haut, sens horaire) à un rayon donné.
function ptR(angleDeg, rr) {
  const a = (angleDeg - 90) * Math.PI / 180
  return [CX + rr * Math.cos(a), CY + rr * Math.sin(a)]
}

function rewardText(seg) {
  if (!seg) return null
  switch (seg.reward_type) {
    case 'jetons':        return `Tu gagnes 🪙 ${seg.reward_value} !`
    case 'streak_freeze': return `Tu gagnes ${seg.reward_value} protège-série 🛡️ !`
    case 'create_slot':   return `Tu gagnes ${seg.reward_value} création en plus ➕ !`
    default:              return 'Pas de chance, rien cette fois 😅'
  }
}

// Confettis sur un vrai gain (intensité forte pour les lots rares / gros jetons).
function celebrate(seg) {
  if (!seg || seg.reward_type === 'nothing') return
  const big = seg.reward_type !== 'jetons' || seg.reward_value >= 50
  confetti({
    particleCount: big ? 170 : 70,
    spread: big ? 110 : 65,
    startVelocity: big ? 45 : 32,
    origin: { y: 0.42 },
    scalar: big ? 1.1 : 0.9,
  })
}

export default function WheelModal({ onClose }) {
  useBodyScrollLock()
  const { user, wheel, fetchWheel, spinWheel } = useAuthStore()
  const segments = wheel?.segments ?? []
  const cost = wheel?.cost ?? null
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const jetons = user?.jetons ?? 0

  useEffect(() => { fetchWheel() }, [])

  const n = segments.length
  const seg = n > 0 ? 360 / n : 0

  async function handleSpin() {
    if (spinning || n === 0) return
    setResult(null); setError(null); setSpinning(true)
    const res = await spinWheel()
    if (!res?.ok) {
      setSpinning(false)
      setError(res?.error === 'insufficient_funds' ? 'Solde insuffisant.' : 'Échec du tour, réessaie.')
      return
    }
    const pos = segments.findIndex(s => s.idx === res.segment.idx)
    const target = pos >= 0 ? pos : 0
    // Amène le centre du segment gagné sous le pointeur (haut), + 6 tours complets.
    const targetMod = (360 - (((target + 0.5) * seg) % 360)) % 360
    setRotation(prev => {
      const delta = (((targetMod - (prev % 360)) % 360) + 360) % 360 + 360 * 6
      return prev + delta
    })
    setTimeout(() => { setResult(res.segment); setSpinning(false); celebrate(res.segment) }, 4700)
  }

  const won = result && result.reward_type !== 'nothing'

  return (
    <div className="streak-modal-backdrop" onClick={spinning ? undefined : onClose}>
      <div className="streak-modal wheel-modal" onClick={e => e.stopPropagation()}>
        <div className="streak-modal-header">
          <h2 className="streak-modal-title">🎡 Roue de la fortune</h2>
          <button className="streak-modal-close" onClick={onClose} type="button" disabled={spinning}>✕</button>
        </div>

        <div className="quests-modal-balance">
          Solde&nbsp;: <strong>🪙 {jetons} jeton{jetons !== 1 ? 's' : ''}</strong>
        </div>

        <div className="wheel-wrap">
          <svg viewBox="0 0 240 268" className="wheel-svg" role="img" aria-label="Roue de la fortune">
            <defs>
              <radialGradient id="wheelRim" cx="50%" cy="42%" r="60%">
                <stop offset="0%" stopColor="#f7e3a6" />
                <stop offset="55%" stopColor="#e8b84b" />
                <stop offset="100%" stopColor="#b9892a" />
              </radialGradient>
            </defs>

            {/* Jante extérieure dorée */}
            <circle cx={CX} cy={CY} r={R + 9} fill="url(#wheelRim)" />
            <circle cx={CX} cy={CY} r={R + 3} fill="var(--ink)" opacity="0.10" />

            {/* Rotor (segments) */}
            <g className="wheel-rotor" style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
              {segments.map((s, i) => {
                const a0 = i * seg, a1 = (i + 1) * seg
                const [x0, y0] = ptR(a0, R)
                const [x1, y1] = ptR(a1, R)
                const large = seg > 180 ? 1 : 0
                const mid = (i + 0.5) * seg
                const [lx, ly] = ptR(mid, R * 0.64)
                let rot = mid
                if (mid > 90 && mid < 270) rot += 180
                return (
                  <g key={s.idx}>
                    <path d={`M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`}
                      fill={s.color} stroke="#ffffff" strokeWidth="2" />
                    <text x={lx} y={ly} transform={`rotate(${rot} ${lx} ${ly})`}
                      textAnchor="middle" dominantBaseline="middle"
                      className="wheel-label">{s.label}</text>
                  </g>
                )
              })}
              {/* Moyeu central */}
              <circle cx={CX} cy={CY} r="17" fill="#fff" stroke="url(#wheelRim)" strokeWidth="4" />
              <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontSize="15">✨</text>
            </g>

            {/* Pointeur fixe en haut */}
            <g className="wheel-pointer">
              <circle cx={CX} cy="16" r="11" fill="var(--ink)" />
              <polygon points={`${CX - 9},14 ${CX + 9},14 ${CX},34`} fill="var(--ink)" />
              <circle cx={CX} cy="16" r="4" fill="#fff" />
            </g>
          </svg>
        </div>

        {result ? (
          <div className={`wheel-result${won ? ' wheel-result--win' : ' wheel-result--none'}`}>
            {rewardText(result)}
          </div>
        ) : error ? (
          <div className="wheel-result wheel-result--none">{error}</div>
        ) : (
          <div className="wheel-hint">Souvent rien… mais parfois le jackpot 💎</div>
        )}

        <button
          className="btn-primary wheel-spin-btn"
          onClick={handleSpin}
          disabled={spinning || n === 0 || (cost != null && jetons < cost)}
        >
          {spinning ? 'La roue tourne…' : result ? (cost != null ? `Retenter · 🪙${cost}` : 'Retenter') : cost != null ? `Tourner · 🪙${cost}` : 'Tourner'}
        </button>
        {cost != null && jetons < cost && !spinning && (
          <p className="wheel-broke">Il te faut 🪙{cost} pour tourner.</p>
        )}
      </div>
    </div>
  )
}
