export const CARD_COLORS = [
  { id: 'green',  bg: '#ffffff', border: '#16a085', text: '#16a085' },
  { id: 'coral',  bg: '#ffffff', border: '#f2603f', text: '#f2603f' },
  { id: 'orange', bg: '#ffffff', border: '#e8920e', text: '#e8920e' },
  { id: 'blue',   bg: '#ffffff', border: '#2f6fd6', text: '#2f6fd6' },
  { id: 'violet', bg: '#ffffff', border: '#7030E0', text: '#7030E0' },
]

export function getCardColor(colorIndex) {
  return CARD_COLORS[(colorIndex ?? 0) % CARD_COLORS.length]
}
