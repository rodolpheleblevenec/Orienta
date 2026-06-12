import { useId, useEffect } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { ORGANS } from '../../lib/raid'
import { getRaidArt } from '../../lib/raidArt'

// ─────────────────────────────────────────────────────────────────────────────
// Scène RAID 100 % 2D (SVG vectoriel à calques), remplace l'ancien rendu 3D.
// Même interface que RaidMonster3D (crew/hp/maxHp/hitSignal/attackSignal/teaser)
// + une prop `boss` (clé du roster) pour dessiner la bonne créature.
//
// Profondeur obtenue sans 3D : calques étagés (fond flouté → boss → équipage →
// avant-plan), perspective atmosphérique (désaturation au loin), rayons de
// lumière, caustiques dérivantes, ombres portées, particules.
// Animation : idle permanent en keyframes CSS (voir index.css, section « RAID 2D »)
// + réactions de combat pilotées par Framer Motion (recul du boss, sursaut de
// l'équipage) déclenchées par les signaux hitSignal / attackSignal.
// ─────────────────────────────────────────────────────────────────────────────

const VIEW_W = 1000
const VIEW_H = 600

// Construit une ligne ondulante (tentacule, algue) descendant de (x, y0).
function wavy(x, y0, length, amp, segs, phase) {
  let d = `M ${x.toFixed(1)} ${y0.toFixed(1)}`
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const yy = y0 + length * t
    const xx = x + Math.sin(phase + t * Math.PI * 2.6) * amp * t
    d += ` L ${xx.toFixed(1)} ${yy.toFixed(1)}`
  }
  return d
}

// ── Décor de fond : rayons de lumière + caustiques ──────────────────────────
function LightRays({ uid, teaser }) {
  const rays = [120, 300, 470, 640, 820]
  return (
    <g className="r2d-rays">
      {rays.map((x, i) => (
        <polygon
          key={i}
          points={`${x},-40 ${x + 46},-40 ${x + 150 + i * 14},620 ${x + 40 + i * 14},620`}
          fill={`url(#${uid}-ray)`}
          opacity={teaser ? 0.1 : 0.22}
        />
      ))}
    </g>
  )
}

// Taches lumineuses douces qui dérivent au sol (effet « caustiques » sous-marines).
function Caustics({ teaser }) {
  if (teaser) return null
  const blobs = [
    [260, 470, 150], [560, 510, 200], [770, 460, 140], [430, 540, 170],
  ]
  return (
    <g className="r2d-caustics">
      {blobs.map(([cx, cy, r], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.32}
          fill="#bdf6ff" opacity={0.06} className="r2d-caustic"
          style={{ animationDelay: `${i * 1.7}s` }} />
      ))}
    </g>
  )
}

// ── Récifs & algues ─────────────────────────────────────────────────────────
function Coral({ x, y, scale = 1, color, deep }) {
  const branches = [-0.5, -0.18, 0.16, 0.5]
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={deep ? 0.55 : 1}>
      <ellipse cx="0" cy="6" rx="42" ry="12" fill="rgba(0,0,0,.18)" />
      {branches.map((a, i) => (
        <path key={i}
          d={`M ${a * 34} 6 C ${a * 50} -30, ${a * 80} -54, ${a * 64} -96`}
          stroke={color} strokeWidth={11 - Math.abs(a) * 6} fill="none"
          strokeLinecap="round" opacity={0.92} />
      ))}
      <circle cx="0" cy="-6" r="20" fill={color} />
      <circle cx="-18" cy="2" r="12" fill={color} opacity={0.85} />
      <circle cx="20" cy="-2" r="13" fill={color} opacity={0.9} />
    </g>
  )
}

function Seaweed({ x, y, h = 110, color, phase = 0 }) {
  const blades = [-14, 0, 13]
  return (
    <g transform={`translate(${x} ${y})`}>
      {blades.map((bx, i) => (
        <path key={i} className="r2d-blade"
          style={{ animationDelay: `${phase + i * 0.4}s`, animationDuration: `${4 + i * 0.6}s` }}
          d={`M ${bx} 0 C ${bx - 16} ${-h * 0.4}, ${bx + 18} ${-h * 0.7}, ${bx} ${-h}`}
          stroke={color} strokeWidth={9 - i} fill="none" strokeLinecap="round" />
      ))}
    </g>
  )
}

