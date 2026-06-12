const EmojiComponent = ({ emoji, size = 40 }) => (
  <div style={{ fontSize: size, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {emoji}
  </div>
)

export const MARINE_ITEMS = [
  { level: 1,  xpThreshold: 0,    name: '🌊 Vague',    Component: ({ size }) => <EmojiComponent emoji="🌊" size={size} /> },
  { level: 2,  xpThreshold: 50,   name: '🐚 Coquille', Component: ({ size }) => <EmojiComponent emoji="🐚" size={size} /> },
  { level: 3,  xpThreshold: 130,  name: '🚤 Navire',   Component: ({ size }) => <EmojiComponent emoji="🚤" size={size} /> },
  { level: 4,  xpThreshold: 260,  name: '⚓ Ancre',    Component: ({ size }) => <EmojiComponent emoji="⚓" size={size} /> },
  { level: 5,  xpThreshold: 500,  name: '🧭 Compas',   Component: ({ size }) => <EmojiComponent emoji="🧭" size={size} /> },
  { level: 6,  xpThreshold: 900,  name: '🐬 Dauphin',  Component: ({ size }) => <EmojiComponent emoji="🐬" size={size} /> },
  { level: 7,  xpThreshold: 1600, name: '💎 Trésor',   Component: ({ size }) => <EmojiComponent emoji="💎" size={size} /> },
  { level: 8,  xpThreshold: 2800, name: '👑 Couronne',  Component: ({ size }) => <EmojiComponent emoji="👑" size={size} /> },
  { level: 9,  xpThreshold: 4800, name: '🌟 Étoile',   Component: ({ size }) => <EmojiComponent emoji="🌟" size={size} /> },
  { level: 10, xpThreshold: 8000, name: '🏆 Légende',  Component: ({ size }) => <EmojiComponent emoji="🏆" size={size} /> },
  { level: 11, xpThreshold: 13000, name: '🔮 Oracle',  Component: ({ size }) => <EmojiComponent emoji="🔮" size={size} /> },
  { level: 12, xpThreshold: 21000, name: '⚡ Foudre',  Component: ({ size }) => <EmojiComponent emoji="⚡" size={size} /> },
  { level: 13, xpThreshold: 33000, name: '💠 Cristal', Component: ({ size }) => <EmojiComponent emoji="💠" size={size} /> },
  { level: 14, xpThreshold: 52000, name: '🌞 Soleil',  Component: ({ size }) => <EmojiComponent emoji="🌞" size={size} /> },
  { level: 15, xpThreshold: 80000, name: '✨ Aura',    Component: ({ size }) => <EmojiComponent emoji="✨" size={size} /> },
]

export function getMarineItem(level) {
  return MARINE_ITEMS.find(m => m.level === level) ?? MARINE_ITEMS[0]
}
