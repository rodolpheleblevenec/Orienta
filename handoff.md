# Handoff — 2026-06-04

## Contexte

- **Projet** : Orienta
- **Branche** : `securite-edge-rls` (migration sécurité : écritures sensibles déplacées vers des Edge Functions + RLS, par phases — voir mémoire `project_security_rls.md`)
- **État** : branche **WIP non commitée**. Beaucoup d'Edge Functions sont nouvelles/untracked (`account/`, `admin/`, `create-grid/`, `get-solution/`, `social/`, `start-play/`, `_shared/`) + `src/lib/adminSecret.js`. Plusieurs pages front modifiées en parallèle. **Rien n'est commité ni poussé sur cette branche.**

---

## Travail réalisé (session 2026-06-04 — redirections des notifications)

Objectif : vérifier que **chaque** notification de la cloche 🔔 redirige bien au clic, puis corriger les trous.

- **Audit** de tous les types de notif réellement créés en base, croisé avec les liens du panneau et les routes de `App.jsx`. Le clic se fait via la flèche `→` (`Link` dans `NotificationsPanel.jsx`), pas sur toute la ligne.
- **Bug corrigé — `suggestion`** : pointait vers `/admin` (route **inexistante** → catch-all `*` → redirigeait vers `/hub`). Corrigé en **`/admin/daily`** (route où `SuggestionsAdmin` est monté dans `DailyAdminPage`). → `NotificationsPanel.jsx`
- **Ajout — `level_up`** : avait `link = null` (aucune flèche). Désormais **`/profile`** (page qui affiche badge de niveau, barre XP, créatures débloquées). → `NotificationsPanel.jsx`
- **Notif `comment` câblée de bout en bout** : le type `comment` était **du code mort** (jamais inséré en base — l'action `comment` ne faisait que `UPDATE` le champ commentaire du play). Ajouté dans `supabase/functions/social/index.ts` (action `comment`) un `insert` dans `orienta_notifications` (type `comment`, payload `{ player_pseudo, grid_id, comment }`) **vers le créateur de la grille, sauf auto-commentaire**. Le payload contient `grid_id` → redirection `/dashboard/:gridId` (déjà câblée par défaut).
- **Panneau rendu robuste** : cas `comment` rendu **explicite** (`else if (type === 'comment')`) + **fallback neutre** « a interagi avec ta grille » pour tout type futur inconnu. → `NotificationsPanel.jsx`
- **Déployé** : `social` redéployée via MCP Supabase → **version 3 ACTIVE** (`verify_jwt: false` conservé) sur projet `baqvosadoijsvvelugmp` (« Rental Supervision »). La création de la notif commentaire est donc **live en prod**.

### État final — chaque notif a une redirection valide

| Type | Notif créée | Redirection |
|------|-------------|-------------|
| `play` | check-attempt | `/dashboard/:gridId` |
| `upvote` | trigger DB (008) | `/dashboard/:gridId` |
| `suggestion` | trigger DB (011) | `/admin/daily` *(corrigé)* |
| `level_up` | check-attempt | `/profile` *(ajouté)* |
| `comment` | social *(ajouté + déployé)* | `/dashboard/:gridId` |

> ⚠️ **Désynchro front/back** : la fonction `social` est déployée (v3) mais les modifs front (`NotificationsPanel.jsx`) **ne sont pas commitées**. Tant qu'elles ne sont pas en prod, une notif `comment` créée par le back tombera sur le fallback de l'ancien front (toujours fonctionnel, redirige quand même via `grid_id`).

### Prochaines actions (session 2026-06-04)

- [ ] **Commiter** `NotificationsPanel.jsx` + `social/index.ts` (et déployer le front) pour resynchroniser avec la fonction `social` v3 déjà en prod.
- [ ] Tester en navigateur : cliquer chaque type de notif et vérifier l'atterrissage (`/dashboard/:gridId`, `/admin/daily`, `/profile`).
- [ ] Vérifier qu'une notif `comment` est bien générée : commenter une grille **d'un autre joueur** depuis `/result` → le créateur reçoit la cloche + flèche → dashboard.
- [ ] Poursuivre la migration sécurité `securite-edge-rls` (Edge Functions + RLS) selon les phases de `project_security_rls.md`.

---

## Travail réalisé (session 2026-06-04 — dashboard de stats grille du jour + intégrité `orienta_plays`)

**Feature — dashboard accessible aux finishers.** Demande : depuis « Grilles précédentes » voir aussi la grille du jour ; le bouton stats doit mener à une vraie **page dashboard** (réussites, temps, distribution, classement) ; réservé aux joueurs ayant **terminé** (la solution y est affichée).

- **Edge Function `get-solution`** (nouvelle, v1, `verify_jwt=false`, `supabase/functions/get-solution/index.ts`) : renvoie la solution (`cards` positions/rotations + `clues`) **uniquement** au créateur ou à un finisher (partie `completed_at` non nulle) → `403` sinon. C'est la fonction prévue en Phase 4 du plan sécu ; 1er consommateur = `DashboardPage`. Testée prod (200 finisher / 403 non-finisher / 400 sans grid_id).
- **`DashboardPage.jsx`** généralisée : n'était accessible qu'au **créateur**, désormais aussi aux **finishers** (sinon redirection `/hub`) ; ne lit plus `orienta_grid_cards` en direct → via `get-solution` ; hero adaptatif (« Grille du jour » / « Ma grille »).
- **`HubPage.jsx`** : « Statistiques du jour » + « Tout voir » → `/dashboard/:id` ; modale `DailyLeaderboardModal` **supprimée** (composant + fichier) ; « Tout voir » affiché seulement si la grille du jour est terminée (non-finishers : top-3 inline conservé).
- **`DailyArchivesPage.jsx`** : inclut la grille du jour (`.lte('daily_date', today)`) + sous-titre mis à jour.
- **`GridCard.jsx`** : grille daily **terminée** → dashboard (CTA « Voir les statistiques »), sinon → écran de jeu.
- **Vérifié** (Playwright sur app réelle, finisher *Cédric LOZACH* / non-finisher *Pops*) : hub & archives cohérents, dashboard affiche solution + stats, non-finisher redirigé. Build Vite OK.

**Fix cause racine doublons `orienta_plays`** (résout le point de vigilance du 2026-06-03).

- **Backups prod** : `orienta_plays_backup_20260604` (+ `orienta_play_attempts_backup_20260604`, `orienta_comment_reactions_backup_20260604`) — **à `DROP` une fois la prod validée**.
- **Dédoublonnage** : 128 → **39** lignes (89 non-canoniques supprimées ; cascade -19 essais redondants ; 0 réaction touchée). Canonique = terminée > meilleur score > moins d'essais.
- **Contrainte** `orienta_plays_grid_player_uniq UNIQUE(grid_id, player_id)` (migration) → doublon désormais **rejeté** (testé : erreur `23505`).
- **`start-play` v2 (déployée)** : ancien bug = `maybeSingle()` levait sur multi-lignes → réinsérait un doublon. Désormais lookup `order(completed_at).limit(1)` + insert avec repli sur conflit (ne crée plus de doublon). Testé : 2 appels → **même `play_id`**.
- **Effet** : compteurs `GridCard` (`success!==null`) == `DashboardPage` (`completed_at`) une fois dédoublonné — re-vérifié en UI (carte du jour : 5 joueurs / 60%, identique au dashboard).

### Prochaines actions (session 2026-06-04 — dashboard/intégrité)

- [ ] **Commiter + déployer le front** de cette session (`DashboardPage.jsx`, `HubPage.jsx`, `DailyArchivesPage.jsx`, `GridCard.jsx`, suppression `DailyLeaderboardModal.jsx`) pour resync avec `get-solution` et `start-play` v2 déjà en prod.
- [ ] `DROP` les 3 tables `*_backup_20260604` une fois la prod confirmée stable.
- [ ] (Phase 4) migrer `ResultPage` / `ReplayModal` / `DailyAdminPage` vers `get-solution` avant de verrouiller `orienta_grid_cards` en RLS.

---

<!-- ════════ ARCHIVE — sessions antérieures (branche master, 2026-06-03) ════════ -->

## Travail réalisé (session 2026-06-03 — refonte mobile /admin)

- **Calendrier mensuel** dans `DailyAdminPage.jsx` (remplace la liste de 14 jours) : navigation mois ‹ ›, indicateur ✓ validée / vide par jour, surlignage « aujourd'hui », légende. Données chargées **par mois affiché** (`fetchMonth`) via `gridsByDate` (Map).
- **Navigation mobile** : sidebar masquée → barre sticky « 📅 [date] · Calendrier › » qui ouvre le calendrier en **bottom-sheet** (`.admin-cal-drawer` + backdrop). Sélection d'une date → ferme le tiroir, révèle l'éditeur.
- **Filtre « à remplir »** (`onlyEmpty`) : grise les jours validés + compteur de jours vides.
- **Actions sticky** en bas d'écran sur mobile + **polish tactile** (bouton repioche 36px, cases agrandies).
- **Réutilisation du plateau partagé** : l'admin utilisait un plateau dupliqué à la main (~80 lignes). Remplacé par le composant partagé **`CloverWithInputs`** (le même que `/create`) → indices, boutons latéraux mobile, overlay de saisie, et **boutons de rotation** strictement identiques à `/play` / `/create`.
  - Ajout d'une prop optionnelle `slotAction(pos)` sur `CloverWithInputs` + `DroppableSlot` (render-prop d'overlay par carte) ; non fournie → comportement `/play`/`/create` inchangé.
  - Bouton de **repioche par carte** = 🎲 (`.admin-slot-refresh`), volontairement **distinct** du `↻` de rotation (les deux flèches circulaires se confondaient).