function Fish({ y, color, dur, delay, scale = 1, dir = 1 }) {
  return (
    <g className="r2d-fish" style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s`, animationDirection: dir < 0 ? 'reverse' : 'normal' }}>
      <g transform={`translate(0 ${y}) scale(${scale * dir} ${scale})`}>
        <ellipse cx="0" cy="0" rx="16" ry="9" fill={color} />
        <polygon points="-14,0 -28,-9 -28,9" fill={color} />
        <circle cx="9" cy="-2" r="2.4" fill="#06222f" />
      </g>
    </g>
  )
}

function Bubbles({ uid }) {
  const data = [
    [180, 7, 7, 0], [240, 4, 9, 2], [300, 9, 6.5, 1], [520, 5, 8, 3.5],
    [600, 8, 7.5, 0.6], [690, 4, 10, 2.4], [760, 6, 6.8, 4], [840, 5, 9.2, 1.4],
  ]
  return (
    <g>
      {data.map(([x, r, dur, delay], i) => (
        <circle key={i} cx={x} cy={620} r={r} fill={`url(#${uid}-bubble)`}
          className="r2d-bubble"
          style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />
      ))}
    </g>
  )
}

// ═══ BOSS ════════════════════════════════════════════════════════════════════
// Chaque créature est centrée autour de (500, ~250). Idle (respiration / ondulation)
// porté par les classes CSS ; la réaction de combat est appliquée par le wrapper
// Framer Motion dans <Scene/>.

function BossMeduse({ uid, teaser }) {
  const cx = 500, rimY = 280, rx = 160, topY = 110
  const bellPath = `M ${cx - rx} ${rimY}
    C ${cx - rx} ${topY}, ${cx + rx} ${topY}, ${cx + rx} ${rimY}
    q ${-rx * 0.33} 34, ${-rx * 0.66} 0
    q ${-rx * 0.34} -30, ${-rx * 0.67} 0
    q ${-rx * 0.33} 34, ${-rx * 0.67} 0 Z`
  const tentacles = Array.from({ length: 9 }, (_, i) => ({
    x: cx - 130 + (260 / 8) * i, len: 200 + (i % 3) * 50, amp: 18 + (i % 4) * 6, ph: i * 0.7,
  }))
  const arms = [-70, -34, 0, 34, 70]
  return (
    <g filter={`url(#${uid}-glow)`}>
      {/* tentacules fines, derrière la cloche */}
      <g className="r2d-boss-breathe">
        {tentacles.map((t, i) => (
          <path key={i} className="r2d-tentacle"
            style={{ animationDelay: `${t.ph}s`, animationDuration: `${4.5 + (i % 3)}s` }}
            d={wavy(t.x, rimY - 6, t.len, t.amp, 10, t.ph)}
            stroke={`url(#${uid}-tent)`} strokeWidth={5} fill="none" strokeLinecap="round"
            opacity={teaser ? 0.5 : 0.8} />
        ))}
        {/* bras oraux (rubans frangés au centre) */}
        {arms.map((ax, i) => (
          <path key={i} className="r2d-tentacle"
            style={{ animationDelay: `${i * 0.5}s`, animationDuration: `${3.6 + i * 0.3}s` }}
            d={wavy(cx + ax, rimY - 10, 130 + (i % 2) * 34, 12, 8, i)}
            stroke="#f6a8ec" strokeWidth={13 - Math.abs(i - 2) * 2} fill="none"
            strokeLinecap="round" opacity={teaser ? 0.45 : 0.72} />
        ))}
        {/* cloche */}
        <path d={bellPath} fill={`url(#${uid}-bell)`} stroke="#ffd1f4" strokeWidth="2" opacity={teaser ? 0.85 : 0.94} />
        {/* dôme interne lumineux */}
        <path d={`M ${cx - rx * 0.62} ${rimY - 18} C ${cx - rx * 0.62} ${topY + 50}, ${cx + rx * 0.62} ${topY + 50}, ${cx + rx * 0.62} ${rimY - 18} Z`}
          fill={`url(#${uid}-belltop)`} opacity={0.7} />
        {/* points bioluminescents */}
        {[-110, -64, -18, 30, 78, 124].map((dx, i) => (
          <circle key={i} cx={cx + dx} cy={rimY - 26 - (i % 2) * 18} r={5} fill="#fff0fb"
            className="r2d-glowdot" style={{ animationDelay: `${i * 0.4}s` }} />
        ))}
        {/* reflet */}
        <ellipse cx={cx - 54} cy={topY + 70} rx="30" ry="56" fill="#ffffff" opacity={teaser ? 0.1 : 0.22} transform={`rotate(-18 ${cx - 54} ${topY + 70})`} />
      </g>
    </g>
  )
}

