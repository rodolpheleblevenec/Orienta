// Cosmétiques de la boutique jetons — table de correspondance value → rendu.
// Les `value` stockés en base (orienta_shop_items.payload.value, et les colonnes
// orienta_users.equipped_*) pilotent l'affichage. Source de vérité visuelle côté
// front (miroir conceptuel de marineItems.jsx pour les skins).

// Cadres d'avatar : la value pointe vers une classe CSS (anneau + décor autour de l'avatar).
export const FRAMES = {
  gold:   { className: 'avatar-frame--gold',   label: 'Cadre or' },
  reef:   { className: 'avatar-frame--reef',   label: 'Cadre récif' },
  laurel: { className: 'avatar-frame--laurel', label: 'Cadre laurier' },
  crown:  { className: 'avatar-frame--crown',  label: 'Cadre couronne' },
}

export function frameClass(value) {
  return value && FRAMES[value] ? FRAMES[value].className : ''
}

// Libellé court d'un slot (pour la boutique).
export const SLOT_LABEL = {
  frame: 'Cadre',
  color: 'Couleur',
  title: 'Titre',
  victory: 'Victoire',
}

// Libellé d'une famille d'articles.
export const FAMILY_LABEL = {
  cosmetic: 'Cosmétiques',
  convenience: 'Confort',
  social: 'Social',
}
