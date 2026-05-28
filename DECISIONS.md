# DECISIONS.md — Orienta

Décisions architecturales et produit non-évidentes, avec leurs trade-offs.

---

## 2026-05-27 — Pseudo-only authentication (no Supabase Auth)

**Décision** : Identité = pseudo (username) stocké en `localStorage` comme UUID. Pas de mot de passe, email, ni OAuth.

**Pourquoi** : Jeu casual, friction zéro à l'entrée. Un utilisateur qui revient retape son pseudo et reprend là où il était.

**Trade-offs** :
- Pas de récupération de compte si localStorage effacé
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

**Décision** : Quand un joueur retourne sur une grille non terminée, `fetchGrid` restaure l'historique des tentatives depuis `orienta_play_attempts`.

**Pourquoi** : Un joueur doit pouvoir interrompre une partie et reprendre à l'essai suivant. Ne pas persister forçait à recommencer depuis l'essai 1 à chaque retour.

**Implémentation** : Le client insère dans `orienta_play_attempts` après chaque soumission. `fetchGrid` query les tentatives et reconstruit `attemptHistory` + `attemptNumber` + `attemptsFailed`.

**Note** : La `trayCards` est toujours remise à zéro (toutes les cartes dans le plateau) — le joueur doit replacer ses cartes pour le nouvel essai.

---

## 2026-05-28 — Tour guidé via localStorage par user + par page

**Décision** : `TourOverlay` s'affiche une seule fois, clé `orienta_tour_play_{uid}` / `orienta_tour_create_{uid}` dans `localStorage`.

**Pourquoi** : Pas besoin de stocker en DB pour une préférence UI aussi légère. La clé est per-user pour éviter qu'un user sur un appareil partagé voit le tour d'un autre.

---

## 2026-05-28 — Forfait de création via localStorage (par user, expirant à minuit)

**Décision** : Si un user abandonne une création chronométrée, on écrit `localStorage.setItem('orienta_create_forfeit_{uid}', DATE_STRING)`. La valeur est comparée à `new Date().toISOString().split('T')[0]` (date du jour). Si égale → bouton "Créer ma grille" désactivé.

**Pourquoi** : Enjeu de la contrainte temps. Pas besoin de stocker en DB — le forfait expire naturellement le lendemain. Per-user pour ne pas pénaliser d'autres accounts sur le même appareil.

---

## 2026-05-28 — Edge function `check-attempt` utilise les tables `orienta_*`

**Décision** : La fonction edge utilise `orienta_plays`, `orienta_grids`, `orienta_grid_cards`, `orienta_collective_progress`, `orienta_users`.

**Contexte** : La version initiale utilisait les anciens noms (`plays`, `grids`, etc.) qui n'existent plus. Cela causait une 404 à chaque soumission → le client faisait un early return → aucun enregistrement des tentatives → bug de persistance.

**Fix appliqué** : 2026-05-28, version 2 déployée via Supabase MCP.
