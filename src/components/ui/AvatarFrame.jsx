import { frameClass } from '../../lib/shopCosmetics'

// Enveloppe un avatar avec le cadre cosmétique équipé (anneau autour).
// Sans cadre équipé, ne rend aucun wrapper (l'avatar s'affiche tel quel).
export default function AvatarFrame({ frame, children, className = '' }) {
  const fc = frameClass(frame)
  if (!fc) return children
  return <span className={`avatar-frame ${fc} ${className}`.trim()}>{children}</span>
}
