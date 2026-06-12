import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { ORGANS } from '../../lib/raid'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

function Conductor({ refs }) {
  useFrame(() => { for (const r of refs) r.current = Math.max(0, r.current - 0.025) })
  return null
}

// ── Décor : ruines englouties (médiéval + aquatique) ──
function Environment() {
  const columns = [[-4.5, -2], [4.6, -2.6], [-3, -3.4], [3.2, -1.4]]
  const rocks = [[-2.2, -1.9, -1.2, 0.5], [3, -1.95, -0.5, 0.42], [1.4, -1.95, 1.3, 0.34], [-3.6, -1.92, 0.4, 0.4]]
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.05, -0.5]}>
        <circleGeometry args={[12, 56]} />
        <meshStandardMaterial color="#16314a" roughness={1} />
      </mesh>
      {columns.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, -1.2, 0]}>
            <cylinderGeometry args={[0.36, 0.42, 1.6 + (i % 2) * 0.7, 12]} />
            <meshStandardMaterial color="#2c4256" roughness={0.95} />
          </mesh>
          <mesh position={[0, -0.35 + (i % 2) * 0.35, 0]}>
            <boxGeometry args={[1, 0.18, 1]} />
            <meshStandardMaterial color="#33506a" roughness={0.95} />
          </mesh>
        </group>
      ))}
      {rocks.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[i, i * 2, i]}>
          <dodecahedronGeometry args={[s, 0]} />
          <meshStandardMaterial color="#1f3850" roughness={1} />
        </mesh>
      ))}
    </>
  )
}

function Bubbles() {
  const ref = useRef()
  const data = useMemo(() => Array.from({ length: 26 }, () => ({
    x: (Math.random() - 0.5) * 11, y: -2 + Math.random() * 5, z: (Math.random() - 0.5) * 4,
    s: 0.02 + Math.random() * 0.05, sp: 0.25 + Math.random() * 0.5,
  })), [])
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.children.forEach((m, i) => { m.position.y += data[i].sp * dt; if (m.position.y > 3.6) m.position.y = -2 })
  })
  return (
    <group ref={ref}>
      {data.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]}><sphereGeometry args={[b.s, 8, 8]} /><meshStandardMaterial color="#bfe6ff" transparent opacity={0.3} /></mesh>
      ))}
    </group>
  )
}

// ── Méduse ──
function Bell({ recoilRef, lowHp }) {
  const ref = useRef(); const matRef = useRef()
  useFrame((s) => {
    const t = s.clock.elapsedTime; const r = recoilRef.current
    const pulse = 1 + Math.sin(t * (lowHp ? 2.4 : 1.6)) * 0.08
    ref.current.scale.set(pulse, 1 - (pulse - 1) * 0.7, pulse)
    ref.current.position.y = 1.0 + Math.sin(t * 0.8) * 0.15 + r * 0.9
    ref.current.position.z = -0.6 - r * 0.6
    if (matRef.current) matRef.current.emissiveIntensity = 0.45 + r * 1.6 + (lowHp ? 0.2 : 0)
  })
  return (
    <mesh ref={ref} position={[0, 1.0, -0.6]}>
      <sphereGeometry args={[1.3, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
      <meshStandardMaterial ref={matRef} color="#c06bff" emissive="#6b1fb0" emissiveIntensity={0.5}
        transparent opacity={0.8} roughness={0.25} metalness={0.1} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Tentacle({ baseAngle, baseRadius, targetX, phase, strikeRef }) {
  const meshRef = useRef()
  const initial = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, -1, 0)]), 12, 0.05, 6, false), [])
  useFrame((s) => {
    const t = s.clock.elapsedTime; const atk = strikeRef.current
    const bx = Math.cos(baseAngle) * baseRadius
    const bz = Math.sin(baseAngle) * baseRadius - 0.6
    const N = 9; const pts = []
    for (let i = 0; i <= N; i++) {
      const f = i / N
      const y = 0.7 - f * (2.6 + atk * 1.0)
      const wave = Math.sin(t * 1.7 + phase + f * 4.2) * (0.22 * f)
      const x = bx + wave + (targetX - bx) * f * (0.3 + atk * 0.55)
      const z = bz + (1.2 - bz) * f * (atk * 0.5) + Math.cos(t * 1.35 + phase + f * 3.1) * (0.16 * f)
      pts.push(V(x, y, z))
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.055, 6, false)
    meshRef.current.geometry.dispose(); meshRef.current.geometry = geo
  })
  useEffect(() => () => meshRef.current?.geometry?.dispose(), [])
  return <mesh ref={meshRef} geometry={initial}><meshStandardMaterial color="#cf86ff" emissive="#8a3ce0" emissiveIntensity={0.55} transparent opacity={0.85} roughness={0.4} /></mesh>
}

