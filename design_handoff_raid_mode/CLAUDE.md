# CLAUDE.md — Directive d'implémentation · Refonte du mode RAID (Orienta)

> Ce fichier est **prioritaire**. Lis-le en entier avant d'écrire une ligne de code, puis
> reporte-toi à `README.md` pour les valeurs exactes (tokens, tailles, copie, écran par écran).

---

## 🎯 Règle d'or
Recréer les écrans du mode RAID **exactement** comme dans ce handoff. Fidélité **haute** :
layout, tokens (couleurs/espacements/typo/rayons/ombres), copie FR, composants et interactions
doivent être **identiques** à la référence HTML fournie.

**Pas de réinterprétation. Pas d'« amélioration ». Pas de substitution** de couleurs, de polices,
d'espacements, de structure d'écran ou de wording. Si un détail n'est pas clair, reproduis ce que
montrent les fichiers `Refonte RAID.html` / `Refonte RAID — Mobile.html` (ou `preview*.html`,
plus simples à lire) — ne devine pas, n'invente pas.

---

## ⚠️ LA SEULE EXCEPTION : le visuel du boss (la baleine / le monstre)
C'est **le seul élément** que tu ne dois **pas** recréer depuis ces maquettes.

- **Conserve les visuels du monstre déjà présents dans le codebase** :
  `src/components/raid/RaidMonster.jsx` (qui choisit le modèle 3D `.glb` ou la scène 2D
  vectorielle `RaidMonster2D.jsx` / `RaidWhale.jsx`). On garde ces visuels actuels tels quels.
- Dans les maquettes, le boss est un **placeholder** : un disque « abysse » avec un emoji 🐋
  (classes `.rd-boss`, `.rd-boss-disc`, `.rd-boss-emoji`, anneaux `.rd-boss-rings`, éclats
  `.rd-impact`). **Remplace ce placeholder** par le composant monstre existant.
- Tu as le droit d'**adapter légèrement l'UI autour** du monstre (cadrage, dimensions, position
  dans la scène teal, halo derrière lui) pour qu'il s'intègre proprement à la nouvelle scène
  « abysses ». **C'est la seule liberté autorisée**, et elle se limite au voisinage immédiat du boss.

> Autrement dit : **monstre = existant**, **tout le reste = ce handoff**.

---

## ✅ Tout le reste doit être STRICTEMENT conforme au handoff
- **Scène « abysses »** : gradient teal profond, trame de points masquée, halo, bulles, anneaux
  sonar, barre de PV corail, vignette, bandeau d'infos boss → reproduire avec les tokens custom
  `--rd-*` documentés dans `README.md` (la scène en elle-même est nouvelle ; seul le *monstre*
  dedans est l'existant).
- **Lobby** : cartes de rôle avec le bloc **« Voit 👁 / Fait ✋ / Aveugle 🚫 »**, état « Ton rôle »,
  barre « Je suis prêt » + points de progression.
- **Combat** : **lentille de rôle** (« Tu joues : … »), **plateau 2×2** (composant DS
  `PuzzleBoard`, feedback couleurs), barre Capitaine (Valider / Sonar 1× / Partager les couleurs),
  rail d'équipage.
- **Chat** : colonne dédiée (desktop) / onglet plein écran (mobile), messages **tagués par rôle
  et couleur**, bulle « moi » en teal.
- **Cinématique** + **Résultats** (victoire / défaite) : badges, stats, **jauge XP collective**
  (`XPGauge`), récap équipage, actions — au pixel.
- **Mobile** : onglets segmentés **Rôles ⇄ Chat** (lobby) et **Plateau ⇄ Chat** (combat) ; zones
  safe iPhone (status bar ~52px haut, home indicator ~34px bas) ; barre « Prêt » fixée en bas.
- **Effets de combat réglables** via `--fx` (défauts : intensité **0.30**, éclats **ON**,
  vignette **OFF**).

---

## 🧱 Comment porter (codebase réel)
- Stack : **React 19 + Vite, CSS vanilla** (pas de Tailwind, pas de CSS-in-JS). Repo
  `rodolpheleblevenec/Orienta`, branche `master`.
- Recréer dans **`src/pages/raid/`** et **`src/components/raid/`** (remplacer / restyler les écrans
  RAID existants : `RaidArenaPage`, `RaidResultView`, `RosterBoard`, `RaidChat`, etc.).
- Styles : ajouter les tokens custom `--rd-*` au `:root` (ou un fichier raid), **réutiliser** les
  variables existantes du design system pour tout le reste.
- **Réutiliser les composants existants** (`WordCard` / `PuzzleBoard`, boutons, `XPGauge`, avatars,
  pills). **Ne réimplémente pas** le plateau à la main.
- La **visibilité par rôle** (qui voit indices / mots / couleurs) reste appliquée **côté serveur**
  (Edge Function Supabase `supabase/functions/raid/`) — l'UI ne fait que refléter ces droits.

---

## ✔️ DO / ❌ DON'T
**DO**
- Reprendre les **valeurs exactes** du `README.md` (hex, tailles px, rayons, ombres, copie FR).
- Garder la **copie française mot pour mot** (voix chaleureuse, tutoiement, célébration collective).
- Intégrer le **monstre existant** à la place du placeholder.

**DON'T**
- ❌ Changer palette, typo, rayons, espacements ou structure des écrans.
- ❌ Inventer de nouveaux composants, icônes ou illustrations.
- ❌ Redessiner / remplacer le monstre (on garde l'existant) — ni l'inverse, ne pas garder le
  placeholder emoji.
- ❌ Modifier le reste de l'app (hors mode RAID).
- ❌ Prendre des libertés « créatives » ailleurs que dans le cadrage immédiat du boss.

---

→ **Spécifications complètes, tokens et détail écran par écran : `README.md`.**
