import { useEffect, useState, useRef, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { fxForRole } from '../../lib/raidRoleFx'
import { ORGANS } from '../../lib/raid'

// ─────────────────────────────────────────────────────────────────────────────
// Couche d'EFFETS de combat du RAID (au-dessus du boss, hors WebGL).
//
// • hitSignal (assaut réussi) → SALVE : chaque rôle projette son effet (trait /
//   projectile / onde / entaille), coloré à sa teinte, en CASCADE vers le boss,
//   terminé par un éclat d'impact. Le client ne sait pas QUI a agi (seul le
//   Capitaine valide) → tous les rôles présents tirent, en vague.
// • attackSignal (contre-attaque du boss) → onde de choc rouge émise par le boss.
//
// Rendu en SVG (viewBox commun 1000×600, preserveAspectRatio "meet" → géométrie
// stable quelle que soit la largeur) avec halos gaussiens : un rendu « énergie /
// lumière », sans aucune forme dessinée à la main.
// ─────────────────────────────────────────────────────────────────────────────

const VW = 1000, VH = 600
const TX = 500, TY = 365            // centre visé de la baleine (au milieu du lac)
const ORIGIN_Y = 470                // postes d'équipage sur le bord de la plage (avant-plan)
const TRAVEL_HIT = 1300             // durée de vie d'une salve (ms) avant nettoyage
const TRAVEL_ATK = 800

const originX = (i, n) => (n <= 1 ? TX : 175 + (650 * i) / (n - 1))

// ── Éclat d'impact sur le boss (varie selon le type d'effet) ─────────────────
function Impact({ hue, kind, delay }) {
  const c = `hsl(${hue} 96% 67%)`
  const ctr = { transformBox: 'fill-box', transformOrigin: 'center' }
  return (
    <g>
      {/* cœur lumineux blanc */}
      <motion.circle cx={TX} cy={TY} r="9" fill="#ffffff"
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 2.4, 0.8], opacity: [0, 1, 0] }}
        transition={{ duration: 0.42, delay, ease: 'easeOut' }} style={ctr} />
      {/* halo coloré */}
      <motion.circle cx={TX} cy={TY} r="16" fill={c}
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 2.1, 0], opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.5, delay, ease: 'easeOut' }} style={ctr} />
      {/* onde (sonar) */}
      {kind === 'pulse' && (
        <motion.circle cx={TX} cy={TY} r="14" fill="none" stroke={c} strokeWidth="5"
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 3.6], opacity: [0.9, 0] }}
          transition={{ duration: 0.55, delay, ease: 'easeOut' }} style={ctr} />
      )}
      {/* éclats radiaux (projectile / trait) */}
      {(kind === 'bolt' || kind === 'beam') && [0, 45, 90, 135].map((a) => (
        <g key={a} transform={`rotate(${a} ${TX} ${TY})`}>
          <motion.rect x={TX - 1.6} y={TY - 30} width="3.2" height="26" rx="1.6" fill={c}
            initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 0.4, delay, ease: 'easeOut' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }} />
        </g>
      ))}
      {/* entaille (slash) */}
      {kind === 'slash' && (
        <motion.path d={`M ${TX - 30} ${TY + 6} A 30 30 0 0 1 ${TX + 30} ${TY - 6}`}
          fill="none" stroke={c} strokeWidth="7" strokeLinecap="round"
          initial={{ rotate: -55, opacity: 0 }} animate={{ rotate: [-55, 45], opacity: [0, 1, 0] }}
          transition={{ duration: 0.34, delay, ease: 'easeOut' }} style={ctr} />
      )}
    </g>
  )
}

// ── Un tir d'un rôle (origine bas → boss) ────────────────────────────────────
function Strike({ ox, hue, kind, delay, glow }) {
  const ang = (Math.atan2(TY - ORIGIN_Y, TX - ox) * 180) / Math.PI
  const travel = kind === 'slash' ? 0.26 : 0.34
  const core = `hsl(${hue} 95% 70%)`
  const soft = `hsl(${hue} 90% 60%)`
  return (
    <g filter={glow}>
      {kind === 'beam' ? (
        <>
          <motion.line x1={ox} y1={ORIGIN_Y} x2={TX} y2={TY} stroke={soft} strokeWidth="7" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [0, 0.85, 0] }}
            transition={{ duration: travel, delay, times: [0, 0.45, 1], ease: 'easeOut' }} />
          <motion.line x1={ox} y1={ORIGIN_Y} x2={TX} y2={TY} stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
            transition={{ duration: travel, delay, times: [0, 0.45, 1], ease: 'easeOut' }} />
        </>
      ) : (
        <motion.g initial={{ x: ox, y: ORIGIN_Y, opacity: 0 }}
          animate={{ x: TX, y: TY, opacity: [0, 1, 1, 1] }}
          transition={{ duration: travel, delay, ease: 'easeIn', times: [0, 0.18, 0.9, 1] }}>
          <g transform={`rotate(${ang})`}>
            <ellipse cx="-15" cy="0" rx="22" ry="3.4" fill={soft} opacity="0.85" />
          </g>
          <circle r="6.5" fill={core} />
          <circle r="3" fill="#ffffff" />
        </motion.g>
      )}
      <Impact hue={hue} kind={kind} delay={delay + travel * 0.92} />
    </g>
  )
}

