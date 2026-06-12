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
// Périls (organes 6-8) reportés → effectif fonctionnel borné à 5.
export const MAX_FUNCTIONAL_TIER = 5

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

// ── Lancement public (teaser) ────────────────────────────────────────
// Date d'ouverture du mode au grand public. SOURCE DE VÉRITÉ pour le
// compte à rebours du teaser (bannière hub + page /le-raid).
// Lundi 15 juin 2026, 8h00 (Europe/Paris, CEST = UTC+2).
export const RAID_LAUNCH_AT = '2026-06-15T08:00:00+02:00'
export const isRaidLaunched = (now = new Date()) =>
  now.getTime() >= new Date(RAID_LAUNCH_AT).getTime()

// Niveau (semaine) du boss : 1 toute la semaine 1, 2 la semaine 2, … Ancré sur
// l'instant absolu RAID_LAUNCH_AT → insensible au changement d'heure (DST).
export const RAID_LAUNCH_MS = new Date(RAID_LAUNCH_AT).getTime()
export const WEEK_MS = 7 * 24 * 3600 * 1000
export function currentRaidLevel(now = new Date()) {
  const t = now instanceof Date ? now.getTime() : Number(now)
  return Math.max(1, Math.floor((t - RAID_LAUNCH_MS) / WEEK_MS) + 1)
}

// ── Fenêtres d'ouverture publique du raid (heure locale) ─────────────
// Deux créneaux quotidiens : le matin et le midi. SOURCE DE VÉRITÉ UNIQUE —
// l'affichage joueur s'y réfère, et (itération 3) le cron d'ouverture publique
// devra ouvrir/fermer les arènes sur ces mêmes plages. En phase test admin,
// « Ouvrir une arène de test » continue de bypasser ces fenêtres.
export const RAID_WINDOWS = [
  { label: 'matin', start: '08:30', end: '10:30' },
  { label: 'midi',  start: '12:00', end: '14:00' },
]

// Formate « 08:30 » → « 8h30 », « 12:00 » → « 12h ».
const fmtHM = (hm) => {
  const [h, m] = hm.split(':')
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`
}
// Phrase prête à afficher : « 8h30–10h30 et 12h–14h ».
export const raidWindowsText = () =>
  RAID_WINDOWS.map(w => `${fmtHM(w.start)}–${fmtHM(w.end)}`).join(' et ')

// Vrai si l'instant donné (Date) tombe dans l'un des créneaux (heure locale).
// Base pour l'enforcement futur (cron de spawn) ; non bloquant côté client.
export function isWithinRaidWindow(date = new Date()) {
  const mins = date.getHours() * 60 + date.getMinutes()
  const toMin = (hm) => { const [h, m] = hm.split(':'); return Number(h) * 60 + Number(m) }
  return RAID_WINDOWS.some(w => mins >= toMin(w.start) && mins < toMin(w.end))
}

// Renvoie la liste des organes (clés) pour un effectif donné (borné 3..5).
export function getOrgansForTier(playerCount) {
  const t = Math.max(MIN_PLAYERS, Math.min(MAX_FUNCTIONAL_TIER, playerCount || MIN_PLAYERS))
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

// ── Escalade hebdomadaire (mirror serveur supabase/functions/raid) ───
// Leviers sans nouvelle mécanique client. grid_band = [min,max] taux de réussite.
export const LEVEL_LADDER = [
  { assault_count: 3, min_players: 3, lives: 3, timer_seconds: 300, difficulties: ['facile', 'moyen'], grid_band: [0.70, 0.90] },
  { assault_count: 3, min_players: 3, lives: 2, timer_seconds: 270, difficulties: ['facile', 'moyen'], grid_band: [0.60, 0.85] },
  { assault_count: 4, min_players: 4, lives: 2, timer_seconds: 330, difficulties: ['moyen'], grid_band: [0.55, 0.80] },
  { assault_count: 5, min_players: 4, lives: 2, timer_seconds: 390, difficulties: ['moyen', 'difficile'], grid_band: [0.45, 0.75] },
  { assault_count: 6, min_players: 5, lives: 1, timer_seconds: 420, difficulties: ['moyen', 'difficile'], grid_band: [0.35, 0.70] },
]
export function difficultyForLevel(level) {
  const i = Math.min(Math.max(1, level || 1), LEVEL_LADDER.length) - 1
  return LEVEL_LADDER[i]
}
// Boss d'un niveau : skin (cycle sur BOSSES) + difficulté du palier.
export function bossForLevel(level) {
  const skin = BOSSES[(Math.max(1, level || 1) - 1) % BOSSES.length]
  return { ...skin, level, ...difficultyForLevel(level) }
}

// Prochain début de créneau (heure locale ~ Paris) — pour le compte à rebours.
export function nextRaidWindowStart(now = new Date()) {
  const candidates = []
  for (let d = 0; d <= 1; d++) {
    for (const w of RAID_WINDOWS) {
      const [h, m] = w.start.split(':').map(Number)
      const dt = new Date(now)
      dt.setDate(dt.getDate() + d); dt.setHours(h, m, 0, 0)
      candidates.push(dt)
    }
  }
  return candidates.find(dt => dt.getTime() > now.getTime()) || candidates[0]
}
