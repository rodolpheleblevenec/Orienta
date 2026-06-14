import { useEffect, useRef, useState } from 'react'
import { getRaidClips } from '../../lib/raidClips'
import RaidWhale from './RaidWhale'

// ─────────────────────────────────────────────────────────────────────────────
// Boss RAID en MÉDIA PRÉ-RENDU (universel, HORS WebGL — aucun risque de perte de
// contexte GPU). Se glisse dans `.raid-scene` du compositeur, à la place du canvas
// 3D. Le combat (flash, secousse, salves, ondes) reste géré par le compositeur.
//
//  • poster : image affichée immédiatement (et de secours) ;
//  • idle   : boucle vidéo (le boss « vit ») ;
//  • attack : si fourni, joué UNE fois par-dessus l'idle sur la contre-attaque.
//
// Tant qu'AUCUN média n'est dispo (asset pas encore fourni / fichier absent), on
// affiche un boss de remplacement atmosphérique (présence lumineuse + emoji du
// boss) → la scène n'est jamais vide, sans rien demander à personne.
//
// Interface alignée sur les autres scènes : { boss, attackSignal, teaser }.
// ─────────────────────────────────────────────────────────────────────────────

export default function RaidMonsterVideo({ boss, hitSignal = 0, attackSignal = 0, hp = 1, maxHp = 1, teaser = false, assaultIndex = null, assaultCount = 0, outcome = null }) {
  const clips = getRaidClips(boss) || {}
  const atkRef = useRef(null)
  // On PART du principe qu'aucun média n'est prêt → la baleine dessinée (RaidWhale)
  // s'affiche IMMÉDIATEMENT (et joue enrage/agonie de façon fiable). Un vrai poster
  // ne prend le dessus QUE s'il se charge réellement (onLoad). Indispensable car
  // l'hébergement réécrit les chemins inconnus vers index.html (le poster « 200 » mais
  // n'est pas une image) → sans ça, la baleine ne se montait jamais de façon fiable.
  const [posterOk, setPosterOk] = useState(false)
  const [idleOk, setIdleOk] = useState(false)

  // Contre-attaque du boss → si un clip 'attack' existe, on le joue une fois
  // par-dessus l'idle, puis on le re-cache (l'idle reste en boucle dessous).
  useEffect(() => {
    const a = atkRef.current
    if (teaser || attackSignal <= 0 || !clips.attack || !a) return
    a.currentTime = 0
    a.style.opacity = '1'
    a.play().catch(() => {})
    const hide = () => { a.style.opacity = '0' }
    a.addEventListener('ended', hide, { once: true })
    return () => a.removeEventListener('ended', hide)
  }, [attackSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Un vrai média est-il visible ? Sinon → boss de remplacement.
  const hasMedia = (clips.poster && posterOk) || (clips.idle && idleOk)

  return (
    <div className="raid-bossvid" data-teaser={teaser ? 'true' : 'false'}>
      {clips.poster && (
        <img className="raid-bossvid-layer raid-bossvid-poster" src={clips.poster} alt="" aria-hidden="true"
          onLoad={() => setPosterOk(true)} onError={() => setPosterOk(false)} />
      )}
      {clips.idle && (
        <video
          className="raid-bossvid-layer"
          src={clips.idle}
          poster={clips.poster || undefined}
          autoPlay loop muted playsInline preload="auto"
          onCanPlay={() => setIdleOk(true)}
          onError={() => setIdleOk(false)}
        />
      )}
      {clips.attack && (
        <video
          ref={atkRef}
          className="raid-bossvid-layer raid-bossvid-atk"
          src={clips.attack}
          muted playsInline preload="auto"
          style={{ opacity: 0 }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
      {/* Aucun média fourni → la baleine dessinée en code (émerge du lac). */}
      {!hasMedia && (
        <RaidWhale hitSignal={hitSignal} attackSignal={attackSignal} hp={hp} maxHp={maxHp}
          assaultIndex={assaultIndex} assaultCount={assaultCount} outcome={outcome} />
      )}
    </div>
  )
}
