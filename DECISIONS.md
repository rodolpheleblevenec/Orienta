# DECISIONS.md — Orienta

Décisions architecturales et produit non-évidentes, avec leurs trade-offs.

---

## 2026-05-27 — Pseudo-only authentication (no Supabase Auth)

**Décision** : Identité = pseudo (username) stocké en `localStorage` comme UUID. Pas de mot de passe, email, ni OAuth.

**Pourquoi** : Jeu casual, friction zéro à l'entrée. Un utilisateur qui revient retape son pseudo et reprend là où il était.

**Trade-offs** :
- Pas de récupération de compte si localStorage effacé
- Lookup pseudo case-sensitive : "Alice" et "alice" créent deux comptes différents
- Pas de contrôle d'accès réel (RLS désactivé)
- Acceptable pour un jeu public sans données sensibles

**Réviser si** : Fonctionnalités payantes, grilles privées, identité sociale.

---

## 2026-05-27 — RLS désactivé en développement

**Décision** : Row Level Security off sur toutes les tables `orienta_*`.

**Pourquoi** : Vitesse d'itération. Les policies nécessitent de connaître le modèle auth final.

**Risque** : La clé anon est exposée côté client. N'importe quel user peut lire/modifier n'importe quelle ligne.

**Mitigation** : Les mutations XP passent par un RPC server-side. Acceptable pour un jeu public à ce stade.

**Must fix avant** : Tout lancement public, fonctionnalité payante, ou données privées.

---

## 2026-05-27 — Double progression XP (collectif + individuel, strictement séparés)

**Décision** : Deux tracks XP indépendants :
- **Collectif** (`orienta_collective_progress.total_xp`) → créatures emoji partagées
- **Individuel** (`orienta_users.xp`) → skins marins personnels

**Pourquoi** : Encourage la contribution communautaire (jauge collective) ET la progression personnelle. Séparer les tracks évite la confusion "j'ai débloqué pour tout le monde vs. pour moi".

**Règle de déblocage** : Un skin est disponible si `user.level >= item.level` **OU** `collectiveLevel >= item.level` (cadeau communautaire).

---

## 2026-05-27 — `add_user_xp` RPC pour toutes les mutations XP

**Décision** : Jamais de `UPDATE orienta_users SET xp = ...` direct. Toujours via `supabase.rpc('add_user_xp', { uid, amount })`.

**Pourquoi** : Le RPC met à jour atomiquement `xp`, `level`, `xp_contributed` et `orienta_collective_progress.total_xp` en une transaction. Côté client ce serait 4 requêtes avec race conditions.

---

## 2026-05-27 — Scoring client-side, commit XP server-side

**Décision** : `computeScore()`, `computeXp()`, `xpStreakBonus()` s'exécutent côté client. Le `amount` résultant est envoyé au RPC.

**Pourquoi** : Le score est déjà calculé client-side pour la page résultat. Recalculer server-side nécessiterait d'envoyer tout l'état de la partie.

**Risque** : Un joueur pourrait appeler le RPC avec un montant gonflé. Non prioritaire pour un jeu casual.

**Note** : `evaluateAttempt()` dans `scoring.js` est du **code mort** — l'évaluation réelle des essais se passe dans l'Edge Function `check-attempt`. Ne pas utiliser `evaluateAttempt()` côté client pour des calculs de score.

---

## 2026-05-27 — CSS vanilla, pas de framework

**Décision** : Tous les styles dans `src/index.css` avec CSS custom properties. Pas de Tailwind, pas de CSS-in-JS.

**Pourquoi** : Vocabulaire design étroit et stable. Un seul fichier CSS est plus facile à auditer pour un projet de cette taille.

---

## 2026-05-28 — Cartes : fond blanc + stroke coloré + texte coloré (pas de fill)

**Décision** : Les cartes de jeu ont `background: #ffffff`, `border: 2px solid <couleur>`, et les 4 mots en `color: <couleur>`. Pas de fond coloré.

**Pourquoi** : Meilleure lisibilité, esthétique plus épurée. Le fond coloré entrait en compétition visuelle avec la grille.

