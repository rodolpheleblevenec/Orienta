// Journal des nouveautés — affiché dans Profil → onglet « Nouveauté ».
//
// CONVENTION (voir CLAUDE.md) : à chaque feature utilisateur impactante, AJOUTE
// une entrée EN TÊTE de ce tableau (plus récent en premier), avec :
//   - date  : 'AAAA-MM-JJ' (date de mise en ligne)
//   - emoji : un emoji d'illustration
//   - title : titre court
//   - items : 1 à 6 puces décrivant ce qui change pour le joueur
export const CHANGELOG = [
  {
    date: '2026-06-12',
    emoji: '🪙',
    title: 'Boutique, roue de la fortune & vitrine en ligne',
    items: [
      'Nouvelle page Quêtes & Boutique, accessible via la pastille 🪙 du header.',
      'Cadres d\'avatar (laurier, couronne, or, récif), couleur de pseudo et statut perso.',
      'La bulle « En ligne » devient la vitrine de tes cosmétiques, vue par tous.',
      'Roue de la fortune : tente ta chance pour des jetons et des lots rares.',
      'Classement enrichi : avatar, cadre, série, jetons et niveau à côté du pseudo.',
      'Jeton de renommage pour changer ton pseudo, et thèmes d\'interface.',
    ],
  },
  {
    date: '2026-06-11',
    emoji: '⚔️',
    title: 'Quêtes quotidiennes, combo & mode RAID',
    items: [
      'Quêtes du jour et de la semaine qui rapportent des jetons.',
      'Combo de session : enchaîne les réussites pour multiplier ton XP.',
      'Mode RAID coopératif : affrontez le Boss d\'Équipage en temps réel.',
      'Niveaux étendus et nouveaux compagnons à débloquer.',
    ],
  },
]
