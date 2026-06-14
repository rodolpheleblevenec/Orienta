// ─────────────────────────────────────────────────────────────────────────────
// Style d'effet de combat par rôle (PUREMENT cosmétique).
//
// ⚠️ Volontairement SÉPARÉ d'ORGANS (src/lib/raid.js) : ORGANS est mirroré côté
// serveur (anti-triche) et ne doit pas être pollué de champs visuels. Ici, on ne
// décrit que l'apparence de l'attaque que chaque rôle projette vers le boss.
//
// hue  : teinte de l'effet (couleur propre au rôle, cohérente avec sa carte).
// kind : forme de l'effet — 'beam' (trait d'énergie) | 'bolt' (projectile) |
//        'pulse' (onde/sonar) | 'slash' (entaille).
// Les clés correspondent à celles d'ORGANS.
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE_FX = {
  oeil:        { hue: 192, kind: 'beam'  },
  vigie:       { hue: 200, kind: 'beam'  },
  cartographe: { hue: 268, kind: 'pulse' },
  navigateur:  { hue: 174, kind: 'pulse' },
  main:        { hue: 22,  kind: 'slash' },
  capitaine:   { hue: 145, kind: 'slash' },
  timonier:    { hue: 210, kind: 'bolt'  },
  mecanicien:  { hue: 40,  kind: 'bolt'  },
  sonar:       { hue: 188, kind: 'pulse' },
  horloger:    { hue: 52,  kind: 'bolt'  },
}

export const fxForRole = (role) => ROLE_FX[role] || { hue: 205, kind: 'bolt' }
