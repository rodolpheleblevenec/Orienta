# Handoff : Refonte du mode RAID (desktop + mobile)

> 🔴 **Lis d'abord `CLAUDE.md`** (à la racine de ce dossier) : c'est la directive d'implémentation
> stricte. En résumé : **reproduire ce handoff à l'identique**, fidélité haute, **sans réinterpréter**.
> **Seule exception** → le **visuel du monstre/baleine** : garder les visuels existants du codebase
> (`src/components/raid/RaidMonster.jsx`) et seulement adapter légèrement le cadrage autour.
> Tout le reste (scène, layout, tokens, copie, composants, interactions) = **conforme à ce handoff**.

## Overview
Refonte complète de l'**expérience du mode RAID** d'Orienta — le mode coopératif temps réel
où un équipage de 3 à 8 joueurs affronte ensemble un boss marin (« Le Rorqual colossal » 🐋)
sur le plateau 2×2 habituel d'Orienta, chacun avec un **rôle secret** aux pouvoirs uniques.

La refonte couvre **uniquement le mode RAID** (pas le reste de l'app). Elle existe en deux
formats :
- **Desktop large** (`Refonte RAID.html`)
- **Mobile / iPhone** (`Refonte RAID — Mobile.html`)

Direction artistique : **« Les abysses chaleureux »** — une *scène* en teal profond porte le
boss et le combat (ambiance forte, dramatique), tandis que **toute l'UI de contrôle reste sur
la surface claire pointillée d'Orienta**, avec ses cartes blanches arrondies. Intensité en
haut, ADN Orienta (rondeur, chaleur, teal) partout ailleurs.

Deux partis pris UX structurants par rapport à l'existant :
1. **Rendre lisible l'information asymétrique** : chaque rôle affiche explicitement ce qu'il
   **voit** (👁) vs ce qu'il **fait** (✋). Une « lentille de rôle » rappelle ses pouvoirs en combat.
2. **Élever le chat au rang d'outil principal** : la coordination devient une colonne dédiée
   (desktop) ou un onglet plein écran (mobile), avec messages **tagués par rôle et couleur**.

---

## About the Design Files
Les fichiers de ce bundle sont des **références de design réalisées en HTML/CSS/React (JSX via
Babel in-browser)** — des prototypes qui montrent l'apparence et le comportement voulus, **pas
du code de production à copier tel quel**.

La tâche est de **recréer ces écrans dans l'environnement du codebase cible**. Le codebase réel
d'Orienta est **React 19 + Vite, React Router, Zustand, Framer Motion, @dnd-kit, Supabase, CSS
vanilla** (dépôt `rodolpheleblevenec/Orienta`, branche `master`). Les écrans RAID actuels vivent
dans `src/pages/raid/` et `src/components/raid/`, et tous les styles dans `src/index.css`.
Il s'agit donc de **remplacer / restyler** ces écrans existants en suivant les patterns du repo
(composants React, CSS vanilla, tokens du `:root`), en reprenant fidèlement les valeurs ci-dessous.

> Le mode RAID est **volontairement hors périmètre du design system Orienta** (« mode sombre
> séparé »). La scène abysses utilise donc des tokens custom documentés plus bas ; tout le reste
> (boutons, plateau, jauge XP, cartes, pills, avatars) doit utiliser les composants/tokens du DS.

---

## Fidelity
**High-fidelity (hifi).** Couleurs, typographie, espacements, rayons, ombres et états sont
définitifs. Recréer l'UI **au pixel près** avec les composants/styles existants du codebase.
Le contenu (textes FR) est aussi définitif et doit être repris **mot pour mot**.

**Conformité stricte exigée.** Ne pas réinterpréter, ne pas substituer couleurs/polices/espacements,
ne pas modifier la structure des écrans, ne pas inventer de composants ni d'illustrations. En cas
de doute sur un détail, reproduire ce que montrent les fichiers HTML fournis.

**Unique exception : le visuel du boss (baleine/monstre).** Le disque + emoji 🐋 des maquettes est un
*placeholder* à remplacer par le **rendu du monstre existant** du codebase
(`src/components/raid/RaidMonster.jsx` → 3D `.glb` ou 2D `RaidMonster2D.jsx`/`RaidWhale.jsx`).
Adaptation légère autorisée **uniquement** dans le cadrage immédiat du boss (taille, position,
halo). Voir `CLAUDE.md`.

---

## Contexte de jeu (nécessaire pour implémenter)
- **But** : vaincre le boss en équipe. Il a des **PV** (ex. 300) répartis sur **N assauts**
  (ex. 3). Chaque assaut = résoudre une grille 2×2 (placer/tourner 4 cartes pour que chaque
  bord corresponde à son indice), en un temps limité (timer), avec des essais comptés.
- **Bouées 🛟 = vies de l'équipage.** Un échec / timeout en coûte une.
- **Rôles (« organes »)** au palier 3 (3 joueurs) :
  - **Œil 🔭** — *voit* les indices ET les mots ; *dicte* à la Main quoi poser/tourner.
  - **Main ✋** — ne voit rien ; *place* et *tourne* les cartes (en aveugle, suit les consignes).
  - **Capitaine 🧭** — *voit les couleurs* (feedback Mastermind après essai) ; seul à *valider*
    l'essai ; dispose du **Sonar** (sonde 1 carte/assaut pour savoir si elle est parfaite).
  - Paliers supérieurs (4→8 joueurs) scindent ces rôles (Vigie, Cartographe, Timonier,
    Mécanicien) puis ajoutent des périls (Navigateur, Sonar, Horloger). **Non couverts par cette
    refonte** (seul le palier 3 est maquetté), mais l'architecture des écrans doit rester
    extensible.
- **Feedback Mastermind** par carte : `correct` (bien placée), `rotation` (bonne carte,
  mauvaise orientation), `wrong` (mauvaise). Couleurs sémantiques fixes (voir tokens).
- **Issue** : victoire → temps de clear, classement de la semaine, **XP collectif** offert à
  toute la communauté. Défaite → assauts franchis, record à battre.

---

## Écrans / Vues

### DESKTOP (`Refonte RAID.html`) — cadre 1280 px de large
Mise en page récurrente : **topbar** translucide collante (brand Orienta + badge « ⚔️ Raid » +
pill « N en mer » + bouton Quitter) → **scène** (bandeau abysses teal) → **zone de contrôle**
(surface claire pointillée).

1. **Lobby — choix des rôles**
   - *But* : former l'équipage avant le combat.
   - *Layout* : scène (boss + nom + chips de difficulté) ; sous elle, 2 colonnes :
     gauche `1fr` = kicker « 01 — Formez l'équipage » + intro + **3 cartes de rôle** (grille 3
     colonnes) + barre de préparation ; droite `384px` = panneau Chat (h 360) + panneau « Record
     de la semaine ».
   - *Carte de rôle* : tuile emoji (46×46, r 14, fond `--teal-soft`, ou `--teal` si c'est le
     tien) + nom (Bricolage 800, 19px) + tagline + bloc **pouvoirs** (lignes « 👁 Voit / ✋ Fait /
     🚫 Aveugle » avec une pastille colorée : bleu pour *voit*, teal pour *fait*, gris pour
     *aveugle*) + pied (avatar du détenteur + « ✓ prêt », ou « ＋ Prendre ce rôle »). État *mine* :
     bordure teal + halo `0 0 0 3px rgba(10,158,132,.12)` + badge « Ton rôle ».
   - *Barre de préparation* : bouton primaire « ✓ Je suis prêt » + statut + « 2/3 prêts » + 3
     points (teal = prêt).

