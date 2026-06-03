# Handoff — 2026-06-03

## Contexte

- **Projet** : Orienta
- **Branche** : master
- **Fichiers clés touchés** : `src/pages/hub/HubPage.jsx`, `src/index.css`, `supabase/migrations/009_add_community_unlocked_seen.sql`, `.env`, `src/pages/play/PlayPage.jsx`, `src/pages/create/CreatePage.jsx`, `src/components/game/WordCard.jsx`, `src/lib/cardColors.js`, `src/pages/login/LoginPage.jsx`, `src/pages/result/ResultPage.jsx`
- **État** : WIP — redesign Play/Create committé (commits `redesign` + `favicon` du 2026-06-02), plus diff **non committé** dans le working tree (redesign Play/Create + gating onboarding communauté ci-dessous)

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

---

## Points de vigilance

- **Doublons de lignes `play` (cause racine non corrigée)** : `PlayPage` crée parfois plusieurs lignes `orienta_plays` pour le même couple (joueur, grille) — 9 couples concernés en base au 2026-06-03. Le Hub y est désormais robuste, mais ces doublons peuvent fausser stats/classements ailleurs. À traquer (où PlayPage duplique l'insert) + nettoyer les doublons existants.
- **Migration 009 hors pipeline CLI** : appliquée par connexion Postgres directe (`pg`), pas par `supabase db push` (qui échoue sur mismatch d'historique). Le fichier `009_*.sql` n'est donc pas enregistré dans la table d'historique de migrations distante — à garder en tête si on réconcilie l'historique un jour.
- **Working tree non committé** : ~1 140 lignes de diff (PlayPage + CreatePage + CSS) — risque de perte si checkout ou reset sans commit préalable
- **CSS orphelins** : classes `.play-feedback-dot`, `.play-feedback-rows`, `.play-history-panel` potentiellement mortes depuis le refactor tuiles — à vérifier avant nettoyage
- **Mockups non trackés** : `mockup/play-v2.html`, `mockup/play-tweaks.jsx` etc. sont untracked — décider si on les committe ou on les supprime
- **`ResultPage.jsx`** et **`LoginPage.jsx`** modifiés dans le diff mais changements mineurs — vérifier qu'il n'y a pas de régressions inattendues
- **Aucun test de smoke effectué** sur les changements PlayPage du working tree — la logique de tabs verrouillés et le chip d'essais n'ont pas été vérifiés dans le navigateur

---

## Prochaines actions

- [ ] Tester en navigateur les 3 états du gating communauté : nouveau joueur (teaser) → terminer 1 grille en échec (déblocage + bandeau 🎉) → recharger (bandeau disparu). Cas réel dispo : joueur **Manu** (`community_unlocked_seen=false`, 1 défaite terminée).
- [ ] Traquer la duplication de lignes `play` dans `PlayPage` + nettoyer les 9 doublons existants en base
- [ ] Lancer le dev server (`npm run dev`) et tester PlayPage : drawer feedback (3 tentatives), tabs verrouillés, chip essai, chrono, bouton "Valider l'essai"
- [ ] Committer les changements du working tree une fois validés — un seul commit "play/create UI refactor"
- [ ] Nettoyer les classes CSS orphelines (`play-feedback-dot`, `play-feedback-rows`, `play-history-panel`) si elles ne sont plus utilisées
- [ ] Décider du sort des fichiers `mockup/play-*.jsx/js/html` (commit dans mockup/ ou suppression)
- [ ] Reprendre Phase 1 roadmap : XP progression + créatures + leaderboard (voir `project_roadmap.md`)
