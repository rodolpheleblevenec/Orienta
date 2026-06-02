# Orienta — Design V2

> Document de design des deux écrans de référence :
> - **`index-v2.html`** → présente le **Hub** (`hub-v2.html`) en cadre desktop + mobile.
> - **`play-index-v2.html`** → présente la page **`/play`** (`play-v2.html`) en cadre desktop.
>
> Les fichiers `*-index-v2.html` sont des **vitrines de présentation** (chrome de navigateur + maquette de téléphone autour d'une `<iframe>`). Le vrai design vit dans `hub-v2.html` et `play-v2.html`. Ce document décrit le système commun puis chaque écran.

---

## 1. Principes

Direction V2 convergée : **fond neutre** (fini le beige), **cartes blanches à ombre douce**, **police Bricolage Grotesque** pour les titres/chiffres, **DM Sans** pour le texte, **accent teal** comme couleur de marque, et les **4 couleurs de cartes** issues du plateau de jeu. Header clair et sobre, aligné sur le jeu réel. Esthétique calme, ludique, lisible.

Les deux écrans partagent **exactement** le même header, les mêmes tokens et le même vocabulaire visuel — c'est ce qui assure l'homogénéité de l'app.

---

## 2. Design system (partagé)

### 2.1 Typographie
- **Display** — `Bricolage Grotesque` (400–800), titres, chiffres, mots des cartes, libellés de section. `letter-spacing:-0.025em` sur les titres, `line-height:1.05`.
- **Texte / UI** — `DM Sans` (400–700), `font-size:16px`, `line-height:1.5`.
- Import Google Fonts :
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
  ```

### 2.2 Couleurs (variables CSS)
```css
/* Surfaces neutres */
--bg:        #f1f2f3;   /* fond de page (+ trame de points) */
--bg-tint:   #eceeef;   /* survols, fonds discrets, puces */
--card:      #ffffff;   /* cartes, panneaux, header/footer */
--ink:       #1c2128;   /* texte principal */
--ink-2:     #5d6470;   /* texte secondaire */
--ink-3:     #9aa1ac;   /* texte tertiaire / placeholder */
--line:      rgba(28,33,40,0.09);  /* bordures (Hub) / 0.10 (Play) */
--line-2:    rgba(28,33,40,0.05);  /* bordures très discrètes */

/* Marque / accent (teal) */
--teal:      #0a9e84;   /* = --accent dans play-v2 */
--teal-700:  #08846f;   /* hover, texte sur clair */
--teal-soft: #e3f4ef;   /* fonds d'indices, pastilles, états actifs pâles */
--mint:      #9fe3d2;   /* dégradés, pulse "live" */

/* Identités de carte (FIXES — sémantique de jeu) */
--green:  #16a085;  --green-soft:  #dcf2ec;
--coral:  #f2603f;  --coral-soft:  #fde3dc;
--orange: #e8920e;  --orange-soft: #fcefd6;
--blue:   #2f6fd6;  --blue-soft:   #e0eafb;
--amber:  #d98a14;  /* niveau "Moyen" */

/* Feedback Mastermind (page /play) */
--fb-green:  #16a085; /* bien placé ET orienté */
--fb-orange: #e8920e; /* bonne orientation, mauvais emplacement */
--fb-red:    #f2603f; /* ni l'un, ni l'autre */
```
> ⚠️ Les 4 identités de carte (green/coral/orange/blue) et les 3 couleurs de feedback sont **sémantiques** : ne jamais les remplacer par le teal.

### 2.3 Rayons, ombres, fond
```css
--r:22px;  --r-sm:14px;  --r-pill:999px;       /* cartes de jeu : 18px */

--shadow:    0 18px 44px -22px rgba(20,30,45,0.30); /* héro */
--shadow-sm: 0 10px 26px -16px rgba(20,30,45,0.24); /* panneaux */
--shadow-xs: 0 2px 8px -4px   rgba(20,30,45,0.18);  /* survols légers */
--shadow-card: 0 14px 30px -20px rgba(20,30,45,0.40), 0 2px 6px -3px rgba(20,30,45,0.12); /* cartes /play */
```
Fond de page = `--bg` + trame de points :
```css
background-image: radial-gradient(rgba(28,33,40,0.04) 1px, transparent 1px);
background-size: 24px 24px;
```

### 2.4 Header (identique sur les deux écrans)
Barre **sticky** translucide (`rgba(241,242,243,0.82)` + `backdrop-filter: saturate(140%) blur(12px)`), bordure basse `--line`, contenu max 1200px, padding `14px 28px`, `gap:20px`.
- **Logo** : pastille teal 26×26 `radius:8px` portant une croix blanche (le « + »), puis « **Orienta** » (Bricolage 800, 22px, `--teal`).
- **Nav** : `Hub` / `Classement` / `Tutoriel` — DM Sans 14/600, `--ink-2` ; hover fond `--bg-tint` ; actif `--teal` + fond `--teal-soft`.
- *(spacer flexible)*
- **Série** : chip `--coral-soft`, flamme + chiffre, texte `--coral`, Bricolage 700, pill.
- **Boutons icônes** 38×38 `radius:11px`, `--ink-2`, hover `--bg-tint` : notifications, réglages.
- **Séparateur** 1×26 `--line`.
- **Profil** : avatar rond 32×32 dégradé `135deg,var(--teal),var(--green)`, initiale blanche + prénom (DM Sans 14/600).
- En mobile : nav repliée derrière un **burger**, prénom et séparateur masqués.

---

## 3. Écran « Hub » — présenté par `index-v2.html`

`index-v2.html` affiche `hub-v2.html` côte à côte : **cadre navigateur desktop** (≈1200px) et **maquette de téléphone** (390px), sur fond `#e4e6e7` à trame de points, avec un chapeau (eyebrow teal + titre Bricolage + paragraphe + bouton « Ouvrir le Hub en plein écran »).

### 3.1 Architecture du Hub (`hub-v2.html`)
Contenu centré, max **1200px**, padding latéral 28px. Deux grandes parties à en-têtes numérotés :

```
HEADER (sticky)

PARTIE 01 · « La grille du jour »   ← en-tête : 01 + titre + filet + dateline (Édition N°142 · date)
  └─ Groupe "today"
     ├─ HERO (2 colonnes 1.32fr / 1fr)
     │   ├─ Carte challenge : eyebrow, titre "La grille du jour" (Bricolage 800, 58px),
     │   │   paragraphe, 4 "spills" (Statut/Niveau/Réussite/Joueurs), bouton "Jouer la grille"
     │   │   (pill teal) + lien fantôme "Grilles précédentes"
     │   └─ MEDIA SLOT (fond sombre #10212b) : plateau 2×2 animé en boucle
     │       (4 tuiles couleur qui pivotent — @keyframes tileSpin 7s), badge "Découvrir le jeu",
     │       pastille "En boucle" (pulse mint), titre + sous-titre blancs.
     │       → réservé à la future vidéo motion.
     └─ CLASSEMENT DU JOUR (panel) : titre + sous-titre, podium 3 colonnes
         (médailles 1/2/3, nom, points teal)

PARTIE 02 · « La communauté »       ← en-tête : 02 + titre + filet
  ├─ CRÉER MA GRILLE (bloc bordure pointillée teal) : eyebrow "Ma grille",
  │   titre d'état, texte, bouton sombre "Créer ma grille" (pill, hover teal)  → mène à /create
  └─ GRILLES DES AUTRES JOUEURS : en-tête + tab "Aujourd'hui · 4",
      grille de 4 cartes joueur (avatar couleur + nom, mini-grille Statut/Niveau/Joueurs/Réussite),
      hover : élévation + ombre.
```

### 3.2 Composants notables du Hub
- **Spill** (statistique) : petite tuile `--bg` `radius:14px`, clé en capitales `--ink-3` + valeur Bricolage 19px. Variante `is-teal` (fond `--teal-soft`, valeur `--teal-700`).
- **Bouton principal** `.btn` : pill teal, Bricolage 700 16px, ombre teal portée, hover `translateY(-2px)` + `--teal-700`.
- **Media slot animé** : `demo-board` 188×188, 4 `.dtile` colorées (orange/green/blue/coral) avec flèche de rotation, animation `tileSpin` décalée par tuile ; pulse « live » `livePulse`. Respecte `prefers-reduced-motion`.
- **Podium / rangs** : lignes `--bg` `radius:14px`, médailles rondes dégradées (or/argent/bronze), points en `--teal-700`.
- **Bloc créer** : bordure `1.6px dashed rgba(10,158,132,0.4)`, `--shadow-xs`.
- **Carte joueur** `.pcard` : `--card` `radius:22px`, avatar carré 40×40 coloré, mini-grille 2×2 de stats.

### 3.3 Responsive du Hub
- **≤ 920px** : héro et duo en 1 colonne, cartes joueurs en 2 colonnes, titre héro 46px, podium en 1 colonne.
- **≤ 560px** : header replié (burger), prénom masqué ; spills sur 2 colonnes ; bouton « Jouer » pleine largeur ; bloc créer empilé ; cartes joueurs en 1 colonne.

---

## 4. Écran « /play » — présenté par `play-index-v2.html`

`play-index-v2.html` affiche `play-v2.html` dans un **cadre navigateur desktop** (chapeau eyebrow + titre + paragraphe + bouton « Ouvrir /play en plein écran (avec Tweaks) »). Une seule direction : **réserve à gauche** (le mobile sera une itération dédiée).

### 4.1 Architecture de `/play`
Page plein écran en colonne (header / zone de jeu / footer) :

```
HEADER (identique au Hub)

┌──────────┬─────────────────────────────────┬───────────────────┐
│ RÉSERVE  │           PLATEAU 2×2           │  DRAWER FEEDBACK  │
│  gauche  │   indices Haut/Bas/Gauche/Droite│   droite, 404px   │
│  222px   │       au cœur de la zone        │  (rétractable)    │
├──────────┴─────────────────────────────────┴───────────────────┤
FOOTER STICKY (essai, chrono, bouton à états, retour Hub)
```

### 4.2 Réserve (gauche, `flex:0 0 222px`)
Bordure droite `--line`, fond `rgba(255,255,255,0.35)`. En-tête « RÉSERVE · N cartes » (Bricolage 700, 12px, capitales) + sous-titre `--ink-3`. Liste verticale scrollable des cartes non posées.

### 4.3 Carte de jeu (`.gcard`) — style retenu « blanc doux »
Carrée, fond blanc, `border:1px solid var(--line)`, `--shadow-card`, `radius:18px`. **Pastille d'identité** (carré 14×14 `radius:5px`) en haut-gauche, couleur = identité. **4 mots** sur les arêtes (haut/bas centrés ; gauche/droite en `writing-mode:vertical-rl`, gauche pivoté 180°), Bricolage 700 **colorés** dans l'identité, capitales. **Rotation** par pas de 90° (bouton ↻ central au survol). Survol = légère élévation ; `:active` = `scale(.97)`.

### 4.4 Plateau 2×2 + indices
Grille 2×2, `gap:18px`, fond `rgba(28,33,40,0.018)`, `radius:24px`. **Emplacements** pointillés (`2px dashed`), fond `rgba(255,255,255,0.5)`, `radius:18px`, icône fantôme ; état « cible » teal. **4 indices** (ex. *Ferme / Cire / Epaisse / Roues*) en pastilles `--teal-soft` / texte `--teal-700` Bricolage ~23px ; gauche/droite verticaux. **Les indices restent contenus dans la zone du plateau** (padding ~`72px 96px` autour de la grille) — ils ne débordent jamais sur la réserve ni le drawer. Le plateau est l'élément central et reste visuellement au cœur de la page.

### 4.5 Drawer de feedback (droite, 404px, rétractable)
Panneau `--card`, bordure gauche `--line`, ombre portée. En-tête « **Feedback** » + sous-titre. Contenu :
1. **Onglets Essai 1 · 2 · 3** : pleine largeur ; essais joués cliquables, à venir **verrouillés** (cadenas) ; actif = fond `--teal`, blanc, ombre teal.
2. **Score global** : grand chiffre Bricolage 800 40px teal + « /4 ».
3. **Scorecard par comptage** : 3 tuiles (verte `--green-soft`, orange `--orange-soft`, rouge `--coral-soft`), chacune = grand nombre + titre (avec pastille) + descriptif. **On indique COMBIEN de cartes** par cas, **jamais lesquelles** (le joueur doit déduire).
4. **« Ta configuration »** : mini-grille 2×2 (~164px) reconstituant le **placement + l'orientation** des cartes posées à l'essai sélectionné, entourée des 4 indices — pour revoir ses essais sans les refaire. Changer d'onglet change scorecard ET mini-grille.
5. **Encart d'aide** (fond `--bg-tint`, ampoule) rappelant la règle.

**Rétraction** : la croix ferme le drawer (le plateau reprend la largeur) et un **onglet vertical « Feedback »** apparaît au bord droit (fond teal, texte vertical + icône) pour le rouvrir.

### 4.6 Footer sticky
Barre translucide, contenu centré (max ~1100px) : à gauche chips « Essai N/3 » (+ 3 puces, active teal) et chrono ; au centre **bouton à états** `.submit` (« X cartes à placer » en `is-wait` pâle → « Valider l'essai » en `is-ready` teal plein) ; à droite « Retour au Hub » (`.hub-btn` clair).

### 4.7 Interactions
Poser une carte (drag&drop réel dans l'app ; clic dans la maquette) → halo sur l'emplacement ; retirer ; pivoter (↻) ; bouton qui passe prêt à 4/4 ; valider → enregistre l'essai, déverrouille l'onglet suivant, ouvre le drawer, réinitialise le plateau ; onglets pour revoir chaque essai ; fermer/rouvrir le drawer ; réinitialiser.

> **Note moteur (maquette)** : le coulissé du drawer et l'onglet de réouverture sont pilotés par bascule de `transform` **inline en JS**, car la transition CSS se fige dans l'outil de prototypage. En production (React/Framer Motion), utiliser une vraie transition — c'est la cible visuelle, pas la méthode d'animation.

---

## 5. Réglages de maquette (« Tweaks », hors production)

`play-v2.html` embarque un panneau de réglages de maquettage (`play-tweaks.jsx`) pour explorer des variantes : position de la réserve (gauche / dock bas), densité du plateau, **style de carte** (bord coloré / blanc doux / teinté / étiquette), couleur des mots, arrondi, accent. **Direction retenue** : réserve à gauche, **carte « blanc doux » + mots colorés + rayon 18px**, accent teal. Les autres variantes sont des outils d'exploration, pas la cible.

---

## 6. Cartographie des fichiers

```
index-v2.html        ← vitrine du Hub (desktop + mobile) → iframe hub-v2.html
hub-v2.html          ← design réel du Hub (header, grille du jour, communauté)

play-index-v2.html   ← vitrine de /play (desktop)        → iframe play-v2.html
play-v2.html         ← design réel de /play (réserve, plateau, drawer, footer)
play-logic.js        ← interactions simulées de /play (référence de comportement)
play-tweaks.jsx      ← panneau de réglages de maquette (hors prod)
tweaks-panel.jsx     ← dépendance du panneau de réglages
```
