import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

// Décroît tous les "signaux de combat" (1 → 0) une seule fois par frame.
function Conductor({ refs }) {
  useFrame(() => { for (const r of refs) r.current = Math.max(0, r.current - 0.025) })
  return null
}

// Cloche de la méduse : nage (pulse) ; recule + flashe quand les matelots la frappent.
function Bell({ recoilRef, lowHp }) {
  const ref = useRef()
  const matRef = useRef()
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const r = recoilRef.current
    const pulse = 1 + Math.sin(t * (lowHp ? 2.4 : 1.6)) * 0.08
    ref.current.scale.set(pulse, 1 - (pulse - 1) * 0.7, pulse)
    ref.current.position.y = 0.8 + Math.sin(t * 0.8) * 0.15 + r * 0.9
    ref.current.position.z = -0.3 - r * 0.6
    if (matRef.current) matRef.current.emissiveIntensity = 0.45 + r * 1.6 + (lowHp ? 0.2 : 0)
  })
  return (
    <mesh ref={ref} position={[0, 0.8, -0.3]}>
      <sphereGeometry args={[1.25, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
      <meshStandardMaterial ref={matRef} color="#c06bff" emissive="#6b1fb0" emissiveIntensity={0.5}
        transparent opacity={0.8} roughness={0.25} metalness={0.1} side={THREE.DoubleSide} />
    </mesh>
  )
}

// Tentacule : ondule, et se tend/frappe vers un matelot quand la méduse attaque.
function Tentacle({ baseAngle, baseRadius, targetX, phase, strikeRef }) {
  const meshRef = useRef()
  const initial = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, -1, 0)]), 12, 0.05, 6, false), [])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const atk = strikeRef.current
    const bx = Math.cos(baseAngle) * baseRadius
    const bz = Math.sin(baseAngle) * baseRadius - 0.3
    const N = 9
    const pts = []
    for (let i = 0; i <= N; i++) {
      const f = i / N
      const y = 0.55 - f * (2.5 + atk * 1.0)
      const wave = Math.sin(t * 1.7 + phase + f * 4.2) * (0.22 * f)
      const x = bx + wave + (targetX - bx) * f * (0.3 + atk * 0.55)
      const z = bz + (1.0 - bz) * f * (atk * 0.5) + Math.cos(t * 1.35 + phase + f * 3.1) * (0.16 * f)
      pts.push(V(x, y, z))
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.055, 6, false)
    meshRef.current.geometry.dispose()
    meshRef.current.geometry = geo
  })
  useEffect(() => () => meshRef.current?.geometry?.dispose(), [])
  return (
    <mesh ref={meshRef} geometry={initial}>
      <meshStandardMaterial color="#cf86ff" emissive="#8a3ce0" emissiveIntensity={0.55} transparent opacity={0.85} roughness={0.4} />
    </mesh>
  )
}

// Matelot (un joueur) : idle ; bondit vers la méduse à l'attaque ; recule + flashe rouge quand frappé.
function Matelot({ x, hue, phase, attackRef, hitRef }) {
  const g = useRef()
  const bodyMat = useRef()
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const atk = attackRef.current
    const hit = hitRef.current
    g.current.position.y = -1.75 + Math.sin(t * 2 + phase) * 0.05 + atk * 0.6
    g.current.position.z = 1.0 - atk * 0.7 + hit * 0.35
    g.current.rotation.x = -atk * 0.35 + hit * 0.4
    if (bodyMat.current) bodyMat.current.emissiveIntensity = hit * 1.1
  })
  return (
    <group ref={g} position={[x, -1.75, 1.0]}>
      <mesh position={[0, 0.35, 0]}>
        <capsuleGeometry args={[0.24, 0.42, 4, 12]} />
        <meshStandardMaterial ref={bodyMat} color={`hsl(${hue} 58% 55%)`} emissive="#ff3030" emissiveIntensity={0} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.86, 0]}>
        <sphereGeometry args={[0.21, 20, 20]} />
        <meshStandardMaterial color="#f3c9a0" roughness={0.85} />
      </mesh>
      {/* bachi (chapeau de marin) + pompon rouge */}
      <mesh position={[0, 1.0, 0]}><cylinderGeometry args={[0.24, 0.24, 0.07, 18]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
      <mesh position={[0, 1.06, 0]}><cylinderGeometry args={[0.15, 0.15, 0.07, 18]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
      <mesh position={[0, 1.13, 0]}><sphereGeometry args={[0.045, 8, 8]} /><meshStandardMaterial color="#e23b3b" /></mesh>
    </group>
  )
}

function Scene({ crew, refs, lowHp }) {
  const n = Math.max(1, crew.length)
  const xs = crew.map((_, i) => (n === 1 ? 0 : -2.4 + (4.8 * i) / (n - 1)))
  const TENT = 8
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[2, 4, 4]} intensity={70} color="#a06bff" />
      <pointLight position={[-3, 1, 4]} intensity={35} color="#3fd0c0" />
      <pointLight position={[0, -1, 5]} intensity={20} color="#ffd9a0" />
      <fog attach="fog" args={['#0a1626', 8, 16]} />
      <Conductor refs={refs.all} />
      <Bell recoilRef={refs.mRecoil} lowHp={lowHp} />
      {Array.from({ length: TENT }).map((_, i) => (
        <Tentacle key={i} baseAngle={(i / TENT) * Math.PI * 2} baseRadius={0.8}
          targetX={xs[i % n]} phase={i * 1.3} strikeRef={refs.mAttack} />
      ))}
      {crew.map((c, i) => (
        <Matelot key={c.id ?? i} x={xs[i]} hue={c.hue} phase={i * 1.6} attackRef={refs.sAttack} hitRef={refs.sHit} />
      ))}
    </>
  )
}

// Combat 3D : la méduse face aux matelots (les joueurs). Réussite d'une grille →
// les matelots attaquent (méduse recule + perd des PV). Échec → la méduse frappe.
export default function RaidMonster3D({ crew = [], hp = 1, maxHp = 1, hitSignal = 0, attackSignal = 0 }) {
  const mRecoil = useRef(0), mAttack = useRef(0), sAttack = useRef(0), sHit = useRef(0)
  const refs = useMemo(() => ({ mRecoil, mAttack, sAttack, sHit, all: [mRecoil, mAttack, sAttack, sHit] }), [])
  const lowHp = maxHp > 0 && hp / maxHp <= 0.34

  // Réussite → les matelots frappent la méduse (elle recule).
  useEffect(() => { if (hitSignal > 0) { mRecoil.current = 1; sAttack.current = 1 } }, [hitSignal])
  // Échec → la méduse frappe les matelots (ils encaissent).
  useEffect(() => { if (attackSignal > 0) { mAttack.current = 1; sHit.current = 1 } }, [attackSignal])

  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.2, 8], fov: 44 }} style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => gl.setClearColor('#0a1626')}>
      <Scene crew={crew} refs={refs} lowHp={lowHp} />
    </Canvas>
  )
}
