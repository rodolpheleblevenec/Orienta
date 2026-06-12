# Orienta — instructions projet

Contexte technique détaillé : voir `AGENTS.md`.

## Journal des nouveautés — à tenir à jour AUTOMATIQUEMENT

Le jeu affiche un changelog destiné aux joueurs dans **Profil → onglet « Nouveauté »**,
alimenté par le tableau `CHANGELOG` de [`src/lib/changelog.js`](src/lib/changelog.js).

**Règle permanente (sans qu'on te le redemande) :** dès qu'une feature **utilisateur
impactante** est livrée (déployée et/ou poussée), **ajoute une entrée en tête** du tableau
`CHANGELOG` :

- `date` : date de mise en ligne au format `AAAA-MM-JJ` (la date du jour) ;
- `emoji` : un emoji d'illustration ;
- `title` : titre court, orienté joueur ;
- `items` : 1 à 6 puces décrivant ce qui change, **formulées pour un joueur** (pas de
  jargon technique, pas de noms de fichiers/fonctions).

Précisions :
- Regroupe plusieurs petites évolutions livrées le même jour en **une seule** entrée.
- N'ajoute **pas** d'entrée pour des correctifs internes invisibles côté joueur
  (refactors, fixes techniques, sécurité non visible).
- L'entrée la plus récente est toujours en **première** position du tableau.
