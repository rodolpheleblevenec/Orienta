// ─────────────────────────────────────────────────────────────────────────────
// Décor de la scène de combat RAID — paysage « golden hour » dessiné en code :
// un lac entouré de montagnes, soleil bas et chaud, plage en avant-plan.
// Style illustration épurée par couches (aplats dégradés + parallaxe + atmosphère
// animée), rendu HORS WebGL → fiable partout. La baleine (boss) et l'équipage
// sont composés par-dessus (couches `.raid-scene` / `.raid-fx-layer`).
//
// Repère vertical (en % de la hauteur de la scène) :
//   0–50 % ciel · ~50 % horizon/montagnes · 50–80 % lac · 80–100 % plage.
// ─────────────────────────────────────────────────────────────────────────────

// Silhouettes de montagnes (viewBox étiré horizontalement → couvre toute largeur).
const MTN_FAR = 'M0,300 L0,168 C120,118 210,196 330,150 C450,104 540,188 660,132 C778,92 880,178 1000,140 L1000,300 Z'
const MTN_NEAR = 'M0,300 L0,214 C150,150 270,250 410,176 C530,116 612,242 770,168 C868,126 944,222 1000,188 L1000,300 Z'

export default function RaidBackdrop({ teaser = false }) {
  return (
    <div className="rbk" data-teaser={teaser ? 'true' : 'false'} aria-hidden="true">
      {/* ciel + lac + plage (dégradé de base, bandes nettes à l'horizon et au rivage) */}
      <div className="rbk-base" />

      {/* soleil bas et son halo, derrière les montagnes */}
      <div className="rbk-sun" />
      <div className="rbk-rays" />

      {/* montagnes étagées (parallaxe douce) */}
      <svg className="rbk-mtn rbk-mtn--far" viewBox="0 0 1000 300" preserveAspectRatio="none">
        <path d={MTN_FAR} fill="#9a6f8e" />
      </svg>
      <svg className="rbk-mtn rbk-mtn--near" viewBox="0 0 1000 300" preserveAspectRatio="none">
        <path d={MTN_NEAR} fill="#5b4f74" />
        {/* liseré chaud du soleil sur les crêtes */}
        <path d={MTN_NEAR} fill="none" stroke="#ffd59a" strokeWidth="2.5" opacity="0.5" />
      </svg>

      {/* brume chaude sur l'horizon */}
      <div className="rbk-haze" />

      {/* reflet doré du soleil + miroitement du lac */}
      <div className="rbk-streak" />
      <div className="rbk-shimmer" />

      {/* nuages chauds qui dérivent */}
      <div className="rbk-clouds">
        <span className="rbk-cloud rbk-cloud--1" />
        <span className="rbk-cloud rbk-cloud--2" />
        <span className="rbk-cloud rbk-cloud--3" />
      </div>

      {/* oiseaux lointains */}
      <svg className="rbk-birds" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        {[[180, 120], [220, 140], [260, 110], [700, 90], [740, 112], [778, 86]].map(([x, y], i) => (
          <path key={i} d={`M${x},${y} q6,-7 12,0 q6,-7 12,0`} fill="none" stroke="#3a2f3e" strokeWidth="2.5"
            strokeLinecap="round" opacity="0.5" className="rbk-bird" style={{ animationDelay: `${i * 1.3}s` }} />
        ))}
      </svg>

      {/* grain de lumière (poussière/pollen) dans l'air chaud */}
      <div className="rbk-motes" />
    </div>
  )
}