function BossCrabe({ uid, teaser }) {
  const cx = 500, cy = 250
  const leg = (sx, sy, ex, ey, mx, my) =>
    `M ${sx} ${sy} Q ${mx} ${my}, ${ex} ${ey}`
  return (
    <g filter={`url(#${uid}-glow)`}>
      <g className="r2d-boss-breathe">
        {/* pattes (3 paires) */}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <path d={leg(cx - 90, cy + 30 + i * 18, cx - 230 - i * 26, cy + 70 + i * 40, cx - 180, cy - 10 + i * 30)}
              stroke="#b5371f" strokeWidth={13 - i * 2} fill="none" strokeLinecap="round" />
            <path d={leg(cx + 90, cy + 30 + i * 18, cx + 230 + i * 26, cy + 70 + i * 40, cx + 180, cy - 10 + i * 30)}
              stroke="#b5371f" strokeWidth={13 - i * 2} fill="none" strokeLinecap="round" />
          </g>
        ))}
        {/* bras + pinces (animées) */}
        {[-1, 1].map((s) => (
          <g key={s} className="r2d-claw" style={{ animationDelay: s < 0 ? '0s' : '0.8s' }}>
            <path d={`M ${cx + s * 110} ${cy - 6} Q ${cx + s * 170} ${cy - 40}, ${cx + s * 168} ${cy - 96}`}
              stroke="#c63b22" strokeWidth="20" fill="none" strokeLinecap="round" />
            <g transform={`translate(${cx + s * 168} ${cy - 110})`}>
              <path d={`M 0 0 Q ${s * 44} -20, ${s * 60} 8 Q ${s * 40} 4, ${s * 30} 16 Q ${s * 14} 28, 0 18 Z`} fill="#e2492b" />
              <path d={`M 0 -4 Q ${s * 40} -36, ${s * 64} -14 Q ${s * 44} -10, ${s * 34} -2 Q ${s * 16} 6, 0 0 Z`} fill="#ff6a45" />
            </g>
          </g>
        ))}
        {/* carapace */}
        <path d={`M ${cx - 150} ${cy} Q ${cx - 150} ${cy - 130}, ${cx} ${cy - 132} Q ${cx + 150} ${cy - 130}, ${cx + 150} ${cy} Q ${cx} ${cy + 56}, ${cx - 150} ${cy} Z`}
          fill={`url(#${uid}-shell)`} stroke="#8e2a16" strokeWidth="3" />
        {/* texture / bosses */}
        {[-92, -40, 40, 92].map((dx, i) => (
          <circle key={i} cx={cx + dx} cy={cy - 64 + (i % 2) * 26} r={10} fill="#ff7a52" opacity="0.55" />
        ))}
        <path d={`M ${cx - 70} ${cy - 96} Q ${cx} ${cy - 70}, ${cx + 70} ${cy - 96}`} stroke="#8e2a16" strokeWidth="3" fill="none" opacity="0.5" />
        {/* yeux sur pédoncules */}
        {[-46, 46].map((dx, i) => (
          <g key={i} className="r2d-eyestalk" style={{ animationDelay: `${i * 0.6}s` }}>
            <rect x={cx + dx - 5} y={cy - 150} width="10" height="40" rx="5" fill="#c63b22" />
            <circle cx={cx + dx} cy={cy - 156} r="13" fill="#fff" />
            <circle cx={cx + dx} cy={cy - 156} r="6.5" fill="#10202b" />
          </g>
        ))}
        {/* écume / bave */}
        {!teaser && [-20, 0, 20].map((dx, i) => (
          <circle key={i} cx={cx + dx} cy={cy + 30 + i * 4} r={4} fill="#eafbff" opacity="0.7" />
        ))}
      </g>
    </g>
  )
}

