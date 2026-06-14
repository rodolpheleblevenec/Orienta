// ─────────────────────────────────────────────────────────────────────────────
// CLIPS VIDÉO / poster du boss RAID (dans /public/raid/clips/<boss>/).
//
// Rendu 100 % universel (image + vidéo HTML), HORS WebGL → marche sur TOUS les
// appareils, sans perte de contexte GPU. C'est l'approche retenue pour fiabiliser
// le boss après les soucis de WebGL. Le combat (flash, secousse, salves de rôles,
// ondes du boss) reste géré par le compositeur (RaidMonster.jsx + RaidStrikes).
//
// Par boss, on peut fournir (tous optionnels, ajout progressif) :
//   poster : image fixe — affichée tout de suite et en secours (le minimum vital,
//            un simple screenshot du modèle suffit → boss fiable immédiatement).
//   idle   : boucle vidéo « le boss vit » (nage). MP4 H.264 recommandé (lisible
//            partout, iOS inclus) ; WebM possible.
//   attack : clip joué UNE fois sur la contre-attaque du boss (par-dessus l'idle).
//
// Dépose les fichiers puis décommente l'entrée. Tant qu'un boss n'a pas d'entrée,
// l'aiguilleur retombe sur la scène 3D/2D.
// ─────────────────────────────────────────────────────────────────────────────

export const RAID_CLIPS = {
  rorqual: {
    poster: '/raid/clips/rorqual/poster.webp',
    // Décommente ces deux lignes dès que les vidéos existent (rendu animé) :
    // idle:   '/raid/clips/rorqual/idle.mp4',
    // attack: '/raid/clips/rorqual/attack.mp4',
  },
}

export const getRaidClips = (bossKey) => RAID_CLIPS[bossKey] || null
