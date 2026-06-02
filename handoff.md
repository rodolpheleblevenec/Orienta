# Handoff — 2026-06-03

## Contexte

- **Projet** : Orienta
- **Branche** : master
- **Fichiers clés touchés** : `src/pages/play/PlayPage.jsx`, `src/pages/create/CreatePage.jsx`, `src/index.css`, `src/components/game/WordCard.jsx`, `src/lib/cardColors.js`, `src/pages/login/LoginPage.jsx`, `src/pages/result/ResultPage.jsx`
- **État** : WIP — redesign Play/Create committé (commits `redesign` + `favicon` du 2026-06-02), mais ~1 140 lignes de diff supplémentaires **non committées** dans le working tree

---

## Travail réalisé

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

- [tech] Classe `pfd-*` introduite pour tout le panneau feedback redesigné — l'ancien `.play-feedback-dot` et `.play-history-panel` restent dans le CSS mais ne sont plus référencés dans le JSX ; à nettoyer
- [prod] Les onglets verrouillés affichent `🔒` côté client uniquement — pas de changement DB ni de logique métier
- [tech] Même layout footer (left/center/right) partagé entre PlayPage et CreatePage — pas de composant commun créé pour l'instant

---

## Points de vigilance

- **Working tree non committé** : ~1 140 lignes de diff (PlayPage + CreatePage + CSS) — risque de perte si checkout ou reset sans commit préalable
- **CSS orphelins** : classes `.play-feedback-dot`, `.play-feedback-rows`, `.play-history-panel` potentiellement mortes depuis le refactor tuiles — à vérifier avant nettoyage
- **Mockups non trackés** : `mockup/play-v2.html`, `mockup/play-tweaks.jsx` etc. sont untracked — décider si on les committe ou on les supprime
- **`ResultPage.jsx`** et **`LoginPage.jsx`** modifiés dans le diff mais changements mineurs — vérifier qu'il n'y a pas de régressions inattendues
- **Aucun test de smoke effectué** sur les changements PlayPage du working tree — la logique de tabs verrouillés et le chip d'essais n'ont pas été vérifiés dans le navigateur

---

## Prochaines actions

- [ ] Lancer le dev server (`npm run dev`) et tester PlayPage : drawer feedback (3 tentatives), tabs verrouillés, chip essai, chrono, bouton "Valider l'essai"
- [ ] Committer les changements du working tree une fois validés — un seul commit "play/create UI refactor"
- [ ] Nettoyer les classes CSS orphelines (`play-feedback-dot`, `play-feedback-rows`, `play-history-panel`) si elles ne sont plus utilisées
- [ ] Décider du sort des fichiers `mockup/play-*.jsx/js/html` (commit dans mockup/ ou suppression)
- [ ] Reprendre Phase 1 roadmap : XP progression + créatures + leaderboard (voir `project_roadmap.md`)