function BossPieuvre({ uid, teaser }) {
  const cx = 500, headY = 210
  const arms = Array.from({ length: 8 }, (_, i) => ({
    x: cx - 130 + (260 / 7) * i, len: 180 + (i % 3) * 46, amp: 30 + (i % 4) * 8, ph: i * 0.6,
  }))
  return (
    <g filter={`url(#${uid}-glow)`}>
      <g className="r2d-boss-breathe">
        {arms.map((a, i) => (
          <path key={i} className="r2d-arm"
            style={{ animationDelay: `${a.ph}s`, animationDuration: `${5 + (i % 3)}s` }}
            d={wavy(a.x, headY + 60, a.len, a.amp, 9, a.ph)}
            stroke={`url(#${uid}-octo)`} strokeWidth={i % 2 ? 17 : 22} fill="none" strokeLinecap="round"
            opacity={teaser ? 0.6 : 0.92} />
        ))}
        {/* mantle / tête */}
        <path d={`M ${cx - 120} ${headY + 70} Q ${cx - 140} ${headY - 130}, ${cx} ${headY - 134} Q ${cx + 140} ${headY - 130}, ${cx + 120} ${headY + 70} Q ${cx} ${headY + 96}, ${cx - 120} ${headY + 70} Z`}
          fill={`url(#${uid}-octoHead)`} stroke="#5b2a7a" strokeWidth="3" />
        <ellipse cx={cx - 36} cy={headY - 70} rx="22" ry="34" fill="#ffffff" opacity={teaser ? 0.1 : 0.2} />
        {/* yeux */}
        {[-52, 52].map((dx, i) => (
          <g key={i}>
            <ellipse cx={cx + dx} cy={headY + 6} rx="30" ry="24" fill="#fbeaff" />
            <ellipse cx={cx + dx} cy={headY + 8} rx="13" ry="17" fill="#1a1024" />
            <circle cx={cx + dx - 4} cy={headY + 1} r="4" fill="#fff" />
            <path d={`M ${cx + dx - 30} ${headY - 10} Q ${cx + dx} ${headY - 24}, ${cx + dx + 30} ${headY - 10}`}
              stroke="#5b2a7a" strokeWidth="4" fill="none" strokeLinecap="round" />
          </g>
        ))}
        {[-100, -60, 60, 100].map((dx, i) => (
          <circle key={i} cx={cx + dx} cy={headY - 60 + (i % 2) * 20} r={6} fill="#e7a6ff" opacity="0.7" className="r2d-glowdot" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
      </g>
    </g>
  )
}

function BossRequin({ uid, teaser }) {
  const cx = 500, cy = 240
  return (
    <g filter={`url(#${uid}-glow)`}>
      <g className="r2d-boss-breathe">
        {/* queue (animée) */}
        <g className="r2d-tail">
          <path d={`M ${cx - 150} ${cy} Q ${cx - 250} ${cy - 10}, ${cx - 320} ${cy - 70} L ${cx - 290} ${cy} L ${cx - 320} ${cy + 64} Q ${cx - 250} ${cy + 12}, ${cx - 150} ${cy} Z`}
            fill={`url(#${uid}-shark)`} />
        </g>
        {/* corps */}
        <path d={`M ${cx - 160} ${cy} Q ${cx - 60} ${cy - 70}, ${cx + 120} ${cy - 46} Q ${cx + 220} ${cy - 30}, ${cx + 250} ${cy} Q ${cx + 220} ${cy + 30}, ${cx + 120} ${cy + 46} Q ${cx - 60} ${cy + 70}, ${cx - 160} ${cy} Z`}
          fill={`url(#${uid}-shark)`} stroke="#33586e" strokeWidth="2" />
        {/* ventre clair */}
        <path d={`M ${cx - 120} ${cy + 30} Q ${cx + 40} ${cy + 64}, ${cx + 180} ${cy + 34} Q ${cx + 40} ${cy + 50}, ${cx - 120} ${cy + 30} Z`} fill="#dff1f6" opacity="0.6" />
        {/* aileron dorsal */}
        <path d={`M ${cx} ${cy - 58} L ${cx + 30} ${cy - 128} L ${cx + 64} ${cy - 50} Z`} fill={`url(#${uid}-shark)`} />
        {/* nageoire pectorale */}
        <path d={`M ${cx + 70} ${cy + 30} L ${cx + 110} ${cy + 108} L ${cx + 140} ${cy + 36} Z`} fill="#3f6a82" />
        {/* tête-marteau */}
        <g transform={`translate(${cx + 220} ${cy})`}>
          <rect x="-6" y="-66" width="56" height="132" rx="26" fill={`url(#${uid}-shark)`} stroke="#33586e" strokeWidth="2" />
          <circle cx="22" cy="-58" r="11" fill={teaser ? '#7fe6d0' : '#ffd166'} />
          <circle cx="22" cy="58" r="11" fill={teaser ? '#7fe6d0' : '#ffd166'} />
          <circle cx="22" cy="-58" r="5" fill="#10202b" />
          <circle cx="22" cy="58" r="5" fill="#10202b" />
          <path d="M 4 0 Q 30 16, 50 6" stroke="#23475c" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
        {/* branchies */}
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${cx + 120 + i * 16} ${cy - 26} Q ${cx + 116 + i * 16} ${cy}, ${cx + 120 + i * 16} ${cy + 26}`}
            stroke="#23475c" strokeWidth="3" fill="none" opacity="0.6" />
        ))}
      </g>
    </g>
  )
}

function BossLeviathan({ uid, teaser }) {
  const cx = 500, cy = 240
  // corps serpentin (segments qui ondulent)
  return (
    <g filter={`url(#${uid}-glow)`}>
      <g className="r2d-boss-breathe">
        <path className="r2d-serpent"
          d={`M ${cx - 320} ${cy + 60} Q ${cx - 200} ${cy - 70}, ${cx - 80} ${cy + 30} Q ${cx + 30} ${cy + 120}, ${cx + 140} ${cy + 10} Q ${cx + 220} ${cy - 60}, ${cx + 300} ${cy - 30}`}
          stroke={`url(#${uid}-levia)`} strokeWidth="46" fill="none" strokeLinecap="round" />
        <path d={`M ${cx - 320} ${cy + 60} Q ${cx - 200} ${cy - 70}, ${cx - 80} ${cy + 30} Q ${cx + 30} ${cy + 120}, ${cx + 140} ${cy + 10} Q ${cx + 220} ${cy - 60}, ${cx + 300} ${cy - 30}`}
          stroke="#9af7e0" strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.5" className="r2d-serpent" />
        {/* crête dorsale */}
        {[-120, -40, 40, 120, 200].map((dx, i) => (
          <polygon key={i} points={`${cx + dx},${cy - 28 - (i % 2) * 10} ${cx + dx + 22},${cy - 70} ${cx + dx + 44},${cy - 28}`}
            fill="#1f8f76" opacity="0.85" />
        ))}
        {/* tête */}
        <g transform={`translate(${cx + 300} ${cy - 30})`}>
          <path d="M -40 0 Q -10 -42, 56 -22 Q 86 -8, 70 14 Q 30 40, -20 30 Q -44 22, -40 0 Z" fill={`url(#${uid}-levia)`} stroke="#0f5c4c" strokeWidth="2" />
          {/* cornes */}
          <path d="M -18 -22 Q -40 -64, -8 -70" stroke="#bfead9" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M 12 -28 Q 0 -72, 30 -74" stroke="#bfead9" strokeWidth="7" fill="none" strokeLinecap="round" />
          {/* œil */}
          <circle cx="30" cy="-4" r="12" fill={teaser ? '#9af7e0' : '#ffe08a'} className="r2d-glowdot" />
          <ellipse cx="30" cy="-4" rx="4" ry="9" fill="#0c2a24" />
          {/* mâchoire */}
          <path d="M 18 18 Q 50 30, 70 14" stroke="#0f5c4c" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </g>
  )
}

const BOSS_RENDERERS = {
  meduse: BossMeduse,
  crabe: BossCrabe,
  pieuvre: BossPieuvre,
  requin: BossRequin,
  leviathan: BossLeviathan,
}

// ── Boss illustré (PNG fourni via le manifeste raidArt) ──────────────────────
// Sprite unique : respiration sur la créature entière ; en teaser → silhouette.
function BossSprite({ art, teaser }) {
  const W = art.width ?? 560, H = art.height ?? W
  const X = art.x ?? (500 - W / 2), Y = art.y ?? (250 - H / 2)
  return (
    <image className="r2d-boss-breathe" href={art.full} x={X} y={Y} width={W} height={H}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: teaser ? 'brightness(.14) saturate(.5)' : 'drop-shadow(0 14px 22px rgba(0,0,0,.4))' }} />
  )
}

// Créature découpée en pièces articulées (pinces qui claquent, pattes, etc.).
function BossRig({ parts, teaser }) {
  return (
    <g>
      {parts.map((p, i) => (
        <image key={i} href={p.src} x={p.x} y={p.y} width={p.w}
          preserveAspectRatio="xMidYMid meet"
          className={p.anim ? `r2d-rig r2d-rig--${p.anim}` : undefined}
          style={{
            transformOrigin: `${p.pivotX ?? 50}% ${p.pivotY ?? 50}%`,
            animationDelay: p.delay != null ? `${p.delay}s` : undefined,
            filter: teaser ? 'brightness(.14) saturate(.5)' : 'drop-shadow(0 10px 16px rgba(0,0,0,.35))',
          }} />
      ))}
    </g>
  )
}

// ═══ ÉQUIPAGE ════════════════════════════════════════════════════════════════
function Weapon({ type }) {
  if (type === 'trident') {
    return (
      <g>
        <rect x="-3" y="-58" width="6" height="84" rx="3" fill="#6b4a25" />
        <rect x="-16" y="-62" width="32" height="6" rx="3" fill="#d3dae2" />
        {[-12, 0, 12].map((x) => (
          <polygon key={x} points={`${x - 3},-62 ${x + 3},-62 ${x},-80`} fill="#d3dae2" />
        ))}
      </g>
    )
  }
  if (type === 'sword') {
    return (
      <g>
        <rect x="-3" y="-6" width="6" height="22" rx="3" fill="#6b4a25" />
        <rect x="-13" y="-10" width="26" height="6" rx="3" fill="#c8a84a" />
        <polygon points="-5,-10 5,-10 4,-72 0,-80 -4,-72" fill="#e7edf2" stroke="#aab6c0" strokeWidth="1" />
      </g>
    )
  }
  // mace
  return (
    <g>
      <rect x="-3" y="-46" width="6" height="70" rx="3" fill="#6b4a25" />
      <circle cx="0" cy="-56" r="14" fill="#9aa3ad" />
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180
        return <polygon key={a} points={`${Math.cos(r) * 13},${-56 + Math.sin(r) * 13} ${Math.cos(r) * 24},${-56 + Math.sin(r) * 24} ${Math.cos(r + 0.25) * 13},${-56 + Math.sin(r + 0.25) * 13}`} fill="#c2c9d1" />
      })}
    </g>
  )
}

