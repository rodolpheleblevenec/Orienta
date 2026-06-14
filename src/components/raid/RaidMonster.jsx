import { lazy, useEffect, useRef } from 'react'
import { getRaidClips } from '../../lib/raidClips'
import RaidStrikes from './RaidStrikes'
import RaidMonsterVideo from './RaidMonsterVideo'
import RaidBackdrop from './RaidBackdrop'

// ─────────────────────────────────────────────────────────────────────────────
// Compositeur de la scène de combat RAID (2.5D).
//
// Empile, du fond vers l'avant :
//   1. un BACKDROP illustré (image d'arène, avec dégradé abyssal de secours) ;
//   2. la SCÈNE du boss — média pré-rendu / baleine dessinée en code
//      (RaidMonsterVideo) si un clip existe, sinon scène 2D de secours ;
//   3. un léger color-grade / vignette pour fondre le boss dans l'ambiance ;
//   4. la couche d'EFFETS (RaidStrikes : attaques par rôle, ondes du boss) ;
//   5. un FLASH plein cadre.
// Le tout dans un wrapper qui reçoit le SCREEN-SHAKE (transform CSS pur → hors
// WebGL, donc sans risque de perte de contexte). L'équipage n'est plus dessiné
// dans la scène : il est représenté par les cartes de rôle (RoleStrip) en overlay
// et par les effets qu'il projette ici.
//
// Interface : { boss, crew, hp, maxHp, hitSignal, attackSignal, teaser }.
// ─────────────────────────────────────────────────────────────────────────────

const RaidMonster2D = lazy(() => import('./RaidMonster2D'))

export default function RaidMonster(props) {
  const { boss, crew = [], hitSignal = 0, attackSignal = 0, teaser = false } = props
  // Boss : média pré-rendu / baleine dessinée en code (RaidMonsterVideo) si un clip
  // existe, sinon scène 2D vectorielle de secours. La 3D WebGL est abandonnée
  // (perte de contexte GPU) → rendu 100 % hors WebGL.
  const Scene = getRaidClips(boss) ? RaidMonsterVideo : RaidMonster2D
  const shakeRef = useRef(null)
  const flashRef = useRef(null)

  const shake = (variant) => {
    const el = shakeRef.current
    if (!el) return
    el.classList.remove('raid-shake--hit', 'raid-shake--atk')
    void el.offsetWidth
    el.classList.add(variant)
  }
  const flash = (variant) => {
    const el = flashRef.current
    if (!el) return
    el.classList.remove('raid-flash--on', 'raid-flash--hit', 'raid-flash--atk')
    void el.offsetWidth
    el.classList.add('raid-flash--on', variant)
  }

  // Assaut réussi : secousse + flash clair.
  useEffect(() => {
    if (teaser || hitSignal <= 0) return
    shake('raid-shake--hit')
    flash('raid-flash--hit')
  }, [hitSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Contre-attaque / échec : secousse plus forte + flash rouge.
  useEffect(() => {
    if (teaser || attackSignal <= 0) return
    shake('raid-shake--atk')
    flash('raid-flash--atk')
  }, [attackSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="raid-stage-shake" ref={shakeRef}>
      <RaidBackdrop teaser={teaser} />
      <div className="raid-scene">
        <Scene {...props} />
      </div>
      <div className="raid-grade" />
      {!teaser && (
        <div className="raid-fx-layer">
          <RaidStrikes crew={crew} hitSignal={hitSignal} attackSignal={attackSignal} />
        </div>
      )}
      <div className="raid-flash" ref={flashRef} />
    </div>
  )
}
