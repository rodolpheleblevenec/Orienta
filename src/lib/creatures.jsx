const EmojiCreature = ({ emoji, size = 40, ...props }) => (
  <span {...props} style={{ fontSize: size, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    {emoji}
  </span>
)

const CREATURES = [
  { level: 1, name: 'Naissance', emoji: '🥚', Component: (props) => <EmojiCreature emoji="🥚" {...props} /> },
  { level: 2, name: 'Alevin', emoji: '🐟', Component: (props) => <EmojiCreature emoji="🐟" {...props} /> },
  { level: 3, name: 'Banc', emoji: '🐠', Component: (props) => <EmojiCreature emoji="🐠" {...props} /> },
  { level: 4, name: 'Explorateur', emoji: '🔭', Component: (props) => <EmojiCreature emoji="🔭" {...props} /> },
  { level: 5, name: 'Voyageur', emoji: '🗺️', Component: (props) => <EmojiCreature emoji="🗺️" {...props} /> },
  { level: 6, name: 'Chasseur', emoji: '🦈', Component: (props) => <EmojiCreature emoji="🦈" {...props} /> },
  { level: 7, name: 'Sage', emoji: '🐢', Component: (props) => <EmojiCreature emoji="🐢" {...props} /> },
  { level: 8, name: 'Légende', emoji: '🐋', Component: (props) => <EmojiCreature emoji="🐋" {...props} /> },
  { level: 9, name: 'Titan', emoji: '🦑', Component: (props) => <EmojiCreature emoji="🦑" {...props} /> },
  { level: 10, name: 'Immortel', emoji: '🐉', Component: (props) => <EmojiCreature emoji="🐉" {...props} /> },
]

export function getCreature(level) {
  return CREATURES.find(c => c.level === level) ?? CREATURES[0]
}
