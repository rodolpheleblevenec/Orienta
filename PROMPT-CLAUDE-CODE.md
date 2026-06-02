# Prompt de démarrage — à coller dans Claude Code

Ouvre ce dossier de handoff **à la racine du projet** (ou colle son contenu), puis donne à Claude Code le message ci-dessous.

---

## ▶ Message à coller

> Je veux appliquer une refonte de la page **Hub** de cette application. Toute la spécification du redesign est dans `Handoff/README.md`, avec la maquette de référence `Handoff/mockup/hub-v2.html` (ouvre-la pour voir les couleurs, espacements, ombres et l'animation exacts) et le rendu `Handoff/screenshots/hub-desktop.png`.
>
> **Règles de travail — à respecter strictement :**
>
> 1. **Ne génère AUCUN code tant que je n'ai pas validé un plan.**
>
> 2. **Étape 1 — Inventaire.** Lis d'abord le code actuel de la page Hub et de ses composants. Dresse la liste de tout ce qui existe : composants, données (requêtes Supabase / RPC), état (Zustand), routes (React Router), handlers d'événements, drag & drop (@dnd-kit), animations (Framer Motion). Présente-moi un **résumé des fonctionnalités existantes** et **attends ma validation**.
>
> 3. **Étape 2 — Plan.** Propose un **plan de refonte découpé bloc par bloc** en suivant l'architecture du README (Header → Challenge du jour → Bloc vidéo → Classement du jour → Créer ma grille → Grilles des autres joueurs, puis déménagement de la progression collective vers l'onglet Classement). Pour **chaque bloc**, indique : ce qui change visuellement, quelle donnée/handler existant est réutilisé, et les risques éventuels. **Arrête-toi et attends que je valide le plan.**
>
> 4. **Étape 3 — Implémentation.** Une fois le plan validé, implémente **un seul bloc à la fois**. Après chaque bloc : assure-toi que **l'application build sans erreur** et que les fonctionnalités du bloc marchent toujours (données réelles, navigation, actions). Montre-moi le résultat et **attends mon feu vert** avant de passer au bloc suivant. Ne fais jamais tout d'un coup.
>
> **Principes non négociables :**
>
> - **Restyler, pas réécrire.** Conserve toute la logique, les données et le flux existants. Ne touche qu'au markup et au CSS (`src/index.css`, vanilla). Pour chaque élément de la maquette, rebranche la donnée / le handler réel équivalent. **Aucune fonctionnalité ne doit être perdue.**
> - **Ne rien inventer.** Si une donnée, un état ou une action de la maquette n'existe pas dans le code, **signale-le et demande** — n'invente pas de fausses données ni de sections supplémentaires.
> - **Tokens, pas de valeurs en dur.** Place les couleurs/typos/rayons/ombres en variables CSS dans `src/index.css` et référence-les ; pas de hex en dur dans les composants.
> - **Pas de commit automatique.** Ne commite pas toi-même — je gère les commits.
>
> **Changements de structure à respecter (delta) — détaillés dans le README §5 :**
> - La **progression collective** quitte le Hub et est **déplacée dans l'onglet Classement** (déplacée, pas supprimée — conserve son code et ses données).
> - **Header** entièrement refait : nav `Hub / Classement / Tutoriel` + actions icônes (série, notifications, réglages, profil). Mappe chaque ancienne action vers la nouvelle, n'en perds aucune.
> - Le **classement** du Hub est celui de la **grille du jour** uniquement.
> - Le **bandeau d'édition** (N°142 + date) se branche sur la vraie logique de rotation quotidienne.
> - Le **bloc vidéo** est un **placeholder animé** (animation CSS définitive ; la vidéo en boucle viendra plus tard — pas de bouton play).
> - Le **responsive est obligatoire** (breakpoints 920px et 560px, détaillés dans le README §6).
>
> Commence par l'**Étape 1 (inventaire)** et arrête-toi pour validation.

---

## Notes

- Si Claude Code n'a pas accès au repo : ouvre-le dans le même workspace que ce dossier `Handoff/`.
- L'animation du bloc vidéo est en CSS dans la maquette (`@keyframes tileSpin`, `@keyframes livePulse`). Tu peux la garder en CSS ou la porter en Framer Motion pour homogénéiser — à toi de voir avec Claude Code à l'étape plan.
- L'onglet `Classement` (où atterrit la progression collective) n'est pas encore maquetté : soit on réutilise le composant existant tel quel dans le nouvel onglet, soit on le redessine dans une prochaine itération.