- **Règle « un seul mot par indice »** (espaces bloqués) **centralisée dans `CloverWithInputs`** → s'applique désormais aussi à `/create` (demande explicite utilisateur).
- **Fix débordement grille admin** : `--slot-size` (jamais défini sur `.admin-page` → fallback 210px qui débordait) maintenant **responsive** en 2 paliers (≤768px / ≤680px) suivant la largeur dispo.

---

## Travail réalisé (session 2026-06-03 — gating onboarding communauté)

- **Section communauté masquée tant que le joueur n'a pas terminé sa 1ʳᵉ grille** (victoire OU défaite, du jour ou passée). 3 états dans `HubPage.jsx` PARTIE 02 :
  - **A** (aucune grille finie) : teaser verrouillé `.hub-community-teaser` (cadenas)
  - **B** (1ʳᵉ grille finie, jamais vu) : bandeau de révélation `.hub-reveal-banner` 🎉 + CTA « Créer ma grille »
  - **C** : section normale
  - Anti-flash via `!loading`. Dismiss du bandeau (clic CTA ou croix) → `markTourDone('community_unlocked_seen')` (méthode générique déjà existante dans `authStore.js`).
- **Migration DB `009_add_community_unlocked_seen.sql`** : colonne `orienta_users.community_unlocked_seen boolean default false` + backfill `true` pour les joueurs ayant déjà ≥1 partie terminée (11/18). **Appliquée et vérifiée** (colonne + backfill confirmés via MCP sur projet `baqvosadoijsvvelugmp` = "Rental Supervision").
- **Bugfix déblocage sur défaite** (`HubPage.jsx` ~L89) : la `playsMap` était `new Map(plays.map(p => [p.grid_id, …]))` → clé `grid_id`, donc un doublon `completed_at=null` écrasait la partie terminée et reverrouillait la communauté (et affichait « non joué » sur la grille du jour après défaite). Fix : construction par fusion (OR sur `completed`, MAX sur `attemptsCount`) → une partie terminée ne peut plus être écrasée.

