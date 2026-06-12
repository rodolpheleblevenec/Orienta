// Mode RAID — définitions des organes, paliers et bosses.
// ⚠️ La logique de capacités (qui voit / fait quoi) est MIRRORÉE côté serveur
// dans supabase/functions/raid/index.ts (helpers canSee*/can*). Toute évolution
// doit rester synchronisée — le serveur reste l'autorité (anti-triche).

// ── Organes ──────────────────────────────────────────────────────────
// sees   : informations sémantiques visibles (sinon cachées) — 'clues' | 'words' | 'feedback'
// does   : actions exclusives — 'place' | 'rotate' | 'validate' | 'peril:*'
export const ORGANS = {
  oeil:       { key: 'oeil',       label: 'Œil',        emoji: '🔭', sees: ['clues', 'words'], does: [],
                blurb: 'Tu vois les indices ET les mots. Dicte à la Main quoi poser et comment tourner.' },
  main:       { key: 'main',       label: 'Main',       emoji: '✋', sees: [], does: ['place', 'rotate'],
                blurb: 'Tu places et tournes les cartes — mais tu ne vois ni indices ni mots. Suis les consignes.' },
  capitaine:  { key: 'capitaine',  label: 'Capitaine',  emoji: '🧭', sees: ['feedback'], does: ['validate', 'sonar'],
                blurb: 'Toi seul valides l’essai et vois les couleurs. Sonar : sonde 1 carte/assaut pour savoir si elle est parfaite.' },
  // Paliers supérieurs (itérations 2-3) — l’Œil et la Main se scindent, puis les périls.
  vigie:      { key: 'vigie',      label: 'Vigie',      emoji: '👁️', sees: ['clues'], does: [],
                blurb: 'Tu vois les 4 indices. Décris-les à l’équipe.' },
  cartographe:{ key: 'cartographe',label: 'Cartographe',emoji: '📖', sees: ['words'], does: [],
                blurb: 'Tu vois les mots des cartes. Décris-les à l’équipe.' },
  timonier:   { key: 'timonier',   label: 'Timonier',   emoji: '⚓', sees: [], does: ['place'],
                blurb: 'Toi seul déplaces les cartes dans les slots.' },
  mecanicien: { key: 'mecanicien', label: 'Mécanicien', emoji: '⚙️', sees: [], does: ['rotate'],
                blurb: 'Toi seul fais tourner les cartes.' },
  navigateur: { key: 'navigateur', label: 'Navigateur', emoji: '🗺️', sees: ['mapping'], does: ['peril:boussole'],
                blurb: 'La boussole est faussée — toi seul connais la vraie correspondance des slots.' },
  sonar:      { key: 'sonar',      label: 'Sonar',      emoji: '🐚', sees: ['decoy'], does: ['peril:brouillard'],
                blurb: 'Toi seul repères la carte-leurre dans le brouillard.' },
  horloger:   { key: 'horloger',   label: 'Horloger',   emoji: '⏳', sees: [], does: ['peril:derive'],
                blurb: 'Les cartes dérivent — toi seul peux les re-stabiliser.' },
}

// ── Échelle adaptative : autant d'organes que de joueurs (3 → 8) ──────
const LADDER = {
  3: ['oeil', 'main', 'capitaine'],
  4: ['oeil', 'timonier', 'mecanicien', 'capitaine'],
  5: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine'],
  6: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine', 'navigateur'],
  7: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine', 'navigateur', 'sonar'],
  8: ['vigie', 'cartographe', 'timonier', 'mecanicien', 'capitaine', 'navigateur', 'sonar', 'horloger'],
}
export const MIN_PLAYERS = 3
export const MAX_TIER = 8

// ── Accès à la feature (visibilité, phase de test en prod) ───────────
// Le lien RAID n'est visible que pour l'admin ET des comptes testeurs dédiés,
// tant que la feature n'est pas publique. La route /raid reste ouverte par URL ;
// ce gating n'est qu'une visibilité (la vraie sécurité est dans l'Edge Function).
// Comptes testeurs : pseudo « Testeur 1 » … « Testeur 4 » (casse/espace souples).
export const RAID_ADMIN_PSEUDO = 'Rodolphe LE BLEVENEC'
const RAID_TESTER_RE = /^testeur\s*[1-4]$/i

export const isRaidAdmin = (pseudo) => pseudo === RAID_ADMIN_PSEUDO
export function canSeeRaid(pseudo) {
  if (!pseudo) return false
  return pseudo === RAID_ADMIN_PSEUDO || RAID_TESTER_RE.test(pseudo.trim())
}

// Renvoie la liste des organes (clés) pour un effectif donné (borné 3..8).
export function getOrgansForTier(playerCount) {
  const t = Math.max(MIN_PLAYERS, Math.min(MAX_TIER, playerCount || MIN_PLAYERS))
  return LADDER[t]
}

// ── Capacités (mirror serveur) ───────────────────────────────────────
export const canSeeClues    = (role) => ['oeil', 'vigie'].includes(role)
export const canSeeWords    = (role) => ['oeil', 'cartographe'].includes(role)
export const canSeeFeedback = (role) => role === 'capitaine'
export const canPlace       = (role) => ['main', 'timonier'].includes(role)
export const canRotate      = (role) => ['main', 'mecanicien'].includes(role)
export const canValidate    = (role) => role === 'capitaine'

// ── Bosses (roster + progression communautaire) ──────────────────────
// Chaque victoire incrémente collective.boss_index_cleared → boss suivant.
// perilsByTier : périls actifs selon le palier (effectif) — itération 3.
export const BOSSES = [
  { key: 'meduse',     name: 'La Méduse spectrale', emoji: '🪼', assault_count: 3 },
  { key: 'crabe',      name: 'Le Crabe colossal',   emoji: '🦀', assault_count: 3 },
  { key: 'pieuvre',    name: 'La Pieuvre des abysses', emoji: '🐙', assault_count: 3 },
  { key: 'requin',     name: 'Le Requin-marteau',   emoji: '🦈', assault_count: 3 },
  { key: 'leviathan',  name: 'Le Léviathan',        emoji: '🐉', assault_count: 4 },
]

export function getBossOfDay(bossIndexCleared = 0) {
  return BOSSES[(bossIndexCleared || 0) % BOSSES.length]
}

export function getBossByKey(key) {
  return BOSSES.find(b => b.key === key) ?? BOSSES[0]
}
