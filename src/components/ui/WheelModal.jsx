import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

const CX = 110, CY = 118, R = 102

// Point sur le cercle (angle en degrés depuis le haut, sens horaire) à un rayon donné.
function ptR(angleDeg, rr) {
  const a = (angleDeg - 90) * Math.PI / 180
  return [CX + rr * Math.cos(a), CY + rr * Math.sin(a)]
}

function rewardText(seg) {
  if (!seg) return null
  switch (seg.reward_type) {
    case 'jetons':       return `+🪙${seg.reward_value} !`
    case 'streak_freeze':return `+${seg.reward_value} protège-série 🛡️ !`
    case 'create_slot':  return `+${seg.reward_value} création en plus ➕ !`
    default:             return 'Pas de chance, rien cette fois 😅'
  }
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
    // Rotation pour amener le centre du segment gagné sous le pointeur (haut), + 5 tours.
    const targetMod = (360 - (((target + 0.5) * seg) % 360)) % 360
    setRotation(prev => {
      const delta = (((targetMod - (prev % 360)) % 360) + 360) % 360 + 360 * 5
      return prev + delta
    })
    setTimeout(() => { setResult(res.segment); setSpinning(false) }, 4200)
  }

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
          <svg viewBox="0 0 220 232" className="wheel-svg" role="img" aria-label="Roue de la fortune">
            {/* pointeur fixe en haut */}
            <polygon points="110,2 100,2 110,22 120,2" fill="var(--ink)" />
            <g className="wheel-rotor" style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
              <circle cx={CX} cy={CY} r={R + 3} fill="var(--ink)" opacity="0.08" />
              {segments.map((s, i) => {
                const a0 = i * seg, a1 = (i + 1) * seg
                const [x0, y0] = ptR(a0, R)
                const [x1, y1] = ptR(a1, R)
                const large = seg > 180 ? 1 : 0
                const mid = (i + 0.5) * seg
                const [lx, ly] = ptR(mid, R * 0.62)
                let rot = mid
                if (mid > 90 && mid < 270) rot += 180
                return (
                  <g key={s.idx}>
                    <path d={`M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`}
                      fill={s.color} stroke="#fff" strokeWidth="1.5" />
                    <text x={lx} y={ly} transform={`rotate(${rot} ${lx} ${ly})`}
                      textAnchor="middle" dominantBaseline="middle"
                      className="wheel-label">{s.label}</text>
                  </g>
                )
              })}
              <circle cx={CX} cy={CY} r="13" fill="#fff" stroke="var(--ink)" strokeWidth="2" />
            </g>
          </svg>
        </div>

        {result ? (
          <div className={`wheel-result${result.reward_type === 'nothing' ? ' wheel-result--none' : ''}`}>
            {rewardText(result)}
          </div>
        ) : error ? (
          <div className="wheel-result wheel-result--none">{error}</div>
        ) : (
          <div className="wheel-hint">Tente ta chance : rien, ou des gains de ouf&nbsp;!</div>
        )}

        <button
          className="btn-primary wheel-spin-btn"
          onClick={handleSpin}
          disabled={spinning || n === 0 || (cost != null && jetons < cost)}
        >
          {spinning ? 'La roue tourne…' : cost != null ? `Tourner · 🪙${cost}` : 'Tourner'}
        </button>
      </div>
    </div>
  )
}
