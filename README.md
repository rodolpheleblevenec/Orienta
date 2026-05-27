# Orienta — Mini-jeu de Rotation Quotidienne

Orienta est un mini-jeu collaboratif où les joueurs résolvent des grilles d'énigmes basées sur la rotation et la reconnaissance de mots. Le jeu combine une progression **collective** (où toute la communauté progresse ensemble) avec une progression **individuelle** (où chaque joueur obtient des récompenses personnelles).

---

## 🎮 Gameplay

Une grille Orienta est un plateau 2×2 où :
- **4 cartes** contiennent chacune 4 mots (haut, bas, gauche, droite)
- **4 indices** donnent des pistes pour chaque côté du plateau
- **Objectif** : Placer et orienter les cartes correctement

Scoring basé sur la vitesse et la précision.

---

## 🏗️ Tech Stack

- **Frontend** : React 18, React Router, Framer Motion, Zustand
- **Backend** : Supabase (PostgreSQL), RPC Functions
- **Styling** : CSS vanilla

---

## 📊 Système de Progression

### Progression Collective 🌍
- Jauge partagée par tous les joueurs
- Débloque 10 créatures marines (🥚🐟🐠🔭🗺️🦈🐢🐋🦑🐉)
- Affiche le top 10 des contributeurs

### Progression Individuelle 👤
- XP personnel de chaque joueur
- Débloque 10 skins marins
- Personnalise l'avatar du profil

Pour plus de détails, voir [docs/PROGRESSION_SYSTEM.md](docs/PROGRESSION_SYSTEM.md).

---

## 🚀 Mise en Place

```bash
# Installation
npm install

# Configurer .env.local
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Dev server
npm run dev
```

---

## 📁 Structure du Projet

```
src/
├── pages/           (LoginPage, HubPage, PlayPage, CreatePage, etc.)
├── components/      (Header, LevelsModal, CollectiveGauge, etc.)
├── lib/             (supabase, levels, creatures, marineItems, scoring, etc.)
├── stores/          (authStore.js — Zustand)
├── App.jsx
└── index.css
```

---

## 📚 Documentation

- **[PROGRESSION_SYSTEM.md](docs/PROGRESSION_SYSTEM.md)** — Système d'XP et progressions
- **[DATABASE.md](docs/DATABASE.md)** — Schéma Supabase et requêtes SQL

---

## 🎯 Fonctionnalités

✅ Authentification par pseudo  
✅ Création de grilles (3 difficultés)  
✅ Résolution avec drag-drop  
✅ Progression individuelle (10 niveaux)  
✅ Progression collective (10 niveaux)  
✅ Bestiaire déverrouillable  
✅ Skins d'avatar personnalisables  
✅ Leaderboard + top 10  
✅ Historique et dashboard  
✅ Streak system  
✅ Responsive design  

---

## 🔐 Sécurité

### Développement
- RLS actuellement **désactivé** sur Supabase (pour itérer rapidement)

### Production
1. Activer RLS sur toutes les tables `orienta_*`
2. Ajouter des policies (user data isolation, public grids, etc.)
3. Activer HTTPS
4. Audit régulier

---

## 📞 Support

Pour les bugs ou questions : rodolphe.le.blevenec@gmail.com

---

**Bon jeu ! 🎮✨**
