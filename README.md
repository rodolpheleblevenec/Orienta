# Orienta — Refonte de la page Hub · Dossier de handoff

Ce dossier contient tout le nécessaire pour réimplémenter la page **Hub** d'Orienta dans le codebase, à l'identique de la maquette validée, **sans perdre aucune fonctionnalité existante**.

> **Stack cible** : React 19 · React Router v6 · Framer Motion · Zustand · @dnd-kit · Supabase (PostgreSQL / RPC / Edge Functions) · CSS vanilla (`src/index.css`).

---

## 0. Contenu du dossier

| Fichier | Rôle |
|---|---|
| `README.md` | Ce document — la **source de vérité** du redesign. |
| `PROMPT-CLAUDE-CODE.md` | Le prompt à coller dans Claude Code pour démarrer (mode « plan d'abord »). |
| `mockup/hub-v2.html` | La **maquette de référence** (HTML/CSS autoporté). Ouvre-la dans un navigateur : tokens, espacements, ombres et l'animation du bloc vidéo y sont tous exacts. |
| `mockup/preview-desktop-mobile.html` | Aperçu desktop + cadre mobile côte à côte. |
| `screenshots/hub-desktop.png` | Rendu desktop complet. |

**La maquette est la référence visuelle. Le code existant est la référence fonctionnelle.** Les deux doivent être respectés simultanément : on restyle, on ne réécrit pas la logique.

---

## 1. Principe directeur : restyler, pas réécrire

La page Hub existe déjà et fonctionne (données Supabase, état Zustand, navigation, drag & drop, etc.). Ce redesign **change le markup et le CSS, et réorganise l'agencement de l'information** — il **ne change pas la logique métier**.

Pour chaque élément de la maquette, il faut **retrouver la donnée / le handler / l'état équivalent dans le code actuel et le rebrancher**. Aucune donnée affichée ne doit devenir statique, aucun bouton ne doit perdre son action.

---

## 2. Système visuel (design tokens)

À placer dans `src/index.css` sous forme de variables CSS (`:root`). Réutilise les noms existants s'ils existent déjà ; sinon, crée-les. **Ne pas coder de valeurs hex en dur dans les composants** — toujours passer par les tokens.

### Couleurs — surfaces neutres
```css
--bg:        #f1f2f3;   /* fond de page */
--bg-tint:   #eceeef;   /* fond alterné / pistes de barres */
--card:      #ffffff;   /* cartes, panneaux */
--ink:       #1c2128;   /* texte principal */
--ink-2:     #5d6470;   /* texte secondaire */
--ink-3:     #9aa1ac;   /* texte tertiaire / labels */
--line:      rgba(28,33,40,0.09);  /* filets, bordures */
--line-2:    rgba(28,33,40,0.05);
```

### Couleurs — marque
```css
--teal:      #0a9e84;   /* couleur de marque (boutons, accents) */
--teal-700:  #08846f;   /* hover / texte sur fond clair */
--teal-soft: #e3f4ef;   /* fonds de pills */
--mint:      #9fe3d2;   /* dégradés, indicateurs */
```

### Couleurs — accents des cartes (repris du plateau de jeu réel)
```css
--orange:#e8920e;  --orange-soft:#fcefd6;
--green: #16a085;  --green-soft: #dcf2ec;
--blue:  #2f6fd6;  --blue-soft:  #e0eafb;
--coral: #f2603f;  --coral-soft: #fde3dc;
--amber: #d98a14;  /* badge niveau « Moyen » */
```

### Typographie
- **Display / titres** : `Bricolage Grotesque` (poids 600–800, `letter-spacing` négatif ~ -0.025em).
- **Texte courant** : `DM Sans` (400–700).
- Importer les deux fonts (Google Fonts ou self-host). Voir le `<head>` de `hub-v2.html`.

### Rayons, ombres, espacements
```css
--r:      22px;  /* cartes principales */
--r-sm:   14px;  /* petits éléments, pills internes */
--r-pill: 999px; /* boutons, badges */

--shadow:    0 18px 44px -22px rgba(20,30,45,0.30); /* cartes héro */
--shadow-sm: 0 10px 26px -16px rgba(20,30,45,0.24); /* panneaux */
--shadow-xs: 0 2px 8px -4px   rgba(20,30,45,0.18);  /* bloc créer */
```
Largeur de contenu max : **1200px**, padding latéral 28px (16px en mobile).

---

## 3. Architecture de la page

La page est désormais découpée en **deux parties explicitement démarquées** par un en-tête numéroté + filet horizontal :

```
HEADER (sticky)
│
├── PARTIE 01 · « La grille du jour »   ← en-tête : 01 + titre + dateline (Édition N°142 · date) à droite
│   ├── A. Bloc Challenge du jour       (carte blanche, héro)
│   ├── B. Bloc Vidéo « Découvrir le jeu » (carte sombre, animation en boucle)   ← A et B côte à côte
│   └── C. Classement du jour           (panneau, podium 3 colonnes)
│
└── PARTIE 02 · « La communauté »        ← en-tête : 02 + titre + filet
    ├── D. Créer ma grille               (bloc en pointillés)
    └── E. Grilles des autres joueurs    (grille de 4 cartes)
```

---

## 4. Les blocs, un par un (+ mapping vers l'existant)

> Pour chaque bloc : **(maquette)** ce qu'on voit, **(données)** à brancher sur l'existant, **(à faire)** points d'attention.

### HEADER (sticky, `backdrop-filter`)
- **(maquette)** Logo Orienta (teal) à gauche · nav `Hub` / `Classement` / `Tutoriel` (onglet actif = teal sur fond `--teal-soft`) · à droite : badge **série** (flamme + nombre, fond corail), icône **notifications**, icône **réglages**, séparateur, **profil** (avatar + prénom). En mobile : nav repliée derrière un bouton burger, prénom masqué.
- **(données)** Reprendre la nav et **toutes** les actions du header actuel. Mapper chaque ancienne entrée vers la nouvelle : série → store de streak, notifications → existant, réglages → route existante, profil → route existante, déconnexion (si présente aujourd'hui) → la replacer dans le menu profil.
- **(à faire)** Le routing reste React Router v6 (`NavLink` pour l'état actif). Ne pas casser les liens existants.

### A. Challenge du jour
- **(maquette)** Carte blanche : eyebrow « Challenge du jour », gros titre « La grille du jour », paragraphe d'intro, **4 stats** (Statut, Niveau, Joueurs, Réussite — la pill Niveau est teal), bouton **Jouer la grille** + lien « Grilles précédentes (N) ».
- **(données)** Statut / niveau / nombre de joueurs / taux de réussite / nombre de grilles précédentes viennent de la **grille du jour réelle** (Supabase). Le bouton « Jouer » garde sa navigation/action actuelle. Le lien « précédentes » → sa route/sa modale existante.
- **(à faire)** Le **statut** est dynamique (Non joué / En cours / Joué) — conserver la logique d'état existante et l'afficher dans la pill.

### B. Bloc Vidéo « Découvrir le jeu »
- **(maquette)** Carte sombre (dégradé teal/bleu, grille en filigrane). En haut : badge caméra « Découvrir le jeu » + indicateur « En boucle » (point menthe pulsé). Au centre : **les 4 cartes du jeu tournent en continu** par paliers de 90°, décalées (animation CSS `tileSpin`, voir maquette). En bas : titre « Une grille. Chaque jour. Avec tout le monde. » + phrase de principe (pleine largeur).
- **(données)** **Aucune donnée** — c'est un bloc promotionnel statique pour l'instant. Placeholder destiné à accueillir une **vraie vidéo en boucle** plus tard (le bloc remplacera l'animation par un `<video autoplay loop muted playsinline>`).
- **(à faire)** L'animation peut rester en **CSS pur** (comme la maquette) ou être portée en **Framer Motion** si tu préfères homogénéiser. Respecter `prefers-reduced-motion` (déjà géré dans la maquette : animation coupée). Ne **pas** ajouter de bouton play — la vidéo sera en lecture auto.

### C. Classement du jour
- **(maquette)** Panneau blanc, titre « Classement du jour » + **sous-titre « Les meilleurs scores sur la grille d'aujourd'hui »** (c'est ce qui rattache explicitement le classement à la grille du jour), lien « Tout voir ». En dessous : **podium 3 colonnes** (médailles 1/2/3, le 1ᵉʳ surligné en or), nom + points.
- **(données)** Brancher sur le **classement réel de la grille du jour** (Supabase). « Tout voir » → la vue classement complète existante.
- **(à faire)** En mobile, le podium passe en **1 colonne** (déjà géré).

### D. Créer ma grille
- **(maquette)** Bloc en bordure pointillée teal : eyebrow « Ma grille », titre (état « pas encore créé »), texte, bouton sombre **Créer ma grille**.
- **(données)** **État dynamique** : si l'utilisateur a déjà créé sa grille du jour, le contenu doit changer (titre + CTA → « Voir / modifier ma grille »). Reprendre la logique existante de création de grille et son action.
- **(à faire)** Le bouton garde son action actuelle (ouvre l'éditeur de grille / @dnd-kit).

### E. Grilles des autres joueurs
- **(maquette)** En-tête « Grilles des autres joueurs » + badge « Aujourd'hui · N ». Grille de **4 cartes** : avatar coloré (initiale), nom + rôle, puis 4 mini-stats (Statut, Niveau, Joueurs, Réussite). Carte cliquable (hover : léger lift).
- **(données)** Liste réelle des grilles communautaires du jour (Supabase). Chaque carte → navigue vers la grille correspondante (action existante). Le compteur « · N » = longueur réelle de la liste.
- **(à faire)** **Rendre la liste dynamique** (`.map`) — ne pas laisser 4 cartes en dur. Gérer l'état vide (aucune grille) et idéalement un état de chargement.

---

## 5. Delta fonctionnel — changements de structure à NE PAS rater

Ces points modifient l'architecture de l'info. À traiter explicitement :

1. **Progression collective → déplacée, pas supprimée.** Le bloc « Progression collective » (œuf 🥚, XP collectifs, niveaux marins) **n'est plus sur le Hub**. Il doit être **déplacé dans l'onglet `Classement`**. Conserver tout son code et ses données — c'est un déménagement, pas une suppression. *(L'onglet Classement n'est pas maquetté ici : reproposer plus tard, ou réutiliser le composant existant tel quel dans le nouvel onglet.)*
2. **Header refait.** Mapper chaque action de l'ancien header vers la nouvelle nav. Ne perdre aucune action (notamment déconnexion, réglages).
3. **Classement = celui de la grille du jour** uniquement (pas un classement global).
4. **Notion d'édition quotidienne** (« Édition N°142 » + date) : à brancher sur la **vraie logique de rotation journalière** (numéro d'édition = compteur de jours depuis le lancement, ou équivalent existant). Ne pas mettre en dur.
5. **Bloc vidéo = placeholder animé.** Pas de vidéo réelle pour l'instant ; l'animation CSS est définitive jusqu'à fourniture de la vidéo.

---

## 6. Responsive

Breakpoints définis dans la maquette :

- **≤ 920px** : héro (challenge + vidéo) passe en **1 colonne** (vidéo sous le challenge) ; podium classement en 1 colonne ; grilles des autres joueurs en **2 colonnes** ; titres réduits.
- **≤ 560px** (mobile) : header replié (logo + actions icônes + **burger** qui ouvre la nav ; prénom masqué) ; stats du héro sur **2 colonnes** ; bouton « Jouer » **pleine largeur** ; bloc « Créer ma grille » empilé ; grilles des autres joueurs en **1 colonne**.

La maquette `hub-v2.html` contient tout le CSS responsive — s'en servir comme référence exacte. Le mobile **est une exigence**, pas une option.

---

## 7. Ordre de travail imposé

1. **Inventaire** du Hub existant (composants, données, état, routes, handlers) → résumé validé par le PO **avant** tout code.
2. **Plan de redesign bloc par bloc** → validé **avant** tout code.
3. Implémentation **un bloc à la fois**, dans l'ordre : Header → A → B → C → D → E, puis le déménagement de la progression collective.
4. Après **chaque** bloc : vérifier que **l'app build** et que les fonctionnalités du bloc marchent encore (données réelles, navigation, actions).
5. Passe **responsive** finale (920 / 560).

Voir `PROMPT-CLAUDE-CODE.md` pour le prompt de démarrage.
