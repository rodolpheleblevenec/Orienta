import { useEffect } from 'react'
import { motion, useAnimationControls } from 'framer-motion'

// ─────────────────────────────────────────────────────────────────────────────
// La baleine colossale (boss) qui ÉMERGE au milieu du lac — silhouette stylisée
// rim-lightée par le soleil couchant, avec souffle (jet d'eau), écume et remous.
// Dessinée en code (SVG, hors WebGL). Réagit au combat :
//   • hitSignal   (assaut réussi) → plonge/encaisse + s'illumine ;
//   • attackSignal (contre-attaque) → se cabre ;
//   • dernier assaut / PV bas → ENRAGÉE : halo rouge + respiration nerveuse ;
//   • outcome 'won'  → AGONIE : se cabre puis coule et disparaît dans le lac ;
//   • outcome 'lost' → replonge dans les profondeurs.
// Repère commun aux effets : viewBox 1000×600, "meet" (corps centré ~500/365).
// ─────────────────────────────────────────────────────────────────────────────

const VW = 1000, VH = 600
const BACK = 'M 332 404 C 358 352, 432 322, 512 324 C 602 326, 658 366, 688 404 Z'
const BACK_RIM = 'M 332 404 C 358 352, 432 322, 512 324 C 602 326, 658 366, 688 404'

export default function RaidWhale({ hitSignal = 0, attackSignal = 0, hp = 1, maxHp = 1, assaultIndex = null, assaultCount = 0, outcome = null }) {
  const controls = useAnimationControls()
  // Enragée pendant tout le DERNIER assaut (à 100 PV sur 300, on est à 33 % → un seuil
  // de pourcentage seul ne se déclenche jamais). On se base donc sur l'index d'assaut.
  const finalAssault = assaultCount > 0 && assaultIndex != null && assaultIndex >= assaultCount - 1
  const lowHp = !outcome && (finalAssault || (maxHp > 0 && hp / maxHp <= 0.34))

  useEffect(() => {
    if (hitSignal <= 0) return
    controls.start({ y: [0, 16, -4, 0], scale: [1, 0.97, 1.01, 1], filter: ['brightness(1)', 'brightness(1.55)', 'brightness(1)'], transition: { duration: 0.5, ease: 'easeOut' } })
  }, [hitSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (attackSignal <= 0) return
    controls.start({ y: [0, -24, 0], rotate: [0, -2.5, 0], scale: [1, 1.04, 1], transition: { duration: 0.55, ease: 'easeOut' } })
  }, [attackSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fin de combat : la baleine coule et disparaît (victoire = agonie spectaculaire,
  // défaite = replongée dans les abysses). Le bob d'idle est coupé (classe --end).
  useEffect(() => {
    if (!outcome) return
    if (outcome === 'won') {
      controls.start({
        y: [0, -34, 16, 300], rotate: [0, -5, 6, 18], scale: [1, 1.06, 1, 0.78],
        opacity: [1, 1, 1, 0],
        filter: ['brightness(1)', 'brightness(1.5)', 'brightness(.85)', 'brightness(.45)'],
        transition: { duration: 2.4, times: [0, 0.16, 0.42, 1], ease: 'easeIn' },
      })
    } else {
      controls.start({
        y: [0, -20, 170], rotate: [0, -2, 5], scale: [1, 1.04, 0.9], opacity: [1, 1, 0.18],
        transition: { duration: 2.0, times: [0, 0.28, 1], ease: 'easeIn' },
      })
    }
  }, [outcome]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <svg className="raid-whale" data-low={lowHp ? 'true' : 'false'} data-outcome={outcome || 'none'} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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

      {/* Éclaboussure de submersion : grand remous au moment où la baleine coule. */}
      {outcome && (
        <g>
          <motion.ellipse cx="510" cy="408" rx="64" ry="15" fill="#fdf6ec"
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 3.4], opacity: [0, 0.85, 0] }}
            transition={{ duration: 1.7, delay: 1.0, ease: 'easeOut' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
          <motion.ellipse cx="510" cy="408" rx="64" ry="15" fill="none" stroke="#ffffff" strokeWidth="4"
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.5, 4.4], opacity: [0.9, 0] }}
            transition={{ duration: 1.9, delay: 1.2, ease: 'easeOut' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        </g>
      )}

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
      <g className={`raid-whale-idle${outcome ? ' raid-whale-idle--end' : ''}${lowHp ? ' raid-whale-idle--rage' : ''}`}>
        <motion.g animate={controls} initial={{ y: 0, scale: 1 }} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
          <path d={BACK} fill="url(#rw-body)" />
          {/* liseré chaud (lumière rasante du soleil) */}
          <path d={BACK_RIM} fill="none" stroke="#ffd49a" strokeWidth="3" opacity="0.65" strokeLinecap="round" />
          {/* crête dorsale */}
          <path d="M 556 330 L 572 308 L 588 332 Z" fill="#1b2640" />
          {/* sillon de la bouche */}
          <path d="M 336 392 Q 360 400, 394 396" fill="none" stroke="#141d33" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          {/* ENRAGÉE (dernier assaut) : embrasement rouge pulsant + œil furieux + naseaux fumants */}
          {lowHp && (
            <g>
              <path className="raid-whale-rage" d={BACK} fill="#ff2d18" />
              <path className="raid-whale-rage" d={BACK_RIM} fill="none" stroke="#ff7a4a" strokeWidth="4" strokeLinecap="round" />
              <circle className="raid-whale-rage-eye" cx="386" cy="372" r="8.5" fill="#ff2d18" />
              <circle cx="383" cy="369" r="2.2" fill="#ffe7df" />
              {/* sourcil furieux */}
              <path d="M 372 360 L 398 366" stroke="#ff2d18" strokeWidth="4" strokeLinecap="round" />
            </g>
          )}
          {/* œil */}
          {!lowHp && <><circle cx="386" cy="372" r="6.5" fill="#0e1626" /><circle cx="384" cy="370" r="2" fill="#cfe0f2" /></>}
        </motion.g>
      </g>
    </svg>
  )
}
