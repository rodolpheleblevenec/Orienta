# Handoff — 2026-06-06

## Contexte

- **Projet** : Orienta
- **Branche** : `feat/grille-jour-communautaire` (PR **mergée sur `master` à la main** par l'utilisateur). ⚠️ Un correctif **chrono** a été ajouté APRÈS le merge et n'est **pas encore commité/poussé** (voir plus bas).
- **État** : Grosse évolution livrée — la **grille du jour devient communautaire** (le top 1 d'un jour gagne le droit de créer la grille de J+3) + **réserve admin** de grilles sans date + **fix chrono anti-triche**. **DB migrée** (016) et **6 Edge Functions déployées** en prod (MCP) sur `baqvosadoijsvvelugmp`. Reste : commit/push du correctif chrono ; ouvrir le DROP de l'ancienne `generate-daily-grid` côté Supabase (fait par l'utilisateur).

---

## Travail réalisé (session 2026-06-06 — grille du jour communautaire + réserve + chrono anti-triche)

### A. Grille du jour communautaire (gagnant crée J+3) + réserve admin
**But** : sortir du modèle « un seul admin crée toutes les grilles ». Le **vainqueur** du classement d'un jour J gagne le droit de **créer la grille du jour de J+3**. Une **réserve admin** (grilles sans date, priorisée) comble les jours sans gagnant ; rejeu d'archive en dernier recours. Plan complet : `~/.claude/plans/radiant-kindling-tide.md`. Mémoire : `project_daily_community_grid.md`.

- **DB — migration `016_daily_reserve_and_grants.sql` (appliquée en prod)** :
  - `orienta_grids` + colonnes **`daily_status`** (`NULL`=communautaire ; `reserve`/`scheduled`/`published`=piste quotidienne) et **`reserve_priority`**.
  - **Nouveau discriminant** : « piste quotidienne » = `daily_status IS NOT NULL` (remplace l'ancien `daily_date IS NULL`). Requêtes communauté mises à jour (HubPage, create-grid, stats admin).
  - Nouvelle table **`orienta_grid_grants`** (droit de créer : winner_user_id, source_grid_id UNIQUE, target_date UNIQUE, status pending/claimed/expired, deadline, onboarding_seen_at). RLS : SELECT public, écriture service-role.
  - Conversion des 8 grilles futures pré-générées → **réserve** (sans date, priorité 1..8).
- **Edge Functions** :
  - **`daily-rollover` (NOUVELLE, remplace `generate-daily-grid` supprimée)** : à minuit (cron GitHub `daily-rollover.yml`, 01:00 UTC) → désigne le #1 de la veille (dérivé serveur depuis les scores), crée le grant J+3 + notif `grid_grant`, **garantit une grille du jour** (gagnant pinné → réserve par priorité → clone d'archive), alerte stock bas (`reserve_low`), expire les grants non honorés (`grant_expired`).
  - **`create-grid`** : mode **grant** (`grant_id`) → bypass quota communautaire, date verrouillée sur `target_date`, insère `daily_status='scheduled'`, marque le grant `claimed`.
  - **`admin`** : actions **`save-reserve-grid`** / **`reorder-reserve`** + stats adaptées (`daily_status`, `reserve_count`). `save-daily-grid` pose maintenant `daily_status='published'`.
  - **`account`** : action **`grant-seen`** (marque la modale d'accompagnement vue).
- **Frontend — parcours gagnant accompagné** :
  - `WinnerWelcomeModal` (modale félicitations à la connexion, 1 fois via `onboarding_seen_at`) ; bannière hub persistante ; message récompense sur le **Classement du jour** (visible par tous) ; `CreatePage` mode grant (`?grant=ID`, date verrouillée, écran de confirmation) ; branche notif `grid_grant`.
  - `DailyAdminPage` **refondue** : gestionnaire de **réserve** (drag-and-drop @dnd-kit/sortable pour la priorité) + panneau **Programme** (aujourd'hui + grilles programmées + historique, avec override/suppression). Remplace le calendrier mensuel.
  - Notifications : nouveaux types `grid_grant`/`reserve_low`/`grant_expired`.

### B. Notifications — dropdown sous l'icône (desktop)
Le panneau s'ouvre désormais en **dropdown ancré sous la cloche** en desktop (voile sombre conservé sur mobile). `Header.jsx` (wrapper `.notif-anchor`), `NotificationsPanel.jsx` (fragment backdrop+panel ancré), CSS.

### C. Fix chrono anti-triche (grille du jour)
**Problème observé** : au retour sur une grille « en cours », le chrono **affiché** repartait de 0 (`startTimeRef = Date.now()` à chaque chargement) → semblait permettre de scouter la solution puis revenir avec un temps frais.
**Diagnostic** : le **score** était déjà sain (le serveur calcule le temps depuis `orienta_plays.started_at`, jamais reseté). Seul l'**affichage** trompait.
**Correctif** : `start-play` renvoie `started_at` (ISO UTC) ; `PlayPage` cale `startTimeRef` dessus → chrono **continu**, jamais reseté au retour, cohérent avec le score. `start-play` **déployé (v3)**.
> Arbitrage assumé : l'horloge tourne en continu depuis la 1ʳᵉ ouverture (ouvrir « pour voir » engage). Alternative possible (non faite) : démarrer le chrono au 1ᵉʳ déplacement de carte, côté serveur.

### État de déploiement / git (session 2026-06-06)
- **Déployé en prod (MCP)** : migration 016 ; edge functions `daily-rollover` v1, `create-grid` v3, `account` v4, `admin` v8, `start-play` v3.
- **Commité + poussé** : feature (A + B) sur `feat/grille-jour-communautaire`, **PR mergée sur `master`** par l'utilisateur.
- **PAS encore commité** : le **correctif chrono (C)** — `src/pages/play/PlayPage.jsx` + `supabase/functions/start-play/index.ts`. À commiter/pousser (en attente du feu vert sur la base : nouvelle branche depuis master + PR, ou direct).
- **Ancienne `generate-daily-grid`** : supprimée du repo ; côté Supabase **supprimée par l'utilisateur**. (Aucun outil MCP pour delete une edge function.)

### Restant / prochaines actions (2026-06-06)
- [ ] **Commit/push du correctif chrono** (PlayPage + start-play) puis redéploiement frontend.
- [ ] **Activer le cron** : le schedule `daily-rollover.yml` ne tourne que depuis `master` (déjà mergé) → vérifier qu'il s'exécute (ou lancer un `workflow_dispatch` de test avec `?date=` d'un jour passé). Vérifier que le secret GitHub `FUNCTION_SECRET` est présent.
- [ ] Test navigateur du parcours gagnant : modale → `/create?grant=` → publication → grille programmée J+3 ; bannière hub ; classement.
- [ ] Test réserve admin : créer/réordonner des grilles, vérifier la pioche au rollover.
- [ ] Limite connue : identité spoofable (pas d'auth) — gagnant re-dérivé serveur mais `user_id` reste falsifiable (cf. `project_security_rls.md`).

---

# Handoff — 2026-06-04

## Contexte

- **Projet** : Orienta
- **Branche** : `securite-edge-rls` (migration sécurité : écritures sensibles déplacées vers des Edge Functions + RLS, par phases — voir mémoire `project_security_rls.md`)
- **État** : ✅ **TERMINÉ & DÉPLOYÉ** (2026-06-04). Tout est **commité, fusionné dans `master`, poussé** (HEAD `0b3058e`) → déploiement GitHub Actions (`deploy.yml`) → Firebase Hosting `orienta-d22a3` **réussi**. Site live : https://orienta-d22a3.web.app (HTTP 200). Les 8 Edge Functions sont déployées (MCP), la RLS est active en prod, et l'**advisor sécurité Orienta est clean** (hors `rental_*` = autre app). `master == securite-edge-rls`. Reste seulement (optionnel) le DROP des 3 tables de sauvegarde, sur OK utilisateur.

---

## Travail réalisé (session 2026-06-04 — sécurisation complète Edge Functions + RLS, phases 1–4, DÉPLOYÉE)

Aboutissement de la migration sécurité (plan `project_security_rls.md`). **Commitée `a50ddb9` → `master` → push → déployée** (GitHub Actions `deploy.yml` → Firebase `orienta-d22a3`, run *success*, live https://orienta-d22a3.web.app HTTP 200). Edge Functions déployées via MCP. **Principe** : le client ne fait plus que **lectures + `invoke`** ; toutes les écritures passent par des Edge Functions en `service_role` ; la RLS bloque l'accès direct `anon`.

- **Phase 1 — autorité du jeu** : `start-play` (crée/reprend la partie, renvoie les cartes **sans solution**) + `check-attempt` réécrite (évalue, enregistre la tentative, **finalise atomiquement**, décide score/XP, temps via `started_at`, **n° d'essai calculé serveur** = anti-forge/anti-brute-force). `PlayPage` n'écrit plus. Corrige un **double-comptage XP collectif** préexistant.
- **Phase 2 — contenu & social** : `create-grid` (validations serveur : limite quotidienne, difficulté débloquée, conflit de mot, intégrité cartes) + `social` (comment/react/upvote en toggle). `CreatePage`/`ResultPage` migrées (UI optimiste conservée + feedback d'erreur ajouté).
- **Phase 3 — compte & admin** : `account` (login get-or-create, flags *whitelist*, skin, notifs-read, suggestion **pseudo relu serveur**) ; `admin` protégée par **secret serveur hashé SHA-256** stocké dans `orienta_admin_config` (RLS sans policy), comparaison ~temps constant, *fail-closed*. Saisie via `src/lib/adminSecret.js` (sessionStorage + prompt) ; mot de passe = voir mémoire `project_security_rls.md`. `authStore`/`ProfilePage`/`DailyAdminPage`/`SuggestionsAdmin` migrées.
- **Phase 4 — RLS** : `ENABLE RLS` sur les 12 tables `orienta_*` (+ 3 backups). `SELECT` public **ciblé** ; **aucune** écriture directe `anon` ; `orienta_grid_cards` (solution) + `orienta_suggestions` + `orienta_admin_config` **masquées**. Derniers lecteurs de solution migrés vers `get-solution` (`ResultPage`, `ReplayModal`, `DailyAdminPage`) ; `get-solution` v2 renvoie aussi le leurre. **Trou critique fermé** (révélé par `get_advisors` *après* la RLS) : les RPC `SECURITY DEFINER` (`award_xp_on_play`, `add_user_xp`, `recalculate_*`, `notify_creator_on_comment`) étaient appelables par `anon` via `/rest/v1/rpc` → `REVOKE EXECUTE` de `public`/`anon`/`authenticated`, `GRANT` à `service_role`.

**Revue adversariale** (workflows) phases 1+2 puis 3 : 2 « critiques » écartés comme faux positifs (decoy `-1` réellement autorisé ; `recalculate_user_level` existe bien) ; vrais correctifs appliqués (anti-forge essai, finalisation atomique, validation réponse 4 cartes, self-play = 0 XP, gestion d'erreurs front).

**Vérifié en prod (curl + SQL)** : SELECT autorisés OK ; `grid_cards`/`suggestions`/`admin_config`/backups → `[]` ; INSERT direct anon → `401 (42501)` ; `rpc award_xp_on_play` anon → `401 permission denied` ; **jeu complet via fonctions OK** (collectif +70, joueur +25, créateur +45) ; `get-solution` finisher 200 / non-finisher 403.

**Limite assumée** : pas d'auth réelle → le client envoie `user_id`/`player_id` (usurpation d'identité non couverte). Vrai correctif = **Supabase Auth**, reporté post-lancement.

### Migrations DB appliquées (MCP `apply_migration`)
- `orienta_admin_config` (table + RLS + hash du secret)
- `orienta_enable_rls` (RLS + policies SELECT)
- `orienta_lock_backup_tables`
- `orienta_lock_security_definer_rpcs`
- `orienta_harden_function_search_path` (`SET search_path=public` sur les 6 fonctions SECURITY DEFINER)

> ⚠️ Ces migrations ont été appliquées **directement sur la base distante via MCP** ; elles ne sont **pas** déposées comme fichiers dans `supabase/migrations/`. Le repo n'est donc pas source de vérité à 100 % pour ces changements DB (à exporter si besoin un jour).

### Restant
- [x] ~~Durcissement `search_path` des fonctions SQL~~ → **fait** (migration ci-dessus). Advisor sécurité Orienta **clean** : ne restent que des `INFO rls_enabled_no_policy` (tables volontairement verrouillées).
- [ ] `DROP` les 3 tables `orienta_*_backup_20260604` — **EN ATTENTE** de la validation prod par l'utilisateur (destructif, c'est le filet de sécurité du dédoublonnage). Ne pas droper sans son OK explicite.
- [ ] Test navigateur sur le site live : jeu, création, social, profil, **admin** (mot de passe dans la mémoire sécu).
- ❌ **DÉCIDÉ DE NE PAS FAIRE** (choix utilisateur 2026-06-04) : RLS sur `rental_*`/`logements` (autre app, Rental Supervision) ; **Supabase Auth** (fermeture de l'usurpation d'identité).

> Aucune action **Supabase obligatoire** côté utilisateur : tout (fonctions, migrations, secret admin hashé en base) a été appliqué via MCP et vérifié en prod. Seul le DROP des backups reste, optionnel, sur OK utilisateur.

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

- [x] ~~**Commiter** `NotificationsPanel.jsx` + `social/index.ts` (et déployer le front)~~ → fait dans `a50ddb9` (commit global), déployé.
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

- [x] ~~**Commiter + déployer le front** de cette session~~ → fait dans `a50ddb9`, déployé (Firebase).
- [ ] `DROP` les 3 tables `*_backup_20260604` une fois la prod confirmée stable.
- [x] ~~(Phase 4) migrer `ResultPage` / `ReplayModal` / `DailyAdminPage` vers `get-solution`~~ → fait + `orienta_grid_cards` verrouillée en RLS (voir session sécu en tête).

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

- ~~**Doublons de lignes `play`**~~ ✅ **RÉSOLU (2026-06-04)** : cause racine corrigée (`start-play` v2 + contrainte `UNIQUE(grid_id, player_id)`), doublons existants nettoyés (128→39). Création de partie désormais uniquement via `start-play` (service_role). Voir session « dashboard + intégrité ».
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
