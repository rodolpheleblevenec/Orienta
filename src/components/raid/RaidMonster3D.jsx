import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

// Cloche de la méduse : pulse comme une nage, recule + flashe quand elle perd des PV.
function Bell({ hitRef, lowHp }) {
  const ref = useRef()
  const matRef = useRef()
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const speed = lowHp ? 2.4 : 1.6
    const pulse = 1 + Math.sin(t * speed) * 0.08
    ref.current.scale.set(pulse, 1 - (pulse - 1) * 0.7, pulse)
    let y = 0.4 + Math.sin(t * 0.8) * 0.15
    if (hitRef.current > 0) { y += hitRef.current * 0.9; hitRef.current = Math.max(0, hitRef.current - 0.035) }
    ref.current.position.y = y
    if (matRef.current) matRef.current.emissiveIntensity = 0.45 + hitRef.current * 1.4 + (lowHp ? 0.2 : 0)
  })
  return (
    <mesh ref={ref} position={[0, 0.4, 0]}>
      <sphereGeometry args={[1.15, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
      <meshStandardMaterial ref={matRef} color="#c06bff" emissive="#6b1fb0" emissiveIntensity={0.5}
        transparent opacity={0.8} roughness={0.25} metalness={0.1} side={THREE.DoubleSide} />
    </mesh>
  )
}

// Un tentacule : courbe descendante qui ondule et dérive vers une cible (un membre d'équipage),
// et qui s'allonge à l'attaque.
function Tentacle({ baseAngle, baseRadius, targetX, phase, attackRef }) {
  const meshRef = useRef()
  const initial = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, -1, 0)]), 12, 0.05, 6, false), [])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const atk = attackRef.current
    const bx = Math.cos(baseAngle) * baseRadius
    const bz = Math.sin(baseAngle) * baseRadius
    const N = 9
    const pts = []
    for (let i = 0; i <= N; i++) {
      const f = i / N
      const y = 0.15 - f * (2.5 + atk * 0.8)
      const wave = Math.sin(t * 1.7 + phase + f * 4.2) * (0.22 * f)
      const x = bx + wave + (targetX - bx) * f * (0.32 + atk * 0.55)
      const z = bz + Math.cos(t * 1.35 + phase + f * 3.1) * (0.16 * f)
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

// Orbe d'équipage (proie) : petite sphère lumineuse qui flotte.
function CrewOrb({ x, hue, i }) {
  const ref = useRef()
  useFrame((s) => {
    const t = s.clock.elapsedTime
    ref.current.position.y = -2.35 + Math.sin(t * 1.1 + i) * 0.08
  })
  return (
    <mesh ref={ref} position={[x, -2.35, 0.3]}>
      <sphereGeometry args={[0.18, 20, 20]} />
      <meshStandardMaterial color={`hsl(${hue} 70% 60%)`} emissive={`hsl(${hue} 80% 45%)`} emissiveIntensity={0.9} />
    </mesh>
  )
}

function Scene({ crew, hitRef, attackRef, lowHp }) {
  const n = Math.max(1, crew.length)
  const targets = crew.map((_, i) => (n === 1 ? 0 : -2 + (4 * i) / (n - 1)))
  const TENT = 8
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[2, 4, 4]} intensity={60} color="#a06bff" />
      <pointLight position={[-3, 1, 3]} intensity={30} color="#3fd0c0" />
      <fog attach="fog" args={['#0a1626', 6, 13]} />
      <Bell hitRef={hitRef} lowHp={lowHp} />
      {Array.from({ length: TENT }).map((_, i) => (
        <Tentacle key={i} baseAngle={(i / TENT) * Math.PI * 2} baseRadius={0.75}
          targetX={targets[i % n]} phase={i * 1.3} attackRef={attackRef} />
      ))}
      {crew.map((c, i) => <CrewOrb key={c.id ?? i} x={targets[i]} hue={c.hue} i={i} />)}
    </>
  )
}

// Méduse 3D réactive. Props : crew [{id,hue}], hp, maxHp, hitSignal (perte de PV),
// attackSignal (essai raté / bouée perdue).
export default function RaidMonster3D({ crew = [], hp = 1, maxHp = 1, hitSignal = 0, attackSignal = 0 }) {
  const hitRef = useRef(0)
  const attackRef = useRef(0)
  const lowHp = maxHp > 0 && hp / maxHp <= 0.34

  useEffect(() => { if (hitSignal > 0) hitRef.current = 1 }, [hitSignal])
  useEffect(() => {
    if (attackSignal <= 0) return
    attackRef.current = 1
    const iv = setInterval(() => { attackRef.current = Math.max(0, attackRef.current - 0.06); if (attackRef.current <= 0) clearInterval(iv) }, 30)
    return () => clearInterval(iv)
  }, [attackSignal])

  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, -0.2, 6], fov: 42 }} style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => gl.setClearColor('#0a1626')}>
      <Scene crew={crew} hitRef={hitRef} attackRef={attackRef} lowHp={lowHp} />
    </Canvas>
  )
}