// ── Poste de tir d'un membre d'équipage (présence permanente, base de la scène) ─
// Disque lumineux à la couleur du rôle + emoji ; c'est de là que part son effet.
// Petit bonhomme sur la plage, à la couleur de son rôle, bras levés vers la
// baleine : c'est de lui que part l'effet d'énergie. Présence permanente.
function CrewEmitter({ x, hue, emoji, delay, cheer = false }) {
  const body = `hsl(${hue} 62% 52%)`
  const bodyDk = `hsl(${hue} 60% 40%)`
  return (
    <g transform={`translate(${x} ${ORIGIN_Y})`}>
      {/* lueur émise par le poste */}
      <circle className="raid-emitter-halo" cx="0" cy="-8" r="26" fill={`hsl(${hue} 88% 62%)`} opacity="0.16" style={{ animationDelay: `${delay}s` }} />
      {/* ombre sur le sable */}
      <ellipse cx="0" cy="22" rx="15" ry="4.5" fill="rgba(60,30,15,.34)" />
      {/* Victoire : les matelots sautent de joie (sinon léger bob d'idle). */}
      <g className={`raid-figure${cheer ? ' raid-figure--cheer' : ''}`} style={{ animationDelay: `${delay}s` }}>
        {/* jambes */}
        <path d="M -4 15 L -5 21 M 4 15 L 5 21" stroke={bodyDk} strokeWidth="4" strokeLinecap="round" />
        {/* corps */}
        <path d="M 0 -3 C 9 -3, 12 6, 11 17 L -11 17 C -12 6, -9 -3, 0 -3 Z" fill={body} stroke={bodyDk} strokeWidth="1.5" />
        {/* bras levés vers la baleine */}
        <path d="M -8 1 Q -16 -5, -13 -13" stroke={body} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path d="M 8 1 Q 16 -5, 13 -13" stroke={body} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        {/* tête */}
        <circle cx="0" cy="-13" r="7" fill="#f3c9a0" stroke="#d8a878" strokeWidth="1" />
        {/* badge de rôle au-dessus de la tête */}
        <g transform="translate(0 -27)">
          <circle r="8.5" fill={`hsl(${hue} 58% 42%)`} stroke="#fff" strokeWidth="1.5" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="10">{emoji}</text>
        </g>
      </g>
    </g>
  )
}

// ── Onde de choc émise par le boss (contre-attaque) ──────────────────────────
function BossWave({ glow }) {
  const ctr = { transformBox: 'fill-box', transformOrigin: 'center' }
  return (
    <g filter={glow}>
      <motion.circle cx={TX} cy={TY} r="20" fill="none" stroke="#ff5a4a" strokeWidth="8"
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 6], opacity: [0.9, 0] }}
        transition={{ duration: 0.6, ease: 'easeOut' }} style={ctr} />
      <motion.circle cx={TX} cy={TY} r="14" fill="#ff3b30"
        initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1.8, 0.4], opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.45, ease: 'easeOut' }} style={ctr} />
    </g>
  )
}

export default function RaidStrikes({ crew = [], hitSignal = 0, attackSignal = 0, teaser = false, outcome = null }) {
  const uid = useId().replace(/:/g, '')
  const glow = `url(#${uid}-g)`
  const reduce = useReducedMotion()
  const [volleys, setVolleys] = useState([])
  const [waves, setWaves] = useState([])
  const seq = useRef(0)
  const timersRef = useRef([])

  const members = crew.filter((c) => c && c.role)

  // NB : on ne clear PAS le timeout en cleanup — sinon un 2e coup rapproché
  // annulerait le nettoyage de la salve précédente (salves fantômes). Chaque
  // salve se retire d'elle-même via son propre id (setState post-unmount = no-op).
  useEffect(() => {
    if (reduce || teaser || hitSignal <= 0 || members.length === 0) return
    const id = ++seq.current
    setVolleys((v) => [...v, { id, members }])
    timersRef.current.push(setTimeout(() => setVolleys((v) => v.filter((x) => x.id !== id)), TRAVEL_HIT))
  }, [hitSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reduce || teaser || attackSignal <= 0) return
    const id = ++seq.current
    setWaves((w) => [...w, { id }])
    timersRef.current.push(setTimeout(() => setWaves((w) => w.filter((x) => x.id !== id)), TRAVEL_ATK))
  }, [attackSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nettoyage au DÉMONTAGE seulement (pas par signal, pour ne pas couper une salve en
  // cours) → évite les setState après démontage lors de la bascule vers /raid/resultat.
  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  // En teaser, pas d'équipage. Sinon on rend toujours les postes d'équipage
  // (présence permanente) ; seules les salves/ondes sont coupées en reduced-motion.
  if (teaser) return null

  return (
    <svg className="raid-fx-svg" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <filter id={`${uid}-g`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Postes d'équipage (un par rôle), présence permanente au bas de la scène. */}
      {members.map((m, i) => (
        <CrewEmitter key={`em-${m.id ?? i}`} x={originX(i, members.length)}
          hue={fxForRole(m.role).hue} emoji={ORGANS[m.role]?.emoji || '•'} delay={i * 0.5} cheer={outcome === 'won'} />
      ))}
      {volleys.map((vol) => (
        <g key={vol.id}>
          {vol.members.map((m, i) => {
            const fx = fxForRole(m.role)
            return (
              <Strike key={m.id ?? i} ox={originX(i, vol.members.length)}
                hue={fx.hue} kind={fx.kind} delay={i * 0.08} glow={glow} />
            )
          })}
        </g>
      ))}
      {waves.map((w) => <BossWave key={w.id} glow={glow} />)}
    </svg>
  )
}
