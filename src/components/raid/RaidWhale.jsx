import { useEffect } from 'react'
import { motion, useAnimationControls } from 'framer-motion'

// ─────────────────────────────────────────────────────────────────────────────
// La baleine colossale (boss) qui ÉMERGE au milieu du lac — silhouette stylisée
// rim-lightée par le soleil couchant, avec souffle (jet d'eau), écume et remous.
// Dessinée en code (SVG, hors WebGL). Réagit au combat :
//   • hitSignal   (assaut réussi) → plonge/encaisse + s'illumine ;
//   • attackSignal (contre-attaque) → se cabre ;
//   • PV bas       → halo rouge + respiration plus nerveuse.
// Repère commun aux effets : viewBox 1000×600, "meet" (corps centré ~500/365).
// ─────────────────────────────────────────────────────────────────────────────

const VW = 1000, VH = 600
const BACK = 'M 332 404 C 358 352, 432 322, 512 324 C 602 326, 658 366, 688 404 Z'
const BACK_RIM = 'M 332 404 C 358 352, 432 322, 512 324 C 602 326, 658 366, 688 404'

export default function RaidWhale({ hitSignal = 0, attackSignal = 0, hp = 1, maxHp = 1 }) {
  const controls = useAnimationControls()
  const lowHp = maxHp > 0 && hp / maxHp <= 0.3

  useEffect(() => {
    if (hitSignal <= 0) return
    controls.start({ y: [0, 16, -4, 0], scale: [1, 0.97, 1.01, 1], filter: ['brightness(1)', 'brightness(1.55)', 'brightness(1)'], transition: { duration: 0.5, ease: 'easeOut' } })
  }, [hitSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (attackSignal <= 0) return
    controls.start({ y: [0, -24, 0], rotate: [0, -2.5, 0], scale: [1, 1.04, 1], transition: { duration: 0.55, ease: 'easeOut' } })
  }, [attackSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <svg className="raid-whale" data-low={lowHp ? 'true' : 'false'} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="rw-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b4a6a" />
          <stop offset="1" stopColor="#1b2640" />
        </linearGradient>
        <filter id="rw-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      {/* remous concentriques sur l'eau */}
      <g>
        <ellipse className="raid-whale-ripple" cx="510" cy="406" rx="150" ry="24" fill="none" stroke="#fff3df" strokeWidth="3" />
        <ellipse className="raid-whale-ripple" cx="510" cy="406" rx="150" ry="24" fill="none" stroke="#fff3df" strokeWidth="3" style={{ animationDelay: '2.2s' }} />
      </g>

      {/* écume au pied du corps */}
      <g filter="url(#rw-soft)">
        <ellipse cx="360" cy="404" rx="46" ry="10" fill="#fdf6ec" opacity="0.7" />
        <ellipse cx="512" cy="408" rx="124" ry="13" fill="#fdf6ec" opacity="0.6" />
        <ellipse cx="664" cy="404" rx="42" ry="9" fill="#fdf6ec" opacity="0.7" />
      </g>

      {/* souffle (jet d'eau périodique) */}
      <g className="raid-whale-spout">
        <path d="M 398 330 C 388 298, 392 276, 400 260 C 408 276, 412 298, 402 330 Z" fill="#dff1ff" opacity="0.85" filter="url(#rw-soft)" />
        {[[376, 298, 4], [420, 294, 3], [398, 270, 3.5]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#eaf6ff" opacity="0.85" />
        ))}
      </g>

      {/* corps (bob d'idle en CSS sur le groupe, réactions de combat en Framer Motion) */}
      <g className="raid-whale-idle">
        <motion.g animate={controls} initial={{ y: 0, scale: 1 }} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
          <path d={BACK} fill="url(#rw-body)" />
          {/* liseré chaud (lumière rasante du soleil) */}
          <path d={BACK_RIM} fill="none" stroke="#ffd49a" strokeWidth="3" opacity="0.65" strokeLinecap="round" />
          {/* crête dorsale */}
          <path d="M 556 330 L 572 308 L 588 332 Z" fill="#1b2640" />
          {/* sillon de la bouche */}
          <path d="M 336 392 Q 360 400, 394 396" fill="none" stroke="#141d33" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          {/* œil */}
          <circle cx="386" cy="372" r="6.5" fill="#0e1626" />
          <circle cx="384" cy="370" r="2" fill="#cfe0f2" />
        </motion.g>
      </g>
    </svg>
  )
}
