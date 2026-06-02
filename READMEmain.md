# Orienta — Mini-jeu de Rotation Quotidienne

Orienta est un mini-jeu collaboratif où les joueurs résolvent des grilles d'énigmes basées sur la rotation et la reconnaissance de mots. Le jeu combine une progression **collective** (toute la communauté progresse ensemble) avec une progression **individuelle** (XP, niveaux, skins).

---

## Gameplay

Une grille Orienta est un plateau 2×2 où :
- **4 cartes** contiennent chacune 4 mots (haut, bas, gauche, droite)
- **4 indices** donnent une piste pour chaque côté du plateau
- **Objectif** : placer les bonnes cartes aux bons emplacements, bien orientées
- **3 essais** maximum — feedback après chaque essai (bien placé / mal orienté / mauvais)

Scoring basé sur la vitesse et le nombre d'essais.

---

## Tech Stack

- **Frontend** : React 19, React Router v6, Framer Motion, Zustand, @dnd-kit
- **Backend** : Supabase (PostgreSQL, RPC, Edge Functions)
- **Styling** : CSS vanilla (`src/index.css`)

---

## Mise en Place

```bash
npm install

# Configurer .env
VITE_SUPABASE_URL=https://baqvosadoijsvvelugmp.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>

npm run dev
```

---

## Structure du Projet

```
src/
├── pages/           LoginPage, HubPage, PlayPage, CreatePage,
│                    ResultPage, DashboardPage, ProfilePage, DailyAdminPage
├── components/
│   ├── game/        WordCard, CloverGrid, CloverWithInputs
│   └── ui/          Header, GridCard, StaticMiniGrid, TourOverlay,
│                    TutorialModal, CollectiveGauge, LevelsModal,
│                    ReplayModal, StreakModal, ...
├── lib/             supabase, cardColors, scoring, levels, creatures,
│                    marineItems, useBodyScrollLock
├── stores/          authStore (Zustand)
└── index.css        Tous les styles
supabase/
├── functions/
│   └── check-attempt/  Validation server-side des essais
└── migrations/
```

---

## Fonctionnalités

**Jeu**
- Drag-and-drop des cartes vers la grille
- Rotation des cartes (↻)
- 3 essais avec feedback détaillé
- Persistance des essais en cours (retour possible en cours de partie)
- Tour guidé première visite
- Message d'erreur réseau si `check-attempt` échoue

**Création**
- 3 niveaux de difficulté (Facile / Moyen / Difficile)
- Chrono en Moyen/Difficile avec auto-publish ou forfait
- Validation : les indices ne peuvent pas être des mots des cartes
- Indices latéraux (Gauche/Droite) : saisie via overlay centré sur mobile, input direct sur desktop

**Hub**
- Grille du jour + archives 7 jours
- Grilles communautaires groupées par date
- Statut des parties (Non joué / En cours / Joué) avec code couleur

**Progression**
- XP individuel → 10 niveaux → skins emojis marins
- XP collectif → 10 niveaux → créatures emoji partagées
- Streak journalier avec bonus XP
- Leaderboard contributeurs

**Profil & Dashboard**
- Historique jouées/créées avec stats détaillées
- Lien vers `/result` pour revoir ses essais
- Solution complète de la grille
- Replay des essais via `ReplayModal`

---

## Documentation

| Fichier | Contenu |
|---|---|
| `AGENTS.md` | Guide pour agents IA et contributeurs (stack, DB, conventions) |
| `DESIGN.md` | Système de design (couleurs, typo, composants, animations) |
| `DECISIONS.md` | Décisions architecturales avec leurs trade-offs |
| `ROADMAP.md` | État d'avancement et prochaines étapes |

---

## Sécurité

RLS actuellement **désactivé** sur toutes les tables `orienta_*` (développement).  
À activer avec policies appropriées avant tout lancement public.

---

Contact : rodolphe.le.blevenec@gmail.com
