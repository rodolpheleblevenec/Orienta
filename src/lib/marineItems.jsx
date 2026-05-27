const Buoy = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" {...props}>
    <circle cx="20" cy="12" r="6" fill="#FF6B6B" stroke="#E74C3C" strokeWidth="1.5"/>
    <rect x="18" y="18" width="4" height="14" fill="#8B4513" stroke="#654321" strokeWidth="1"/>
    <path d="M14 20 Q20 22 26 20" fill="none" stroke="#00B899" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const Lighthouse = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" {...props}>
    <rect x="16" y="14" width="8" height="20" fill="#FFFFFF" stroke="#333" strokeWidth="1.5"/>
    <polygon points="18,12 22,8 26,12" fill="#FF6B6B" stroke="#E74C3C" strokeWidth="1.5"/>
    <circle cx="20" cy="10" r="2" fill="#FFD700" stroke="#FFA500" strokeWidth="1"/>
    <line x1="14" y1="34" x2="26" y2="34" stroke="#8B4513" strokeWidth="1.5"/>
  </svg>
)

const Sailboat = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" {...props}>
    <path d="M12 28 L28 28 L26 16 L14 18 Z" fill="#FFF" stroke="#0066CC" strokeWidth="1.5"/>
    <path d="M20 28 L22 12 L20 10 Z" fill="#FFA500" stroke="#FF8C00" strokeWidth="1.5"/>
    <line x1="10" y1="28" x2="30" y2="28" stroke="#333" strokeWidth="2"/>
  </svg>
)

const Anchor = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" {...props}>
    <circle cx="20" cy="10" r="3" fill="#666" stroke="#333" strokeWidth="1"/>
    <line x1="20" y1="13" x2="20" y2="26" stroke="#999" strokeWidth="2"/>
    <path d="M14 26 Q20 28 26 26" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
    <path d="M14 26 L12 32 M26 26 L28 32" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const Shell = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" {...props}>
    <path d="M20 8 Q16 14 16 20 Q16 28 20 32 Q24 28 24 20 Q24 14 20 8" fill="#F4A460" stroke="#CD853F" strokeWidth="1.5"/>
    <line x1="18" y1="12" x2="18" y2="28" stroke="#DEB887" strokeWidth="1" opacity="0.6"/>
    <line x1="20" y1="10" x2="20" y2="30" stroke="#DEB887" strokeWidth="1" opacity="0.6"/>
    <line x1="22" y1="12" x2="22" y2="28" stroke="#DEB887" strokeWidth="1" opacity="0.6"/>
  </svg>
)

const Treasure = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" {...props}>
    <rect x="10" y="16" width="20" height="14" fill="#8B6914" stroke="#654321" strokeWidth="1.5" rx="2"/>
    <rect x="10" y="14" width="20" height="4" fill="#A0826D" stroke="#654321" strokeWidth="1.5" rx="1"/>
    <circle cx="16" cy="22" r="2" fill="#FFD700" stroke="#FFA500" strokeWidth="0.5"/>
    <circle cx="20" cy="22" r="2" fill="#FFD700" stroke="#FFA500" strokeWidth="0.5"/>
    <circle cx="24" cy="22" r="2" fill="#FFD700" stroke="#FFA500" strokeWidth="0.5"/>
  </svg>
)

const Wave = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" {...props}>
    <path d="M8 22 Q12 18 16 22 T24 22 T32 22" fill="none" stroke="#00B899" strokeWidth="2" strokeLinecap="round"/>
    <path d="M6 28 Q10 24 14 28 T22 28 T30 28" fill="none" stroke="#00D9B8" strokeWidth="2" strokeLinecap="round"/>
    <path d="M10 34 Q14 32 18 34 T26 34 T34 34" fill="none" stroke="#7FD8BE" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const Pearl = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" {...props}>
    <circle cx="20" cy="20" r="10" fill="#F8F8FF" stroke="#E0E0E0" strokeWidth="1.5"/>
    <circle cx="17" cy="17" r="3" fill="#FFF" opacity="0.7"/>
    <path d="M22 26 Q20 28 18 26" fill="none" stroke="#FFB6C1" strokeWidth="1" opacity="0.5"/>
  </svg>
)

const Dolphin = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" {...props}>
    <ellipse cx="20" cy="20" rx="10" ry="7" fill="#0099CC" stroke="#0066AA" strokeWidth="1.5"/>
    <path d="M28 18 L34 16 L28 22 Z" fill="#0099CC"/>
    <path d="M15 16 L12 10 L16 14 Z" fill="#0099CC"/>
    <circle cx="26" cy="19" r="1.5" fill="#333"/>
  </svg>
)

const Compass = ({ size = 40, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" {...props}>
    <circle cx="20" cy="20" r="10" fill="#FFF" stroke="#333" strokeWidth="1.5"/>
    <path d="M20 12 L23 20 L20 26 L17 20 Z" fill="#FF6B6B" stroke="#E74C3C" strokeWidth="1"/>
    <path d="M28 20 L20 23 L12 20 L20 17 Z" fill="#00B899" stroke="#009977" strokeWidth="1" opacity="0.7"/>
    <circle cx="20" cy="20" r="2" fill="#333"/>
  </svg>
)

export const MARINE_ITEMS = [
  { level: 1, name: 'Buée', Component: Buoy },
  { level: 2, name: 'Phare', Component: Lighthouse },
  { level: 3, name: 'Voilier', Component: Sailboat },
  { level: 4, name: 'Ancre', Component: Anchor },
  { level: 5, name: 'Coquille', Component: Shell },
  { level: 6, name: 'Trésor', Component: Treasure },
  { level: 7, name: 'Vague', Component: Wave },
  { level: 8, name: 'Perle', Component: Pearl },
  { level: 9, name: 'Dauphin', Component: Dolphin },
  { level: 10, name: 'Compas', Component: Compass },
]

export function getMarineItem(level) {
  return MARINE_ITEMS.find(m => m.level === level) ?? MARINE_ITEMS[0]
}
