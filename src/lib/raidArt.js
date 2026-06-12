// ─────────────────────────────────────────────────────────────────────────────
// Manifeste des illustrations RAID (assets fournis, déposés dans /public/raid/).
// Voir public/raid/README.md pour le cahier des charges + les prompts de génération.
//
// Tant qu'un boss n'a PAS d'entrée ici (ou que son image n'existe pas encore),
// la scène retombe automatiquement sur la créature VECTORIELLE codée
// (RaidMonster2D) — donc tout reste fonctionnel pendant la production des dessins.
//
// Deux formats supportés par boss :
//
//  1) Sprite unique (le plus simple — recommandé pour démarrer) :
//       meduse: { full: '/raid/meduse/full.png', width: 560, height: 540, y: 60 }
//     → respiration + réactions de combat sur la créature entière.
//
//  2) Pièces riggées (articulation fine — pinces qui claquent, etc.) :
//       crabe: {
//         parts: [
//           { src: '/raid/crabe/corps.png',  x: 250, y: 90,  w: 500, anim: 'breathe' },
//           { src: '/raid/crabe/pince-g.png', x: 150, y: 220, w: 220, anim: 'claw', pivotX: 80, pivotY: 100 },
//           { src: '/raid/crabe/pince-d.png', x: 620, y: 220, w: 220, anim: 'claw', pivotX: 20, pivotY: 100, delay: 0.8 },
//         ],
//       }
//     Coordonnées dans le repère de la scène (viewBox 1000 × 600).
//     pivotX/pivotY = point de rotation en % de la pièce (défaut 50/50).
//     anim ∈ 'breathe' | 'claw' | 'sway' | 'tail'  (autres = statique).
//
// Astuce : commence par `full`, puis passe en `parts` plus tard sans rien changer
// d'autre — le rendu bascule tout seul.
// ─────────────────────────────────────────────────────────────────────────────

export const RAID_ART = {
  // meduse:    { full: '/raid/meduse/full.png',    width: 560, height: 540, y: 60 },
  // crabe:     { full: '/raid/crabe/full.png',     width: 580, height: 520, y: 70 },
  // pieuvre:   { full: '/raid/pieuvre/full.png',   width: 560, height: 540, y: 60 },
  // requin:    { full: '/raid/requin/full.png',    width: 640, height: 460, y: 110 },
  // leviathan: { full: '/raid/leviathan/full.png', width: 680, height: 520, y: 70 },
}

export const getRaidArt = (bossKey) => RAID_ART[bossKey] || null