const WEAPONS = ['trident', 'sword', 'mace']

function Matelot({ x, hue, role, weapon, idx, controls }) {
  const body = `hsl(${hue} 58% 54%)`
  const bodyDk = `hsl(${hue} 58% 42%)`
  const badge = `hsl(${hue} 60% 46%)`
  const emoji = ORGANS[role]?.emoji || '•'
  return (
    <motion.g
      animate={controls}
      initial={{ y: 0, rotate: 0 }}
      style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
    >
      <g transform={`translate(${x} 506)`}>
      <g className="r2d-matelot" style={{ animationDelay: `${idx * 0.5}s` }}>
        {/* ombre */}
        <ellipse cx="0" cy="58" rx="34" ry="9" fill="rgba(0,0,0,.28)" />
        {/* arme (tenue côté droit) */}
        <g transform="translate(26 16) rotate(14)"><Weapon type={weapon} /></g>
        {/* corps */}
        <path d="M -22 56 Q -26 6, -16 -6 Q 0 -16, 16 -6 Q 26 6, 22 56 Z" fill={body} stroke={bodyDk} strokeWidth="2" />
        {/* bras */}
        <path d="M 14 4 Q 30 10, 30 26" stroke={body} strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M -14 4 Q -28 12, -26 28" stroke={body} strokeWidth="9" fill="none" strokeLinecap="round" />
        {/* tête */}
        <circle cx="0" cy="-22" r="16" fill="#f3c9a0" stroke="#d8a878" strokeWidth="1.5" />
        {/* bonnet de marin */}
        <path d="M -16 -26 Q 0 -44, 16 -26 Z" fill="#f6f6f6" />
        <rect x="-16" y="-28" width="32" height="6" rx="3" fill="#e9ecef" />
        <circle cx="0" cy="-44" r="4" fill="#e23b3b" />
        {/* yeux */}
        <circle cx="-5" cy="-22" r="1.8" fill="#3a2a1c" />
        <circle cx="5" cy="-22" r="1.8" fill="#3a2a1c" />
        {/* badge de rôle */}
        <g transform="translate(0 -60)">
          <circle r="15" fill={badge} stroke="#fff" strokeWidth="2.5" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="16">{emoji}</text>
        </g>
      </g>
      </g>
    </motion.g>
  )
}