**Implémentation** : Centralisé dans `src/lib/cardColors.js` — 5 couleurs vives (teal, orange-rouge, bleu électrique, ambre, violet). `getCardColor(index)` retourne `{ bg, border, text }`. Consommé par `WordCard` et `StaticMiniGrid`.

---

## 2026-05-28 — Orientation des mots dans StaticMiniGrid = même logique que WordCard

**Décision** : `StaticMiniGrid` applique la même formule de counter-rotation que `WordCard` (pas de `writing-mode` CSS).

**Pourquoi** : La grille de feedback doit être lisible de la même façon que la grille principale. Utiliser `writing-mode` en CSS et la rotation JS simultanément causait des conflits.

**Règle** : `physIdx = (originalPos + rotation/90) % 4`. Si `physIdx % 2 === 1` (bord vertical) : `deg = -90 - rotation`. Sinon : `deg = -rotation`.

---

## 2026-05-28 — Persistance des essais en cours via `orienta_play_attempts`

**Décision** : Quand un joueur retourne sur une grille non terminée, `fetchGrid` dans `PlayPage` restaure l'historique des tentatives depuis `orienta_play_attempts`.

**Pourquoi** : Un joueur doit pouvoir interrompre une partie et reprendre à l'essai suivant.

**Implémentation** : Le client insère dans `orienta_play_attempts` après chaque soumission. `fetchGrid` query les tentatives et reconstruit `attemptHistory` + `attemptNumber` + `attemptsFailed`.

**Note** : La `trayCards` est toujours remise à zéro — le joueur doit replacer ses cartes pour le nouvel essai.

---

## 2026-05-28 — Tour guidé via `orienta_users` (colonne booléenne par page)

**Décision** : Les flags de tour (`tour_play_done`, `tour_create_placement_done`, `tour_create_clues_done`) sont stockés dans la table `orienta_users`, pas en localStorage.

**Pourquoi** : Persiste sur tous les appareils du même utilisateur. Un utilisateur qui change de navigateur ne revoit pas le tour.

---

## 2026-05-28 — Forfait de création via localStorage (par user, expirant à minuit)

**Décision** : Si un user abandonne une création chronométrée, on écrit `localStorage.setItem('orienta_create_forfeit_{uid}', DATE_STRING)`. La valeur est comparée à la date du jour ISO. Si égale → bouton "Créer ma grille" désactivé.

**Pourquoi** : Enjeu de la contrainte temps. Pas besoin de stocker en DB — le forfait expire naturellement le lendemain.

---

## 2026-05-28 — Edge function `check-attempt` utilise `SUPABASE_SERVICE_ROLE_KEY`

**Décision** : La fonction edge lit la solution depuis `orienta_grid_cards` avec la service role key, jamais exposée côté client.

**Contexte** : La solution de la grille ne doit pas être accessible au client (triche possible). La fonction ne retourne que les résultats (`correctFull`, `correctRotation`, `neither`, `card_feedbacks`), jamais la solution brute.

**Note partielle correcte** : La fonction compte comme partiellement correct tout placement où `posMatch || rotMatch` (bonne position OU bonne rotation). C'est la définition du jeu — vérifiée et cohérente avec l'UI.

---

## 2026-06-01 — Indices latéraux : double rendu desktop/mobile (CSS switch)

**Décision** : `CloverWithInputs` rend **simultanément** deux éléments pour chaque côté latéral :
- Un `<input>` avec `.clue-lateral--desktop` (visible ≥681px, caché en mobile via `display: none`)
- Un `<button>` avec `.clue-lateral--mobile` (caché en desktop, visible en mobile)

Sur mobile, taper sur le bouton ouvre un overlay centré (`.clue-lateral-editor`) pour la saisie.

**Pourquoi** : L'élément `<input>` est un "replaced element" — `writing-mode: vertical-rl` ne fonctionne pas (la largeur physique reste horizontale). La solution `writing-mode` sur un `<div>` wrapper cassait le layout de la grille CSS. Le pattern bouton+overlay est plus simple à maintenir.

