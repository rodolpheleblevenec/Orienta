const EmojiCreature = ({ emoji, size = 40, ...props }) => (
  <span {...props} style={{ fontSize: size, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    {emoji}
  </span>
)

export const CREATURES = [
  { level: 1, name: 'Naissance', emoji: '🐣', Component: (props) => <EmojiCreature emoji="🐣" {...props} /> },
  { level: 2, name: 'Alevin', emoji: '🐟', Component: (props) => <EmojiCreature emoji="🐟" {...props} /> },
  { level: 3, name: 'Banc', emoji: '🐠', Component: (props) => <EmojiCreature emoji="🐠" {...props} /> },
  { level: 4, name: 'Explorateur', emoji: '🔭', Component: (props) => <EmojiCreature emoji="🔭" {...props} /> },
  { level: 5, name: 'Voyageur', emoji: '🗺️', Component: (props) => <EmojiCreature emoji="🗺️" {...props} /> },
  { level: 6, name: 'Chasseur', emoji: '🦈', Component: (props) => <EmojiCreature emoji="🦈" {...props} /> },
  { level: 7, name: 'Sage', emoji: '🐢', Component: (props) => <EmojiCreature emoji="🐢" {...props} /> },
  { level: 8, name: 'Légende', emoji: '🐋', Component: (props) => <EmojiCreature emoji="🐋" {...props} /> },
  { level: 9, name: 'Titan', emoji: '🦑', Component: (props) => <EmojiCreature emoji="🦑" {...props} /> },
  { level: 10, name: 'Immortel', emoji: '🐉', Component: (props) => <EmojiCreature emoji="🐉" {...props} /> },
  { level: 11, name: 'Mythe',   emoji: '🪼',  Component: (props) => <EmojiCreature emoji="🪼" {...props} /> },
  { level: 12, name: 'Kraken',  emoji: '🐙',  Component: (props) => <EmojiCreature emoji="🐙" {...props} /> },
  { level: 13, name: 'Sirène',  emoji: '🧜‍♀️', Component: (props) => <EmojiCreature emoji="🧜‍♀️" {...props} /> },
  { level: 14, name: 'Tempête', emoji: '🌀',  Component: (props) => <EmojiCreature emoji="🌀" {...props} /> },
  { level: 15, name: 'Trident', emoji: '🔱',  Component: (props) => <EmojiCreature emoji="🔱" {...props} /> },
  { level: 16, name: 'Volcan',  emoji: '🌋',  Component: (props) => <EmojiCreature emoji="🌋" {...props} /> },
  { level: 17, name: 'Comète',  emoji: '☄️',  Component: (props) => <EmojiCreature emoji="☄️" {...props} /> },
  { level: 18, name: 'Planète', emoji: '🪐',  Component: (props) => <EmojiCreature emoji="🪐" {...props} /> },
  { level: 19, name: 'Galaxie', emoji: '🌌',  Component: (props) => <EmojiCreature emoji="🌌" {...props} /> },
  { level: 20, name: 'Cosmos',  emoji: '🌠',  Component: (props) => <EmojiCreature emoji="🌠" {...props} /> },
]

export function getCreature(level) {
  return CREATURES.find(c => c.level === level) ?? CREATURES[0]
}