// ── Armes médiévales ──
function Weapon({ type, swingRef }) {
  const g = useRef()
  useFrame(() => { if (g.current) g.current.rotation.x = -0.3 - swingRef.current * 1.5 })
  const steel = <meshStandardMaterial color="#d3dae2" metalness={0.6} roughness={0.3} />
  const wood = <meshStandardMaterial color="#6b4a25" roughness={0.85} />
  return (
    <group ref={g} position={[0.36, 0.45, 0.06]} rotation={[-0.3, 0, -0.25]}>
      {type === 'trident' && (<>
        <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.03, 0.03, 0.95, 8]} />{wood}</mesh>
        <mesh position={[0, 0.86, 0]}><boxGeometry args={[0.22, 0.03, 0.03]} />{steel}</mesh>
        {[-0.09, 0, 0.09].map((x) => <mesh key={x} position={[x, 0.96, 0]}><coneGeometry args={[0.03, 0.18, 6]} />{steel}</mesh>)}
      </>)}
      {type === 'sword' && (<>
        <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />{wood}</mesh>
        <mesh position={[0, 0.21, 0]}><boxGeometry args={[0.2, 0.04, 0.04]} /><meshStandardMaterial color="#c8a84a" metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.07, 0.66, 0.02]} />{steel}</mesh>
      </>)}
      {type === 'mace' && (<>
        <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.035, 0.035, 0.62, 8]} />{wood}</mesh>
        <mesh position={[0, 0.68, 0]}><icosahedronGeometry args={[0.14, 0]} /><meshStandardMaterial color="#9aa3ad" metalness={0.5} roughness={0.5} /></mesh>
      </>)}
    </group>
  )
}

// ── Symbole de rôle (sprite emoji billboard) ──
function RoleSprite({ role, hue }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const ctx = c.getContext('2d')
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fillStyle = `hsl(${hue} 55% 42%)`; ctx.fill()
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke()
    ctx.font = '64px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(ORGANS[role]?.emoji || '•', 64, 70)
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t
  }, [role, hue])
  useEffect(() => () => tex.dispose(), [tex])
  return <sprite position={[0, 1.55, 0]} scale={[0.55, 0.55, 0.55]}><spriteMaterial map={tex} transparent depthWrite={false} /></sprite>
}

// ── Matelot (un joueur) ──
function Matelot({ x, hue, role, weapon, phase, attackRef, hitRef }) {
  const g = useRef(); const bodyMat = useRef()
  useFrame((s) => {
    const t = s.clock.elapsedTime; const atk = attackRef.current; const hit = hitRef.current
    g.current.position.y = -1.75 + Math.sin(t * 2 + phase) * 0.05 + atk * 0.5
    g.current.position.z = 1.1 - atk * 0.7 + hit * 0.35
    g.current.rotation.x = -atk * 0.35 + hit * 0.4
    if (bodyMat.current) bodyMat.current.emissiveIntensity = hit * 1.1
  })
  return (
    <group ref={g} position={[x, -1.75, 1.1]}>
      <mesh position={[0, 0.35, 0]}>
        <capsuleGeometry args={[0.24, 0.42, 4, 12]} />
        <meshStandardMaterial ref={bodyMat} color={`hsl(${hue} 58% 55%)`} emissive="#ff3030" emissiveIntensity={0} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.86, 0]}><sphereGeometry args={[0.21, 20, 20]} /><meshStandardMaterial color="#f3c9a0" roughness={0.85} /></mesh>
      <mesh position={[0, 1.0, 0]}><cylinderGeometry args={[0.24, 0.24, 0.07, 18]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
      <mesh position={[0, 1.06, 0]}><cylinderGeometry args={[0.15, 0.15, 0.07, 18]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
      <mesh position={[0, 1.13, 0]}><sphereGeometry args={[0.045, 8, 8]} /><meshStandardMaterial color="#e23b3b" /></mesh>
      <Weapon type={weapon} swingRef={attackRef} />
      <RoleSprite role={role} hue={hue} />
    </group>
  )
}

const WEAPONS = ['trident', 'sword', 'mace']

function Scene({ crew, refs, lowHp }) {
  const n = Math.max(1, crew.length)
  const xs = crew.map((_, i) => (n === 1 ? 0 : -2.5 + (5 * i) / (n - 1)))
  const TENT = 8
  return (
    <>
      <ambientLight intensity={0.45} />
      <pointLight position={[2, 4, 4]} intensity={70} color="#a06bff" />
      <pointLight position={[-3, 1, 4]} intensity={40} color="#3fd0c0" />
      <pointLight position={[0, 0, 5]} intensity={25} color="#ffd9a0" />
      <fog attach="fog" args={['#0a1626', 9, 18]} />
      <Conductor refs={refs.all} />
      <Environment />
      <Bubbles />
      <Bell recoilRef={refs.mRecoil} lowHp={lowHp} />
      {Array.from({ length: TENT }).map((_, i) => (
        <Tentacle key={i} baseAngle={(i / TENT) * Math.PI * 2} baseRadius={0.85} targetX={xs[i % n]} phase={i * 1.3} strikeRef={refs.mAttack} />
      ))}
      {crew.map((c, i) => (
        <Matelot key={c.id ?? i} x={xs[i]} hue={c.hue} role={c.role} weapon={WEAPONS[i % WEAPONS.length]} phase={i * 1.6} attackRef={refs.sAttack} hitRef={refs.sHit} />
      ))}
    </>
  )
}

export default function RaidMonster3D({ crew = [], hp = 1, maxHp = 1, hitSignal = 0, attackSignal = 0 }) {
  const mRecoil = useRef(0), mAttack = useRef(0), sAttack = useRef(0), sHit = useRef(0)
  const refs = useMemo(() => ({ mRecoil, mAttack, sAttack, sHit, all: [mRecoil, mAttack, sAttack, sHit] }), [])
  const lowHp = maxHp > 0 && hp / maxHp <= 0.34
  useEffect(() => { if (hitSignal > 0) { mRecoil.current = 1; sAttack.current = 1 } }, [hitSignal])
  useEffect(() => { if (attackSignal > 0) { mAttack.current = 1; sHit.current = 1 } }, [attackSignal])
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.4, 8.2], fov: 44 }} style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => gl.setClearColor('#0a1626')}>
      <Scene crew={crew} refs={refs} lowHp={lowHp} />
    </Canvas>
  )
}