---

## Travail réalisé (redesign Play/Create, antérieur)

- Redesign complet du Hub (`HubPage.jsx`, `Header.jsx`, CSS) committé sous `100c37b redesign`
- Ajout de `ClassementPage.jsx` (leaderboard) et `TutorielPage.jsx` (nouvelles pages)
- Refonte du drawer feedback de PlayPage : remplacé dots `.play-feedback-dot` par 3 tuiles `pfd-tile--green/orange/red`, ajouté score `/4` en-tête, section "Ta configuration" avec label, encart d'aide contextuel
- Onglets historique : les essais futurs s'affichent maintenant en état verrouillé (`play-history-tab--locked`, icône 🔒) au lieu d'être absents
- Footer PlayPage découpé en 3 zones (gauche : chip essai + chrono, centre : bouton submit, droite : lien hub) — bouton renommé "Valider l'essai"
- Bouton feedback-reopen redessiné : texte "Feedback" + badge numérique au lieu de "Essai N ›"
- Tray drawer : ajout d'un header `tray-header` (label "Réserve" + compteur de cartes) — appliqué sur PlayPage **et** CreatePage
- CreatePage : `create-step-header` remonté au-dessus du timer (correction de l'ordre visuel), footer découpé en 3 zones identique au PlayPage
- Mockups de travail créés : `mockup/play-v2.html`, `mockup/play-tweaks.jsx`, `mockup/tweaks-panel.jsx`, `mockup/play-logic.js`

---

## Décisions prises

- [prod] Persistance du « bandeau déjà vu » via **flag DB** `community_unlocked_seen` (cohérent avec `tutorial_modal_done`/`tour_play_done`, cross-device) plutôt que localStorage — choisi par l'utilisateur
- [prod] Bandeau de révélation marqué « vu » **au clic / fermeture** (pas au premier affichage) pour garantir que le joueur ne le rate pas
- [tech] Déblocage basé sur `completed_at IS NOT NULL` (terminal win OU loss), pas sur `success` — répond à « peu importe gagné ou perdu »
- [tech] Robustesse aux **doublons de play** gérée côté lecture (fusion dans `playsMap`), pas en corrigeant la source de duplication (voir vigilance)
- [secret] Mot de passe Postgres admin rangé dans `.env` (gitignoré, var `SUPABASE_DB_PASSWORD` sans préfixe `VITE_`) — **jamais** dans un fichier suivi (README). Migrations DDL lançables via script Node `pg` sur le pooler (port 5432), car le MCP Supabase n'est pas toujours connecté et `supabase db push` échoue (mismatch historique migrations timestamp vs `00X_`).
- [tech] Classe `pfd-*` introduite pour tout le panneau feedback redesigné — l'ancien `.play-feedback-dot` et `.play-history-panel` restent dans le CSS mais ne sont plus référencés dans le JSX ; à nettoyer
- [prod] Les onglets verrouillés affichent `🔒` côté client uniquement — pas de changement DB ni de logique métier
- [tech] Même layout footer (left/center/right) partagé entre PlayPage et CreatePage — pas de composant commun créé pour l'instant
- [prod] Admin **sans drag & drop** : on garde le modèle de repioche 🎲 par carte (pas de tray à glisser) — choisi par l'utilisateur. `slotAction` a quand même été câblé sur `DroppableSlot` pour activer le drag plus tard sans refacto.
- [prod] Règle « un seul mot par indice » étendue à `/create` (et pas seulement l'admin) — placée dans `CloverWithInputs` pour ne pas dupliquer. **Impact** : `/create` n'accepte plus les indices multi-mots.
- [tech] Calendrier admin construit en **UTC** (`ymd`/`buildMonthCells` via `Date.UTC`) pour éviter le décalage de jour ; cohérent avec le stockage `daily_date` (YYYY-MM-DD).

---

## Points de vigilance

- **Doublons de lignes `play` (cause racine non corrigée)** : `PlayPage` crée parfois plusieurs lignes `orienta_plays` pour le même couple (joueur, grille) — 9 couples concernés en base au 2026-06-03. Le Hub y est désormais robuste, mais ces doublons peuvent fausser stats/classements ailleurs. À traquer (où PlayPage duplique l'insert) + nettoyer les doublons existants.
- **Migration 009 hors pipeline CLI** : appliquée par connexion Postgres directe (`pg`), pas par `supabase db push` (qui échoue sur mismatch d'historique). Le fichier `009_*.sql` n'est donc pas enregistré dans la table d'historique de migrations distante — à garder en tête si on réconcilie l'historique un jour.
- **Commit fourre-tout `e6c8d29`** : regroupe la refonte admin mobile **et** des WIP non liés (hub, result, login, TourOverlay, suppression TutorialModal, migrations 008-010). Non poussé. Si on veut un historique propre, envisager un re-split avant push.
- **Régression possible `/create`** : la règle anti-espace s'y applique maintenant — vérifier qu'aucun usage légitime d'indice multi-mots n'existait.
- **Bouton rotation hover-only sur mobile** : `.word-card-rotate` est `opacity:0` sauf survol (comportement hérité de `/play`/`/create`, inchangé). Sur tactile il reste cliquable au centre mais invisible — limitation commune aux 3 pages, pas spécifique à l'admin.
- **CSS orphelins** : classes `.play-feedback-dot`, `.play-feedback-rows`, `.play-history-panel` potentiellement mortes depuis le refactor tuiles — à vérifier avant nettoyage
- **Mockups non trackés** : `mockup/play-v2.html`, `mockup/play-tweaks.jsx` etc. sont untracked — décider si on les committe ou on les supprime
- **`ResultPage.jsx`** et **`LoginPage.jsx`** modifiés dans le diff mais changements mineurs — vérifier qu'il n'y a pas de régressions inattendues
- **Aucun test de smoke effectué** sur les changements PlayPage du working tree — la logique de tabs verrouillés et le chip d'essais n'ont pas été vérifiés dans le navigateur

---

## Prochaines actions

- [ ] Tester en navigateur les 3 états du gating communauté : nouveau joueur (teaser) → terminer 1 grille en échec (déblocage + bandeau 🎉) → recharger (bandeau disparu). Cas réel dispo : joueur **Manu** (`community_unlocked_seen=false`, 1 défaite terminée).
- [ ] Traquer la duplication de lignes `play` dans `PlayPage` + nettoyer les 9 doublons existants en base
- [ ] Lancer le dev server (`npm run dev`) et tester PlayPage : drawer feedback (3 tentatives), tabs verrouillés, chip essai, chrono, bouton "Valider l'essai"
- [x] ~~Committer les changements du working tree~~ → fait dans `e6c8d29` (fourre-tout). Reste à **`git push origin master`**.
- [ ] Tester `/admin` sur mobile : ouverture du tiroir calendrier, sélection de date, plateau (rotation `↻` vs repioche 🎲), actions sticky, filtre « à remplir ». Vérifier aussi que la grille ne déborde plus (`--slot-size`).
- [ ] Vérifier `/create` : indices désormais limités à un seul mot (espaces bloqués).
- [ ] Nettoyer les classes CSS orphelines (`play-feedback-dot`, `play-feedback-rows`, `play-history-panel`) si elles ne sont plus utilisées
- [ ] Décider du sort des fichiers `mockup/play-*.jsx/js/html` (commit dans mockup/ ou suppression)
- [ ] Reprendre Phase 1 roadmap : XP progression + créatures + leaderboard (voir `project_roadmap.md`)
