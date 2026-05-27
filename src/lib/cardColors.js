export const CARD_COLORS = [
  { bg: '#C8EDE7', border: '#8FCFC6' },  // teal clair — ancre sur l'accent #00B899
  { bg: '#FAE0D0', border: '#E8BFA8' },  // corail doux — chaleur
  { bg: '#D0E4FA', border: '#A8C2E8' },  // bleu ciel — fraîcheur
  { bg: '#FAE8C0', border: '#E8CB80' },  // ambre — contraste chaud
  { bg: '#E4D0FA', border: '#C4A8E8' },  // violet lavande — complément
]

export function getCardColor(colorIndex) {
  return CARD_COLORS[(colorIndex ?? 0) % CARD_COLORS.length]
}
