// ─────────────────────────────────────────────────────────────────────────────
// Décor (backdrop illustré) de la scène de combat RAID.
//
// Le boss 3D (.glb) est rendu sur un canvas TRANSPARENT (cf. RaidMonster3D), et
// cette image d'arène s'affiche DERRIÈRE lui pour donner une ambiance « épique »
// sans dépendre d'un décor vectoriel codé. Tant qu'aucune image n'est fournie,
// la classe CSS `.raid-backdrop` affiche un dégradé abyssal de secours (la scène
// reste présentable). Déposer les illustrations dans /public/raid/backdrops/
// (WebP recommandé, ~1600×900+).
//
// On pourra mapper un fond différent par boss plus tard (clé = boss_key).
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BACKDROP = '/raid/backdrops/arena.webp'

const BACKDROPS = {
  // rorqual: '/raid/backdrops/rorqual.webp',
}

export const getBackdrop = (bossKey) => BACKDROPS[bossKey] || DEFAULT_BACKDROP
