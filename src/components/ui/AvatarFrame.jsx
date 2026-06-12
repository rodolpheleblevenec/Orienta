import { frameClass } from '../../lib/shopCosmetics'

// Enveloppe un avatar avec le cadre cosmétique équipé (anneau autour).
// Sans cadre équipé, ne rend aucun wrapper (l'avatar s'affiche tel quel).
// `square` : anneau aux coins arrondis (avatars carrés des cartes), sinon cercle.
export default function AvatarFrame({ frame, children, className = '', square = false }) {
  const fc = frameClass(frame)
  if (!fc) return children
  return <span className={`avatar-frame${square ? ' avatar-frame--square' : ''} ${fc} ${className}`.trim()}>{children}</span>
}