2. **Combat — vue Capitaine** *(écran le plus important)*
   - *But* : résoudre l'assaut en coordination ; le Capitaine valide.
   - *Layout* : scène combat (boss avec anneaux sonar + éclats d'impact, chips Assaut 2/3 /
     timer / bouées, **barre de PV** corail, **rail d'équipage** vertical superposé en haut à
     droite) ; sous elle : **lentille de rôle** (« Tu joues : Capitaine… ») pleine largeur ;
     puis 2 colonnes : gauche `1fr` = **plateau 2×2** (composant DS `PuzzleBoard`, feedback
     couleurs visible) + barre Capitaine (Valider l'essai / Sonar 1× avec 4 boutons de slot
     N-O/N-E/S-O/S-E / Partager les couleurs) ; droite `384px` = panneau **Chat** (h 470,
     messages tagués par rôle).
   - *Rail d'équipage* : pastilles translucides (avatar + emoji de rôle + nom), état « parle »
     surligné teal + 💬.

3. **Cinématique de fin (victoire)**
   - Plein écran abysses. Boss qui **s'enfonce** (animation `rd-sink`), badge doré « ⚔️ Victoire
     d'équipage », titre « Le Rorqual colossal est vaincu ! » (Bricolage 800, 46px, blanc),
     sous-titre, avatars d'équipage qui sautillent, bouton « Voir le résultat → ».

