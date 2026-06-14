// ─────────────────────────────────────────────────────────────────────────────
// Modèles 3D des boss RAID (.glb dans /public/raid/models/).
//
// Volontairement minimal : un SEUL boss actif — le Rorqual (semaine 1), modèle
// riggé + animé (Fab). Tout autre boss n'a pas d'entrée → l'aiguilleur
// (RaidMonster.jsx) retombe sur la scène 2D. On rebranchera d'autres boss plus tard.
//
// Champs : url, scale (mult.), targetHeight (hauteur cible auto-fit),
//          position [x,y,z], rotationY (radians), draco (true si compressé),
//          clips: { idle: '<nom du clip à jouer en boucle>' }.
// ─────────────────────────────────────────────────────────────────────────────

export const RAID_MODELS = {
  rorqual: {
    url: '/raid/models/orca.glb',
    targetHeight: 3.0,
    position: [0, 0.4, -0.5],
    rotationY: Math.PI / 2, // tourne le rorqual (allongé sur Z) pour le voir de profil
    clips: { idle: 'swim' }, // animations dispo : 'swim' (nage) + 'mouth' (gueule)
  },
}

export const getRaidModel = (bossKey) => RAID_MODELS[bossKey] || null