// ═══ DÉFINITIONS (dégradés / filtres) ════════════════════════════════════════
function Defs({ uid, teaser, lowHp }) {
  const water = teaser
    ? ['#0b3346', '#06222f', '#020d15']
    : ['#5fc6e2', '#1f86a6', lowHp ? '#3a2230' : '#073445']
  return (
    <defs>
      <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={water[0]} />
        <stop offset="0.55" stopColor={water[1]} />
        <stop offset="1" stopColor={water[2]} />
      </linearGradient>
      <linearGradient id={`${uid}-ray`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eafdff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#eafdff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${uid}-bubble`}>
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
        <stop offset="0.7" stopColor="#eafdff" stopOpacity="0.45" />
        <stop offset="1" stopColor="#bdf6ff" stopOpacity="0.15" />
      </radialGradient>
      {/* boss : méduse */}
      <radialGradient id={`${uid}-bell`} cx="0.5" cy="0.32" r="0.75">
        <stop offset="0" stopColor="#ffd9f5" stopOpacity="0.95" />
        <stop offset="0.5" stopColor="#e26bd6" stopOpacity="0.8" />
        <stop offset="1" stopColor="#8e1f8a" stopOpacity="0.62" />
      </radialGradient>
      <radialGradient id={`${uid}-belltop`} cx="0.5" cy="0.2" r="0.7">
        <stop offset="0" stopColor="#fff4fc" stopOpacity="0.85" />
        <stop offset="1" stopColor="#e26bd6" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${uid}-tent`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f6a8ec" />
        <stop offset="1" stopColor="#c23ca8" stopOpacity="0" />
      </linearGradient>
      {/* boss : crabe */}
      <radialGradient id={`${uid}-shell`} cx="0.5" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#ff8a5e" />
        <stop offset="0.6" stopColor="#e2492b" />
        <stop offset="1" stopColor="#a82c16" />
      </radialGradient>
      {/* boss : pieuvre */}
      <radialGradient id={`${uid}-octoHead`} cx="0.5" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#d98bff" />
        <stop offset="0.6" stopColor="#9a3fd6" />
        <stop offset="1" stopColor="#5b2a7a" />
      </radialGradient>
      <linearGradient id={`${uid}-octo`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a44fde" />
        <stop offset="1" stopColor="#5b2a7a" />
      </linearGradient>
      {/* boss : requin */}
      <linearGradient id={`${uid}-shark`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6f97ac" />
        <stop offset="0.6" stopColor="#456f86" />
        <stop offset="1" stopColor="#2c4a5c" />
      </linearGradient>
      {/* boss : léviathan */}
      <linearGradient id={`${uid}-levia`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#2bbf9c" />
        <stop offset="1" stopColor="#0f5c4c" />
      </linearGradient>
      {/* halo lumineux du boss */}
      <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation={teaser ? 7 : 4} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

// ═══ SCÈNE ═══════════════════════════════════════════════════════════════════
const CORALS = [
  [120, 560, 1.1, '#ff7eb6'], [880, 560, 1.2, '#ff9e5e'], [330, 580, 0.8, '#b07bff'], [700, 582, 0.85, '#ffd166'],
]
const FISH_CFG = [
  [150, 8, 2, 1, 1], [320, 11, 5, 0.8, 1], [430, 9, 1.4, 0.7, -1], [240, 13, 3.2, 0.9, 1],
]

function Scene({ uid, boss, crew, teaser, lowHp, bossControls, crewControls, hurtControls }) {
  const BossArt = BOSS_RENDERERS[boss] || BossMeduse
  const art = getRaidArt(boss)
  const n = Math.max(1, crew.length)
  const xs = crew.map((_, i) => (n === 1 ? 500 : 250 + (500 * i) / (n - 1)))
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice" className="r2d-svg" role="img" aria-label="Scène de combat RAID">
      <Defs uid={uid} teaser={teaser} lowHp={lowHp} />
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={`url(#${uid}-water)`} />
      <LightRays uid={uid} teaser={teaser} />
      <Caustics teaser={teaser} />

      {/* décor lointain (flou de profondeur, désaturé) */}
      <g className="r2d-far">
        <Coral x={460} y={566} scale={0.7} color="#6f97ac" deep />
        <Seaweed x={560} y={580} h={150} color="#2f7d5b" phase={1.2} />
        <Seaweed x={210} y={576} h={120} color="#27704f" phase={2.4} />
      </g>

      {/* poissons (couche intermédiaire) — masqués en teaser */}
      {!teaser && FISH_CFG.map(([y, , dur, sc, dir], i) => (
        <Fish key={i} y={y} color={['#ffb703', '#ff5d8f', '#48cae4', '#ffd166'][i]} dur={dur} delay={i * 1.6} scale={sc} dir={dir} />
      ))}

      {/* BOSS — wrapper de réaction (recul / frappe). Illustration fournie si dispo, sinon vectoriel codé. */}
      <motion.g animate={bossControls} initial={{ y: 0, scale: 1 }} style={{ transformBox: 'fill-box', transformOrigin: '50% 72%' }}>
        {art?.full
          ? <BossSprite art={art} teaser={teaser} />
          : art?.parts
            ? <BossRig parts={art.parts} teaser={teaser} />
            : <BossArt uid={uid} teaser={teaser} lowHp={lowHp} />}
      </motion.g>

      {/* décor d'avant-plan */}
      {CORALS.map(([x, y, s, c], i) => <Coral key={i} x={x} y={y} scale={s} color={c} />)}
      <Seaweed x={70} y={585} h={130} color="#3cb371" phase={0.4} />
      <Seaweed x={930} y={585} h={140} color="#2f9d5b" phase={1.8} />

      {/* ÉQUIPAGE */}
      {!teaser && crew.map((c, i) => (
        <Matelot key={c.id ?? i} x={xs[i]} hue={c.hue} role={c.role} weapon={WEAPONS[i % WEAPONS.length]} idx={i} controls={crewControls} />
      ))}

      <Bubbles uid={uid} />

      {/* flash rouge quand l'équipage encaisse */}
      <motion.rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={`url(#${uid}-water)`} animate={hurtControls} initial={{ opacity: 0 }} style={{ mixBlendMode: 'multiply', pointerEvents: 'none' }} />
      <motion.rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#ff2a2a" animate={hurtControls} initial={{ opacity: 0 }} style={{ pointerEvents: 'none' }} />

      {/* vignette de profondeur */}
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={`url(#${uid}-vig)`} pointerEvents="none" />
      <radialGradient id={`${uid}-vig`} cx="0.5" cy="0.42" r="0.75">
        <stop offset="0.55" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor={teaser ? '#020d15' : '#062231'} stopOpacity={teaser ? 0.85 : 0.5} />
      </radialGradient>
    </svg>
  )
}

// teaser : rendu abyssal/silhouette pour la page de pré-annonce (fond sombre,
// halos atténués, équipage absent → le boss luit dans le noir sans tout dévoiler).
export default function RaidMonster2D({ crew = [], hp = 1, maxHp = 1, hitSignal = 0, attackSignal = 0, teaser = false, boss = 'meduse' }) {
  const uid = useId().replace(/:/g, '')
  const lowHp = maxHp > 0 && hp / maxHp <= 0.34

  const bossControls = useAnimationControls()
  const crewControls = useAnimationControls()
  const hurtControls = useAnimationControls()

  // hitSignal : l'équipage touche le boss → boss recule + flash, matelots bondissent.
  useEffect(() => {
    if (hitSignal <= 0) return
    bossControls.start({ y: [0, -26, 6, 0], scale: [1, 0.94, 1.02, 1], filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1)'], transition: { duration: 0.55, ease: 'easeOut' } })
    crewControls.start({ y: [0, -22, 0], rotate: [0, -6, 0], transition: { duration: 0.4, ease: 'easeOut' } })
  }, [hitSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // attackSignal : le boss frappe l'équipage → boss bondit en avant, matelots reculent + flash rouge.
  useEffect(() => {
    if (attackSignal <= 0) return
    bossControls.start({ y: [0, 22, 0], scale: [1, 1.06, 1], transition: { duration: 0.5, ease: 'easeOut' } })
    crewControls.start({ y: [0, 16, 0], rotate: [0, 8, 0], transition: { duration: 0.45, ease: 'easeOut' } })
    hurtControls.start({ opacity: [0, 0.45, 0], transition: { duration: 0.5, ease: 'easeOut' } })
  }, [attackSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="r2d" data-teaser={teaser ? 'true' : 'false'} data-low={lowHp ? 'true' : 'false'}>
      <Scene
        uid={uid} boss={boss} crew={crew} teaser={teaser} lowHp={lowHp}
        bossControls={bossControls} crewControls={crewControls} hurtControls={hurtControls}
      />
    </div>
  )
}
