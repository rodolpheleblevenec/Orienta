export const CARD_COLORS = [
  { bg: '#ffffff', border: '#00A889', text: '#00A889' },  // teal vif
  { bg: '#ffffff', border: '#F0440A', text: '#F0440A' },  // orange-rouge
  { bg: '#ffffff', border: '#1472E8', text: '#1472E8' },  // bleu électrique
  { bg: '#ffffff', border: '#E89010', text: '#E89010' },  // ambre vif
  { bg: '#ffffff', border: '#7030E0', text: '#7030E0' },  // violet intense
]

export function getCardColor(colorIndex) {
  return CARD_COLORS[(colorIndex ?? 0) % CARD_COLORS.length]
}
