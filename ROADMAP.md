# Orienta Roadmap

**Dernière mise à jour**: 2026-06-01

---

## ✅ Phase 0 — Fondations (COMPLÉTÉ)

- ✅ Bugs critiques fixes (drag crash, difficulty column, hard mode submit, wardrobe skins)
- ✅ Système XP individuel + collectif (`add_user_xp` RPC, niveaux, skins)
- ✅ Scoring + streak bonus (`scoring.js`)
- ✅ Créatures emoji (collectif) + SVG marine items (individuel)
- ✅ CollectiveGauge + LevelsModal + Wardrobe
- ✅ ProfilePage XP bar + historique jouées/créées
- ✅ DashboardPage créateur (stats + solution)
- ✅ ResultPage (score + solution tab)
- ✅ DailyAdminPage (gestion grilles du jour)

---

## ✅ Phase 1 — UX & Polish (COMPLÉTÉ)

### Visuel cartes
- ✅ Cartes fond blanc + stroke coloré + mots colorés — `cardColors.js`
- ✅ Couleurs flashy/vives (5 teintes : teal, orange-rouge, bleu électrique, ambre, violet)
- ✅ Orientation des mots dans `StaticMiniGrid` synchronisée avec la grille principale

### Hub
- ✅ Statut "en cours" avec nb d'essais sur les `GridCard`
- ✅ Code couleur difficulté (Facile/Moyen/Difficile)
- ✅ Grilles du jour + archives 7 jours
- ✅ Section "Ma grille" (créée / loupée / CTA créer)

### Création
- ✅ Mode difficile : swap de cartes en temps réel (DroppableSlot réutilisé)
- ✅ Validation indices : un indice ne peut pas être un mot des cartes
- ✅ Chrono moyen/difficile avec modal de warning au départ
- ✅ Forfait si abandon (localStorage par user, expiration jour J)
- ✅ Auto-publish si tous les indices sont remplis à l'expiration du timer
- ✅ État "loupé" si au moins un indice vide à l'expiration

### Jeu
- ✅ Restauration des essais en cours au retour sur une grille
- ✅ Drawer feedback : placeholder structuré avant le 1er essai
- ✅ Tour guidé 1ère visite sur `/play` et `/create` (`TourOverlay`)

### Modales & accessibilité
- ✅ Body scroll lock sur toutes les modales (`useBodyScrollLock`)
- ✅ TutorialModal : onglet créateur → "Suivant", onglet joueur → "Fermer"

### Profil & Dashboard
- ✅ Grilles jouées/créées enrichies (temps, essais, difficulté, lien /result)
- ✅ Solution dans `/dashboard` = même layout que l'onglet solution de `/result`

### Bug critique
- ✅ Edge function `check-attempt` corrigée et redéployée

---

## ✅ Phase 2 — Bug Fixes & Robustesse (COMPLÉTÉ 2026-06-01)

### Bugs critiques / majeurs corrigés
- ✅ `ReplayModal` — `cardMap` keyed par le mauvais ID → mots tous affichés `—`, fix: `cardMap[gc.card_id]`
- ✅ `PlayPage` — timer démarrait avant chargement réseau, facturant les secondes de fetch au score
- ✅ `PlayPage` — fail silencieux si `check-attempt` échoue → message "Erreur réseau — réessaie."
- ✅ `ResultPage` — inner query `orienta_play_attempts` non-awaited, risque de state update après unmount → guard `cancelled`
- ✅ `scoring.js` — `evaluateAttempt` (code mort côté client) ignorait "bonne position + mauvaise rotation" comme partiel. Edge Function était déjà correcte.

### Bugs mineurs corrigés
- ✅ `HubPage` — `dailyPlaysMap` était un état dupliqué inutile (même référence que `playsMap`), supprimé
- ✅ `DashboardPage` — `avgTime` incluait les parties avec `time_seconds = null` comme 0, biaisait la moyenne

### UX mobile
- ✅ `/result` — mini-grid plus rognée sur mobile (offset `clamp()` recalculé à 190px)
- ✅ `/create` — indices latéraux Gauche/Droite : bouton vertical sur mobile → overlay centré à la saisie, input direct sur desktop (≥681px)
- ✅ Uniformisation couleur/police sur les 4 champs d'indice
- ✅ Fermeture de l'overlay latéral quand l'utilisateur clique sur Haut ou Bas

---

## ✅ Phase 3 — P1 (COMPLÉTÉ 2026-06-01)

- ✅ **Notifications** : table `orienta_notifications` + trigger SQL (`trg_notify_comment`) + badge rouge Header + `NotificationsPanel.jsx` (panel slide-in, mark-as-read automatique, lien vers dashboard)
- ✅ **Attempts count sur hub** : `attempts_count` mis à jour après chaque essai raté (fire-and-forget) ; GridCard affiche "En cours" si aucun essai encore enregistré

## 🔄 Phase 4 — En cours / À faire

### P2 — Nice to have (backlog)

- [ ] **Dark mode**
- [ ] **Audit responsive mobile** complet
- [ ] **Filtres leaderboard** (semaine / mois / all-time)
- [ ] **Partage de grille** (lien d'invitation)
- [ ] **Difficulté progressive** (déblocage de grilles difficiles selon XP)

---

## 🔐 Avant mise en production

- [ ] Activer RLS sur toutes les tables `orienta_*`
- [ ] Policies : isolation user data, grids publiques, play attempts own
- [ ] Audit XP : vérifier que `add_user_xp` ne peut pas être appelé en boucle
- [ ] Sécuriser `check-attempt` edge function (valider `play_id` appartient à l'user)
- [ ] Sécuriser `DailyAdminPage` côté serveur (actuellement protection client-side uniquement)
