# Illustrations RAID — cahier des charges des assets

But : remplacer les créatures **vectorielles codées** par de **vraies illustrations**
dans le style « boss de jeu » (gros contours encrés, cell-shading, reflets brillants,
dégradés riches, pose dynamique menaçante) — cf. la référence crabe.

Le **fond aquatique animé**, la **profondeur**, l'**équipage** et les **réactions de
combat** restent gérés par le code (`RaidMonster2D`). Toi tu fournis **uniquement les
créatures** ; moi je les intègre + anime.

---

## 1) Format technique (pour chaque boss)

- **PNG à fond transparent** (alpha). Si l'outil ne sait pas, fond uni → on détoure.
- **Créature seule**, centrée, **plein corps**, pose dynamique tournée **vers le bas /
  le joueur** (elle menace l'équipage en contrebas), comme la réf crabe.
- **Haute résolution** : ~**1600 px** sur le plus grand côté (idéalement ×2 → 2400 px).
- **Pas** de texte, **pas** de filigrane, **pas** d'ombre portée au sol (je la rajoute).
- Style **cohérent entre les 5** (même prompt de base) pour une famille homogène.

⚠️ **Licence** : la réf crabe envoyée est un visuel **stock filigrané** → ne pas
l'embarquer. Génère/achète/commande des originaux libres de droits pour l'usage.

---

## 2) Où déposer les fichiers

```
public/raid/<boss>/full.png
```

avec `<boss>` ∈ `meduse` · `crabe` · `pieuvre` · `requin` · `leviathan`.

Exemple : `public/raid/crabe/full.png`.

Puis **décommente** la ligne correspondante dans [`src/lib/raidArt.js`](../../src/lib/raidArt.js)
et ajuste `width`/`height`/`y` selon les proportions de ton image. Tant qu'une ligne
est commentée, le boss s'affiche en vectoriel codé (rien ne casse).

### Niveau 2 (optionnel, plus tard) — pièces articulées
Pour que les **pinces claquent**, les **pattes/tentacules bougent** indépendamment,
fournis la créature **découpée** (corps + chaque pince/patte en PNG séparés) :
```
public/raid/crabe/corps.png
public/raid/crabe/pince-g.png
public/raid/crabe/pince-d.png
```
puis on passe l'entrée du manifeste au format `parts: [...]` (voir commentaires dans
`raidArt.js`). On peut commencer en `full` et basculer en `parts` sans rien refaire.

---

## 3) Prompts de génération (IA image)

**Préfixe de style commun** (à coller devant chaque créature) :

> video-game boss monster, comic-book vector illustration, thick bold black ink
> outlines, cel-shaded, glossy specular highlights, rich saturated gradient shading,
> dramatic dynamic menacing pose facing the viewer and slightly downward, high detail,
> full body, centered, isolated on plain white background, transparent background,
> no text, no watermark

**Par boss** (préfixe + ligne ci-dessous) :

- **meduse** — `a spectral glowing jellyfish sea monster, translucent dome bell, long flowing trailing tentacles, bioluminescent glowing spots, ghostly magenta purple and pink palette`
- **crabe** — `a colossal armored crab monster, huge oversized menacing pincer claws, spiky cracked shell, sharp legs, red and orange palette` *(= la réf)*
- **pieuvre** — `a giant abyssal octopus monster, large bulbous head, big expressive angry eyes, eight curling tentacles with suckers, deep purple and violet palette`
- **requin** — `a hammerhead shark monster, T-shaped hammer head with eyes on the ends, rows of sharp teeth, scars, steel blue and grey palette`
- **leviathan** — `a serpentine sea-dragon leviathan, long coiling scaly body, horned head, spiny dorsal fins, glowing eyes, teal green and emerald palette`

Génère **les 5 avec le même préfixe** pour garder une famille cohérente. Si l'outil ne
sort pas de transparent, prends fond blanc uni et détoure (remove.bg, etc.).

---

## 4) Et les matelots / le fond ?

Gardés en **vectoriel codé** pour l'instant (ils s'animent déjà : idle, sursaut,
flash). Si tu veux plus tard les passer en illustré dans le même style, même principe :
on ajoutera un manifeste équipage. Dis-le-moi et je prépare le brief.