4. **Résultat — victoire / défaite** (2 variantes)
   - Retour à la surface claire. Carte centrée (max 720px) : liseré haut (teal si victoire,
     gris si défaite), emoji (🏆 / 🌑) sur tuile, badge, titre (32px), sous-titre, **3 stats**
     (victoire : Temps de clear / Classement 🥇 doré / XP collectif ; défaite : Assauts franchis
     / Record à battre / Boss restant), **jauge XP collective** (composant DS `XPGauge`, victoire
     seulement), récap équipage (« générique de fin » : avatar + emoji de rôle), actions
     (Rejouer / Partager / Retour au hub).

5. **Direction & système** (panneau de note, non-écran de jeu) : explicite le parti pris et la
   palette — utile à lire mais pas à implémenter.

### MOBILE (`Refonte RAID — Mobile.html`) — cadre iPhone 402×874
Zone de status bar (~52px haut) et home indicator (~34px bas) réservées. Topbar compacte
(brand + badge Raid + pill online).

1. **Lobby — Rôles** : scène compacte (boss + nom + chips) → **contrôle segmenté `[🎭 Rôles | 💬
   Chat]`** (Rôles actif) → intro courte → **cartes de rôle empilées** (tuile emoji + nom +
   pastilles « 👁 indices+mots / 🗣 dicte… » + détenteur/« Prendre ») → **barre « Je suis prêt »**
   fixée en bas.
