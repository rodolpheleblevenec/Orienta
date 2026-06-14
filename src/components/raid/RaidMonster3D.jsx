import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { getRaidModel } from '../../lib/raidModels'
import { getBackdrop } from '../../lib/raidScene'

// ─────────────────────────────────────────────────────────────────────────────
// Scène 3D du boss RAID — le modèle (.glb) devant un DÉCOR rendu DANS la scène
// (background three.js) : dégradé abyssal par défaut, remplacé par l'illustration
// d'arène si elle existe. Canvas OPAQUE volontairement : un canvas transparent
// peut se composer « à blanc » sur un GPU faible — l'opaque est le chemin fiable.
// L'équipage n'est plus rendu en 3D (cartes de rôle + effets en overlay 2D).
//
// Scène minimale (un mesh, deux lumières) + matériaux allégés en Lambert + dpr:1
// + antialias:false : on soulage le GPU pour éviter la perte de contexte WebGL
// (« écran bleu »). NE PAS ajouter de post-processing ici.
// ─────────────────────────────────────────────────────────────────────────────

// Amortit les refs de réaction au combat (recul / bond) vers 0 à chaque frame.
function Conductor({ refs }) {
  useFrame(() => { for (const r of refs) r.current = Math.max(0, r.current - 0.025) })
  return null
}

// Dégradé abyssal de secours (cyan profond en haut → noir en bas).
function makeGradientTexture(teaser) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  if (teaser) { g.addColorStop(0, '#0b3346'); g.addColorStop(0.5, '#06222f'); g.addColorStop(1, '#020d15') }
  else { g.addColorStop(0, '#1c5a74'); g.addColorStop(0.5, '#0c2f44'); g.addColorStop(1, '#03101c') }
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256)
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex
}

// Fond de scène : dégradé abyssal immédiat, remplacé par l'illustration d'arène
// (getBackdrop) dès qu'elle est chargée ; si l'image est absente (404), on garde
// le dégradé. Rendu DANS le canvas (opaque) → aucun risque de compositing.
function SceneBackground({ boss, teaser }) {
  const { scene } = useThree()
  const gradient = useMemo(() => makeGradientTexture(teaser), [teaser])
  useEffect(() => {
    scene.background = gradient
    let imgTex, cancelled = false
    new THREE.TextureLoader().load(
      getBackdrop(boss),
      (t) => { if (cancelled) { t.dispose(); return } t.colorSpace = THREE.SRGBColorSpace; imgTex = t; scene.background = t },
      undefined,
      () => {} // image absente → on garde le dégradé
    )
    return () => { cancelled = true; if (scene.background === imgTex || scene.background === gradient) scene.background = null; if (imgTex) imgTex.dispose() }
  }, [boss, gradient, scene])
  useEffect(() => () => gradient.dispose(), [gradient])
  return null
}

