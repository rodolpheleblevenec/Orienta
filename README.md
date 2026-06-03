# Orienta — Jeu de Rotation Quotidien

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
- **Styling** : CSS vanilla (`src/index.css`) — design system V2 (tokens teal, typographies Bricolage Grotesque + DM Sans)

---

## Mise en Place

```bash
npm install

# Configurer .env
VITE_SUPABASE_URL=https://baqvosadoijsvvelugmp.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>

npm run dev
# → localhost:5173
```

---

## Structure du Projet

```
src/
├── pages/
│   ├── login/       LoginPage.jsx
│   ├── hub/         HubPage.jsx         — grilles du jour + communautaires
│   ├── play/        PlayPage.jsx        — jeu drag-drop + drawer feedback
│   ├── create/      CreatePage.jsx      — composition de grille (3 difficultés)
│   ├── result/      ResultPage.jsx      — score + solution + replay essais
│   ├── classement/  ClassementPage.jsx  — leaderboard contributeurs
│   ├── tutoriel/    TutorielPage.jsx    — tutoriel interactif
│   ├── dashboard/   DashboardPage.jsx   — stats créateur + solution
│   ├── profile/     ProfilePage.jsx     — XP, skins, historique
│   └── admin/       DailyAdminPage.jsx  — gestion grille du jour (admin)
├── components/
│   ├── game/        WordCard, CloverGrid, CloverWithInputs
│   └── ui/          Header, GridCard, CreatedGridCard, StaticMiniGrid,
│                    CollectiveGauge, LevelsModal, ReplayModal, StreakModal,
│                    NotificationsPanel, TourOverlay, RequireAuth
├── lib/             supabase, cardColors, scoring, levels, creatures,
│                    marineItems, useBodyScrollLock
├── stores/          authStore (Zustand)
└── index.css        Tous les styles (variables CSS V2)
supabase/
├── functions/
│   ├── check-attempt/      Validation server-side des essais
│   └── generate-daily-grid/ Génération automatique de la grille du jour
└── migrations/             001→007 (schema, XP, streaks, tours...)
```

---

## Fonctionnalités

**Jeu**
- Drag-and-drop des cartes vers la grille (@dnd-kit)
- Rotation des cartes (↻ 0/90/180/270°)
- 3 essais avec feedback détaillé (comptage vert/orange/rouge, mini-grille de configuration)
- Persistance des essais en cours (retour possible en cours de partie)
- Tour guidé première visite

**Création**
- 3 niveaux de difficulté (Facile / Moyen / Difficile)
- Chrono en Moyen/Difficile avec auto-publish ou forfait
- Validation : les indices ne peuvent pas être des mots des cartes
- Indices latéraux : saisie via overlay sur mobile, input direct sur desktop

**Hub**
- Grille du jour + archives 7 jours
- Grilles communautaires groupées par date
- Statut des parties (Non joué / En cours / Joué)

**Progression**
- XP individuel → 10 niveaux → skins emojis marins
- XP collectif → 10 niveaux → créatures emoji partagées
- Streak journalier avec bonus XP
- Leaderboard contributeurs (ClassementPage)

**Profil & Dashboard**
- Historique jouées/créées avec stats détaillées
- Replay des essais via `ReplayModal`
- Solution complète de la grille

---

## Documentation

| Fichier | Contenu |
|---|---|
| `AGENTS.md` | Guide technique pour agents IA et contributeurs (stack, DB, conventions) |
| `DECISIONS.md` | Décisions architecturales avec leurs trade-offs |

---

## Sécurité

RLS actuellement **désactivé** sur toutes les tables `orienta_*` (développement).
À activer avec policies appropriées avant tout lancement public.

---

Contact : rodolphe.le.blevenec@gmail.com