2. **Lobby — Chat** : barre boss slim → segmenté `[Rôles | Chat]` (Chat actif) → **chat plein
   écran** (salon d'attente, messages tagués par rôle + saisie).
3. **Combat — Plateau** : en-tête abysses (boss + chips + barre de PV + bande d'avatars
   d'équipage horizontale) → segmenté `[🧩 Plateau | 💬 Chat (3)]` (Plateau actif) → lentille de
   rôle compacte → **plateau 2×2** (`PuzzleBoard size=64`, `--clue-rail:44px`) → actions
   empilées (Valider l'essai pleine largeur + bloc Sonar avec 4 boutons de slot).
4. **Combat — Chat** : barre boss slim (PV / assaut / timer) → segmenté (Chat actif) → **chat
   plein écran** + saisie.
5. **Cinématique (victoire)** : plein écran abysses, boss, badge, titre 2 lignes, équipage,
   bouton « Voir le résultat → ».
6. **Résultat — victoire / défaite** : carte top (emoji/titre/sous-titre) + **3 stats** (grille
   3 col) + jauge XP (victoire) + récap équipage (pills) + actions empilées pleine largeur.

> **Décision mobile clé** : impossible d'afficher plateau + chat côte à côte → ils deviennent
> **2 onglets** (segmented control) sur le Combat *et* sur le Lobby. Chaque onglet est plein
> écran ; un badge de notification (corail) sur l'onglet Chat signale les nouveaux messages.

---

## Interactions & Behavior
- **Lobby** : taper une carte de rôle libre la réclame ; retaper la sienne la libère ; bouton
  « Prêt » bascule l'état ; quand les 3 rôles sont pris ET prêts, un **décompte de 5 s** lance la
  partie automatiquement (cf. logique serveur du repo). Onglets Rôles/Chat.
- **Combat** : la Main place/tourne (drag + tap rotation), le Capitaine appuie « Valider » (actif
  seulement si 4 cartes posées), « Sonar » sonde un slot (1×/assaut), « Partager les couleurs »
  diffuse le feedback. Onglets Plateau/Chat (mobile).
- **Animations** (toutes douces, signature Orienta) :
  - rotation de carte : `cubic-bezier(0.34,1.56,0.64,1)` (léger dépassement), 90°.
  - entrées : fade-and-rise `cubic-bezier(0.16,1,0.3,1)`.
  - barre de PV / XP : remplissage `~1s`.
  - boss en combat : *bob* lent ; anneaux *sonar* ; à l'impact : anneau + éclats (intensité
    réglable). Victoire : boss qui *coule* (`rd-sink`) + équipage qui *cheer* + confettis (le
    proto réel utilise `canvas-confetti`).
  - Tout est gardé par `@media (prefers-reduced-motion)`.
- **Effets de combat réglables** (panneau « Tweaks » des prototypes — à exposer ou non en prod) :
  une variable CSS `--fx` (0→1) pilote l'opacité du halo, la taille de l'anneau/éclats d'impact,
  l'intensité de l'ombre de la barre de PV, l'opacité des bulles, et l'amplitude de la vignette.
  Défauts retenus : **intensité 0.30, éclats ON, vignette OFF**.

## State Management
Variables d'état nécessaires (le serveur reste l'autorité — voir
`supabase/functions/raid/index.ts` du repo) :
- session : `status` (waiting/active/won/lost), `boss_key`, `boss_level`, `current_hp`,
  `max_hp`, `assault_index`, `assault_count`, `lives`, `assault_deadline`, `sonar_used`.
- roster : liste `{ user_id, pseudo, role, is_ready }`.
- vue locale du joueur : `role`, `clues`/`words`/`feedback` (selon ce que le rôle a le droit de
  voir), `board` (placements), `card_order`.
- chat : messages temps réel `{ pseudo, role, text }` (+ messages système).
- résultat : `clear_seconds`, `rank {position,total}`, `best_clear_seconds`, `xp_awarded`.

## Design Tokens

### Tokens du design system Orienta (à réutiliser tels quels — source : `_ds/.../tokens/`)
**Couleurs**
- Marque : `--teal #0a9e84`, `--teal-700 #08846f`, `--teal-soft #e3f4ef`, `--mint #9fe3d2`.
- Surfaces : `--bg #f1f2f3` (+ trame de points), `--bg-tint #eceeef`, `--card #ffffff`.
- Encres : `--ink #1c2128`, `--ink-2 #5d6470`, `--ink-3 #9aa1ac`.
- Hairlines : `--line rgba(28,33,40,.09)`, `--line-2 rgba(28,33,40,.05)`.
- Identités de cartes (FIXES, jamais recolorées) : `--green #16a085`, `--coral #f2603f`,
  `--orange #e8920e`, `--blue #2f6fd6`, `--violet #7030E0` (+ leurs `*-soft`). `--amber #d98a14`.
- Feedback Mastermind : `--fb-green #16a085`, `--fb-orange #e8920e`, `--fb-red #f2603f`.

**Trame de points (signature)** : `radial-gradient(rgba(28,33,40,.04) 1px, transparent 1px)`
à `24px`, sur `--bg`.

**Typo** : `--display: 'Bricolage Grotesque'` (titres, nombres, mots de cartes, pills — tracking
serré −0.02 à −0.035em) ; `--sans: 'DM Sans'` (corps/UI, 16px, line-height 1.5/1.6). Eyebrows :
11–12px, uppercase, `letter-spacing .06em`, `--ink-3`.

**Rayons** : `--r 22px` (cartes/panneaux/modales), `--r-card 18px` (cartes-puzzle/slots),
`--r-sm 14px` (inputs/chips), `--r-pill 999px` (pills, CTA, avatars).

**Ombres** (froides, étalement négatif) : `--shadow-xs`, `--shadow-sm` (cartes au repos),
`--shadow` (hover/héros), `--shadow-card` (cartes-puzzle). Valeurs exactes dans
`_ds/.../tokens/spacing.css`.

**Espacement** : échelle `--space-1..8` = 4/8/12/16/18/24/28/32px.

**Motion** : `--ease cubic-bezier(.16,1,.3,1)`, `--ease-spring cubic-bezier(.34,1.56,.64,1)`,
`--dur-fast .15s`, `--dur .18s`.

### Tokens CUSTOM de la scène RAID (définis dans `raid.css`, scope `.rd` / `.rdm`)
Le RAID étant hors DS, ces valeurs lui sont propres :
- `--rd-deep #062a25` (abysse le plus profond), `--rd-deep-2 #0c3f37`, `--rd-deep-3 #14564b`.
- `--rd-glow rgba(20,190,160,.55)` (halo teal).
- Textes sur fond sombre : `--rd-on-deep rgba(255,255,255,.94)`,
  `--rd-on-deep-2 rgba(214,238,232,.72)`, `--rd-on-deep-3 rgba(180,214,206,.5)`.
- Traits/fills sur sombre : `--rd-stroke rgba(255,255,255,.12)`, `--rd-fill rgba(255,255,255,.07)`.
- Fond de scène : `radial-gradient(130% 105% at 50% -8%, --rd-deep-3, transparent 48%),
  radial-gradient(120% 120% at 50% 120%, rgba(8,80,68,.55), transparent 55%),
  linear-gradient(178deg, --rd-deep-2, --rd-deep 88%)`.
- Trame de points version claire (sur sombre) : points `rgba(255,255,255,.05)` à `26px`, masqués
  en radial.
- **PV (boss)** : remplissage `linear-gradient(90deg, #f2603f, #ff8a5c)` ; lueur corail.
- Badge victoire (doré) : `linear-gradient(135deg, #ffd166, #ffb02e)`.
- `--fx` (0→1) : intensité des effets de combat (voir Interactions).

## Assets
- `assets/logo-icon.svg` — logo Orienta (tuile arrondie blanche + glyphe de rotation teal
  `#0E9A7D`). Issu du design system. **Utiliser le logo existant du codebase** en prod.
- **Boss 🐋 (monstre)** : dans les maquettes c'est un **placeholder** — emoji sur un disque
  « abysse » (`.rd-boss-disc` / `.rd-boss-emoji`). **À NE PAS reproduire.** Conserver le **visuel
  existant du monstre** : `RaidMonster.jsx` (3D `.glb` ou 2D `RaidMonster2D.jsx` / `RaidWhale.jsx`)
  déjà présent dans `src/components/raid/`. L'intégrer dans la nouvelle scène teal en adaptant
  seulement son cadrage. (Cf. `CLAUDE.md`.)
- **Icônes fonctionnelles** : style feather/Lucide (24px, `stroke-width:2`, `currentColor`).
  Utiliser Lucide (ou les SVG inline du repo).
- **Emojis** comme iconographie de jeu (rôles, bouées 🛟, récompenses 🏆) — à reproduire avec de
  vrais glyphes emoji, pas redessinés.
- Polices : Google Fonts (Bricolage Grotesque + DM Sans), déjà importées par
  `_ds/.../tokens/fonts.css`.

## Files (dans ce bundle)
**Livrables (à ouvrir dans un navigateur — JSX compilé par Babel in-browser)**
- `Refonte RAID.html` — desktop (canvas pan/zoom de tous les écrans desktop).
- `Refonte RAID — Mobile.html` — mobile (cadres iPhone de tous les écrans mobiles).
- `preview.html` / `preview-mobile.html` — **vues empilées simples** (sans canvas), plus faciles
  à screenshoter / lire écran par écran.

**Sources du design**
- `raid.css` — styles desktop + tous les **atomes partagés** (scène, boss, PV, chips, chat,
  cartes de rôle, résultat) — c'est la référence visuelle principale.
- `raid-mobile.css` — surcouche de mise en page mobile (réutilise les atomes de `raid.css`).
- `raid-parts.jsx` — composants partagés (Topbar, StageBg, Boss, HpBar, Lives, CrewRail,
  RoleLens, Chat) + données de rôles `RAID_ROLES` + helpers.
- `raid-screens.jsx` — écrans desktop (Lobby, Combat, Cinematic, Result, HallOfFame, DirectionDoc).
- `raid-mobile.jsx` — écrans mobiles (MLobby, MLobbyChat, MCombatBoard, MCombatChat, MCinematic,
  MResult) + briques mobiles.

**Design system Orienta (référence de tokens & composants)**
- `_ds/orienta-design-system-.../` — tokens (`tokens/*.css`), classes composant
  (`components/components.css`), `styles.css`, et bundle React `_ds_bundle.js` exposant
  `window.OrientaDesignSystem_50c4c1` : `Button`, `Card`, `Badge`, `Avatar`, `StatPill`,
  `IconButton`, `TextField`, `SectionKicker`, `XPGauge`, `WordCard`, `PuzzleBoard`, `CARD_COLORS`.
  Les composants utilisés par la refonte : **`PuzzleBoard`**, **`Button`**, **`XPGauge`**.

**Scaffolding de présentation (NON à porter — purement outils de maquette)**
- `design-canvas.jsx` (canvas pan/zoom), `tweaks-panel.jsx` (panneau de réglages), `ios-frame.jsx`
  (cadre iPhone). À ignorer côté production.

---

## Notes d'implémentation
- Recréer dans `src/pages/raid/` + `src/components/raid/` du repo Orienta, en CSS vanilla, en
  reprenant les classes/variables du `:root` existant + les tokens custom `--rd-*` ci-dessus.
- Réutiliser les composants existants (`WordCard`/`PuzzleBoard`, boutons, jauge XP) ; ne pas
  réimplémenter le plateau à la main.
- Le serveur (Edge Function Supabase) reste l'autorité anti-triche : la visibilité par rôle
  (qui voit indices/mots/couleurs) doit être appliquée côté serveur, pas seulement masquée au client.
- Conserver le contenu FR tel quel (voix chaleureuse, tutoiement, célébration collective).
