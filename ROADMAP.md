# Orienta Roadmap

**Dernière mise à jour**: 2026-05-28

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
- ✅ AdminDailyPage (gestion grilles du jour)

---

## ✅ Phase 1 — UX & Polish (COMPLÉTÉ)

### Visuel cartes
- ✅ Cartes fond blanc + stroke coloré + mots colorés (plus de fill) — `cardColors.js`
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
- ✅ Bulles de tour repositionnées vers les composants cibles

### Modales & accessibilité
- ✅ Body scroll lock sur toutes les modales (`useBodyScrollLock`)
- ✅ TutorialModal : onglet créateur → "Suivant", onglet joueur → "Fermer"

### Profil & Dashboard
- ✅ Grilles jouées/créées enrichies (temps, essais, difficulté, lien /result)
- ✅ Nom de grille = 4 indices joints par `·`
- ✅ Solution dans `/dashboard` = même layout que l'onglet solution de `/result`

### Bug critique
- ✅ Edge function `check-attempt` corrigée (anciens noms de tables → `orienta_*`) et redéployée

---

## 🔄 Phase 2 — En cours / À faire

### P1 — Important

- [ ] **Notifications** : `orienta_notifications` table + badge Header + modal commentaires sur ses grilles
- [ ] **Attemptes count sur hub** : afficher le nb réel d'essais depuis `orienta_play_attempts` (actuellement `attempts_count` est null avant completion)
- [ ] **Win animation** : confetti + animation XP bar + popup "+X XP"

### P2 — Nice to have

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
