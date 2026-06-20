// Journal des nouveautés — affiché dans Profil → onglet « Nouveauté ».
//
// CONVENTION (voir CLAUDE.md) : à chaque feature utilisateur impactante, AJOUTE
// une entrée EN TÊTE de ce tableau (plus récent en premier), avec :
//   - date  : 'AAAA-MM-JJ' (date de mise en ligne)
//   - emoji : un emoji d'illustration
//   - title : titre court, orienté joueur
//   - items : 1 à 6 puces décrivant ce qui change pour le joueur
//
// Historique reconstitué depuis le lancement (27 mai 2026) à partir du journal du projet.
//
// PROGRAMMATION : une entrée dont la `date` est dans le futur reste MASQUÉE jusqu'à
// ce jour-là (filtrage côté Profil). Pratique pour pré-annoncer une feature qui sort
// plus tard (ex. le mode RAID, public à partir du 15 juin 2026).
export const CHANGELOG = [
  {
    date: '2026-06-20',
    emoji: '📲',
    title: 'Orienta comme une appli sur votre iPhone',
    items: [
      'Sur iPhone et iPad (Safari), un petit guide vous explique comment ajouter Orienta à votre écran d\'accueil.',
      'Une fois ajouté, le jeu s\'ouvre en plein écran avec sa propre icône, comme une vraie application.',
      'Plus besoin de retaper l\'adresse : un appui sur l\'icône et vous y êtes.',
    ],
  },
  {
    date: '2026-06-16',
    emoji: '💭',
    title: 'Chat général de l\'app',
    items: [
      'Une bulle de discussion en bas à gauche de l\'écran, sur ordinateur comme sur mobile : ouvre-la pour discuter avec toute la communauté.',
      'C\'est le canal d\'organisation : proposez-vous des parties, donnez-vous rendez-vous, lancez un RAID.',
      'C\'est le même fil que dans la salle d\'attente du RAID : les deux sont reliés.',
      'Les messages sont éphémères : ils disparaissent au bout de 10 minutes.',
    ],
  },
  {
    date: '2026-06-16',
    emoji: '🤝',
    title: 'Lancez un RAID en invitant les joueurs en ligne',
    items: [
      'Depuis la bulle « En ligne », le bouton « Jouez ensemble » invite tous les joueurs connectés d\'un seul clic.',
      'Ceux que tu invites reçoivent aussitôt une invitation à l\'écran : un clic et ils te rejoignent dans le SAS.',
      'Le tchat de coordination garde maintenant les messages des 10 dernières minutes : si tu rejoins ou recharges, tu retrouves la conversation en cours.',
    ],
  },
  {
    date: '2026-06-16',
    emoji: '💬',
    title: 'Le fil « Ça papote » sur l\'accueil',
    items: [
      'Sur ordinateur, juste sous la bulle des joueurs en ligne, découvre les derniers commentaires laissés sur les grilles.',
      'Pour chaque message : qui l\'a écrit, ce qu\'il a dit, et sur quelle grille.',
      'Un clic t\'emmène droit à la grille concernée — surlignée si elle est déjà à l\'écran.',
    ],
  },
  {
    date: '2026-06-15',
    emoji: '⚔️',
    title: 'Mode RAID coopératif',
    items: [
      'Affrontez le Boss d\'Équipage à plusieurs, en temps réel : voyez-le encaisser vos coups, s\'enrager, puis sombrer quand il tombe.',
      'Chacun son rôle et ses propres informations : communiquez pour coordonner vos coups.',
      'Victoire fêtée en grand : confettis, équipage en liesse, récap, temps de clear, et la jauge de la communauté qui grimpe grâce à votre XP collectif.',
      'Battez le record de la semaine : les équipages les plus rapides sont mis à l\'honneur.',
      'Dès la salle d\'attente : le record à battre et le mur des équipages qui ont tenté leur chance.',
      'Disponible à toute heure : dès que vous êtes assez nombreux, l\'arène s\'ouvre — à plusieurs, en équipe.',
    ],
  },
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
    date: '2026-06-12',
    emoji: '🎯',
    title: 'Quêtes quotidiennes, combo & nouveaux niveaux',
    items: [
      'Quêtes du jour et de la semaine qui rapportent des jetons.',
      'Combo de session : enchaîne les réussites pour multiplier ton XP.',
      'Niveaux étendus et nouveaux compagnons à débloquer.',
      'Possibilité de donner un titre à tes grilles.',
    ],
  },
  {
    date: '2026-06-11',
    emoji: '🃏',
    title: 'Pool de mots — plus de variété',
    items: [
      'Les cartes des grilles sont désormais composées à la volée depuis un grand pool de mots.',
      'Des centaines de nouveaux mots ajoutés pour des grilles plus variées.',
    ],
  },
  {
    date: '2026-06-06',
    emoji: '🏆',
    title: 'La grille du jour devient communautaire',
    items: [
      'Le 1er du classement du jour gagne le droit de créer la grille du jour, 3 jours plus tard.',
      'Le nom du créateur est affiché sur la grille du jour.',
      'Une réserve de grilles de secours évite les jours sans défi.',
    ],
  },
  {
    date: '2026-06-04',
    emoji: '📊',
    title: 'Tableau de bord du jour',
    items: [
      'Après avoir terminé la grille du jour, accède à ses statistiques : participants, taux de réussite, meilleurs scores.',
      'Parties et scores fiabilisés pour un classement plus juste.',
    ],
  },
  {
    date: '2026-06-03',
    emoji: '🎨',
    title: 'Refonte visuelle (v2)',
    items: [
      'Nouveau design de toute l\'interface : hub, jeu, profil et classement.',
      'Affichage mobile peaufiné de bout en bout.',
    ],
  },
  {
    date: '2026-06-01',
    emoji: '📱',
    title: 'Mobile & grille du jour automatique',
    items: [
      'Le jeu et la création de grille s\'adaptent désormais au mobile.',
      'Une nouvelle grille du jour est générée automatiquement chaque matin.',
    ],
  },
  {
    date: '2026-05-31',
    emoji: '⚖️',
    title: 'Équilibrage de la progression',
    items: [
      'Paliers d\'XP harmonisés entre progression individuelle, collective et bestiaire.',
      'La progression collective demande plus d\'efforts à toute la communauté.',
    ],
  },
  {
    date: '2026-05-27',
    emoji: '🌊',
    title: 'Lancement d\'Orienta',
    items: [
      'Le jeu de placement quotidien : tourne et place les 4 cartes selon les indices, en 3 essais.',
      'Profil & bestiaire : débloque des compagnons marins en gagnant de l\'XP.',
      'Niveaux individuels et progression collective de la communauté.',
      'Rejoue tes parties et fête tes victoires avec des confettis.',
    ],
  },
]

// Entrées effectivement affichées : on masque celles dont la date est dans le futur
// (annonces pré-programmées), plus récent en premier.
export function visibleChangelog() {
  const today = new Date().toLocaleDateString('en-CA') // 'AAAA-MM-JJ' local
  return CHANGELOG.filter(e => e.date <= today)
}