// Boss chargé depuis un modèle 3D (.glb cartoon généré en image-to-3D).
// Joue le clip « idle » s'il existe ; la flottaison et les réactions de combat
// (recul sur dégât, bond sur attaque) sont pilotées par les refs du Conductor,
// donc fonctionnent même si le modèle n'a aucune animation.
function BossModel({ model, refs }) {
  const group = useRef()
  const { scene, animations } = useGLTF(model.url, model.draco || false)

  // Clone (SkeletonUtils → préserve le squelette des modèles riggés) + dispose={null} :
  // empêche le démontage de disposer le glTF en cache.
  // frustumCulled=false : sans ça, three « cull » le mesh skinné animé (sa sphère
  // englobante figée en pose de repos ne suit pas la déformation) → il apparaît
  // une frame puis disparaît. C'est le correctif standard des modèles animés.
  const obj = useMemo(() => {
    const o = skeletonClone(scene)
    o.traverse((n) => {
      n.frustumCulled = false
      if (n.isMesh && n.material) {
        // Matériau ALLÉGÉ (Lambert au lieu de PBR + KHR_specular) → shader bien moins
        // lourd, pour soulager le GPU et éviter la perte de contexte WebGL. Texture gardée.
        const old = Array.isArray(n.material) ? n.material[0] : n.material
        n.material = new THREE.MeshLambertMaterial({
          map: old.map || null,
          color: old.color ? old.color.clone() : undefined,
          transparent: !!old.transparent,
          alphaTest: old.alphaTest || 0,
          side: old.side,
        })
      }
    })
    return o
  }, [scene])
  const { actions, names } = useAnimations(animations, obj)
  const hasClip = !!(animations && animations.length)

  // Modèle RIGGÉ (avec animations propres, ex. nage) → on joue son clip en boucle.
  useEffect(() => {
    if (!hasClip) return
    const idle = (model.clips && model.clips.idle) || names[0]
    const a = idle ? actions[idle] : null
    if (a) a.reset().fadeIn(0.4).play()
    return () => { if (a) a.fadeOut(0.2) }
  }, [actions, names, hasClip]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ajustement : recentre le modèle à l'origine et le met à l'échelle d'une
  // hauteur cible (les générateurs sortent des tailles/centres arbitraires).
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3(); box.getSize(size)
    const center = new THREE.Vector3(); box.getCenter(center)
    const s = (size.y > 0 ? (model.targetHeight || 3.2) / size.y : 1) * (model.scale || 1)
    return { s, offset: [-center.x, -center.y, -center.z] }
  }, [obj, model.targetHeight, model.scale])

  // Idle doux : légère flottaison + balancement. Réagit au combat via les refs.
  const base = model.position || [0, 1, -0.6]
  useFrame((st) => {
    const g = group.current; if (!g) return
    const t = st.clock.elapsedTime
    const r = refs.mRecoil.current, atk = refs.mAttack.current
    const amp = hasClip ? 0.3 : 1
    g.position.x = base[0]
    g.position.y = base[1] + Math.sin(t * 0.8) * 0.1 * amp + r * 0.5
    g.position.z = base[2] - r * 0.4 + atk * 0.4
    g.rotation.y = (model.rotationY || 0) + Math.sin(t * 0.35) * 0.06 * amp
    g.rotation.x = atk * 0.1
    g.scale.setScalar(1 + Math.sin(t * 1.1) * 0.015 * amp)
  })

  return (
    <group ref={group} position={base} rotation={[0, model.rotationY || 0, 0]}>
      <group scale={fit.s} position={[fit.offset[0] * fit.s, fit.offset[1] * fit.s, fit.offset[2] * fit.s]}>
        <primitive object={obj} dispose={null} />
      </group>
    </group>
  )
}

function Scene({ refs, teaser, boss }) {
  const model = getRaidModel(boss)
  // L'aiguilleur (RaidMonster) ne route ici que pour un boss avec modèle .glb.
  if (!model) return null
  return (
    <>
      <SceneBackground boss={boss} teaser={teaser} />
      <ambientLight intensity={teaser ? 0.5 : 0.85} />
      <directionalLight position={[3, 6, 5]} intensity={teaser ? 0.7 : 1.3} color="#ffffff" />
      <Conductor refs={refs.all} />
      <BossModel key={model.url} model={model} refs={refs} />
    </>
  )
}

// teaser : lumières atténuées → le boss luit en silhouette sur le décor sombre.
export default function RaidMonster3D({ hitSignal = 0, attackSignal = 0, teaser = false, boss = 'rorqual' }) {
  const mRecoil = useRef(0), mAttack = useRef(0)
  const refs = useMemo(() => ({ mRecoil, mAttack, all: [mRecoil, mAttack] }), [])
  useEffect(() => { if (hitSignal > 0) mRecoil.current = 1 }, [hitSignal])
  useEffect(() => { if (attackSignal > 0) mAttack.current = 1 }, [attackSignal])
  return (
    <Canvas
      dpr={1}
      camera={{ position: [0, 0.4, 8.2], fov: 44 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        // Autorise la restauration du contexte WebGL s'il est perdu, et le journalise
        // (diagnostic : si le modèle disparaît à cause du GPU, ça apparaît en console).
        const c = gl.domElement
        c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('[RAID] WebGL context LOST (GPU)') }, false)
        c.addEventListener('webglcontextrestored', () => console.warn('[RAID] WebGL context restored'), false)
      }}
    >
      <Scene refs={refs} teaser={teaser} boss={boss} />
    </Canvas>
  )
}