**Trade-off** : Les deux éléments sont toujours dans le DOM. Cost négligeable ici (4 éléments supplémentaires).

---

## 2026-06-01 — Timer `PlayPage` démarre après chargement réseau, pas au mount

**Décision** : `startTimeRef` est initialisé à `null` et assigné à `Date.now()` dans `fetchGrid`, juste après `setTrayCards(shuffled)`.

**Pourquoi** : Le temps de chargement Supabase (typiquement 200–800ms) était facturé au joueur dans le calcul du score. Le timer démarre maintenant quand les cartes sont effectivement visibles.

**Guard** : L'interval du timer vérifie `if (startTimeRef.current)` avant de calculer l'écart — évite un NaN si le composant est rendu avant la fin du fetch.

> ⚠️ **Révisé le 2026-06-06** (voir « Chrono ancré sur `started_at` » plus bas) : le chrono n'est plus calé sur `Date.now()` au chargement mais sur le `started_at` serveur, pour être continu et anti-triche.

---

## 2026-06-06 — Grille du jour communautaire (le gagnant crée la grille de J+3)

**Décision** : La grille du jour n'est plus auto-générée par un seul système. Le **1er du classement** d'un jour J gagne le droit de **créer la grille du jour de J+3**. Une **réserve** de grilles admin (sans date, priorisée) comble les jours sans gagnant ; en dernier recours on **rejoue une grille d'archive** populaire. Un rollover nocturne (`daily-rollover`) orchestre le tout.

**Pourquoi** : Faire vivre la communauté (chaque gagnant contribue) plutôt qu'un unique créateur. Le décalage J+3 laisse au gagnant le temps de composer, et garantit un tampon.

**Modèle de données** : nouveau discriminant **`orienta_grids.daily_status`** (`NULL`=communautaire · `reserve`/`scheduled`/`published`=piste quotidienne) — remplace l'ancien raccourci `daily_date IS NULL`. Table **`orienta_grid_grants`** (droit de créer, idempotent via `UNIQUE(source_grid_id)` + `UNIQUE(target_date)`). `generate-daily-grid` supprimée.

**Trade-offs** :
- Le gagnant est **re-dérivé côté serveur** depuis les scores (fiables), mais l'identité reste falsifiable (pas d'auth) — même limite que la pseudo-auth.
- Réserve vide possible → garde-fous : alerte stock bas + rejeu d'archive (jamais de jour vide).
- Le cron GitHub ne tourne que depuis `master` (branche par défaut).

**Réviser si** : Supabase Auth (sécuriser le claim) ; modération a priori si abus (actuellement publication directe + contrôles structurels).

---

## 2026-06-06 — Chrono ancré sur `started_at` serveur (anti-triche, continu)

**Décision** : Le chrono affiché dans `PlayPage` est calé sur `orienta_plays.started_at` (renvoyé par `start-play`), **pas** sur `Date.now()`. Il est donc **continu** et **ne se remet jamais à zéro** quand le joueur quitte puis revient sur une partie en cours.

**Pourquoi** : Empêcher le « scout-then-return » (repérer la solution, revenir, repartir avec un temps frais). Le **score** était déjà sain (le serveur calcule `elapsed = now − started_at`, jamais reseté) ; seul l'**affichage** repartait de 0 et donnait l'illusion d'une faille. On aligne l'affichage sur la vérité serveur.

**Conséquence** : l'horloge démarre dès la 1ʳᵉ ouverture et tourne en continu → ouvrir la grille « pour voir » engage (coûte du temps). C'est le garde-fou voulu.

**Alternative non retenue** : démarrer le chrono au 1ᵉʳ déplacement de carte (côté serveur) — plus permissif mais plus complexe ; à reconsidérer si l'engagement « à l'ouverture » est jugé trop strict.

**Remplace** : la décision du 2026-06-01 (« Timer démarre après chargement réseau ») — le souci du temps de chargement facturé est résolu autrement (le `started_at` est posé à la création de la partie côté serveur).
