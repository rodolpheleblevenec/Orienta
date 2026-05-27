# AGENTS.md — Orienta

## Project Overview

Orienta is a collaborative daily word-rotation puzzle game. Players place and orient 4-word cards on a 2×2 grid to match 4 directional clues. It has a dual XP progression system (collective + individual) and a marine creature/item skin collection.

## Stack

- **React 18** (functional components, hooks) + **Vite**
- **React Router v6** (declarative routing)
- **Zustand** (global auth/user state)
- **Framer Motion** (animations)
- **Supabase** (PostgreSQL, RPC functions, anon key auth)
- **CSS vanilla** in `src/index.css` (no CSS-in-JS, no Tailwind)

## Project Structure

```
src/
├── pages/           One folder per route
│   ├── login/       LoginPage.jsx
│   ├── hub/         HubPage.jsx
│   ├── play/        PlayPage.jsx
│   ├── create/      CreatePage.jsx
│   ├── dashboard/   DashboardPage.jsx
│   └── profile/     ProfilePage.jsx
├── components/
│   └── ui/          Reusable, stateless-ish UI components
├── lib/
│   ├── supabase.js  Supabase client (singleton)
│   ├── levels.js    10-level progression constants + helpers
│   ├── creatures.jsx Emoji components for collective levels
│   ├── marineItems.jsx SVG skin components for individual levels
│   └── scoring.js   XP formulas (computeXp, XP_CREATE, xpStreakBonus)
├── stores/
│   └── authStore.js Zustand store — user, loading, loginWithPseudo, refreshUser
└── index.css        All styles (BEM-ish class names, CSS variables)
```

## Database

**Project**: `baqvosadoijsvvelugmp` (Supabase, eu-west-1)

**Key tables** (all prefixed `orienta_`):
| Table | Purpose |
|---|---|
| `orienta_users` | Players — xp, level, selected_skin, xp_contributed, streak |
| `orienta_grids` | Puzzle grids — clues, creator, status (draft/published) |
| `orienta_grid_cards` | Positions/rotations of 4 cards within a grid |
| `orienta_word_cards` | Reusable 4-word cards (shared library) |
| `orienta_plays` | Play records per player per grid — score, xp_earned |
| `orienta_play_attempts` | Per-attempt answer details |
| `orienta_collective_progress` | Single-row collective XP (id=1) |

**RPC function**: `add_user_xp(uid uuid, amount integer)` — atomically updates `xp`, `level`, `xp_contributed`, and `orienta_collective_progress.total_xp` in one call.

## Code Conventions

- **No TypeScript** — plain `.js` / `.jsx`
- **No comments** unless the WHY is non-obvious
- **No abstraction for one-offs** — three similar lines > a premature helper
- **CSS class naming**: kebab-case, component prefix (e.g. `.skin-card`, `.skin-card--active`, `.skin-card--locked`)
- **CSS variables** only — no hardcoded colors or spacings
- **Supabase calls** live directly in the page/component that needs the data — no repository layer
- **RPC for mutations with side effects** — never do XP math client-side
- **`refreshUser()`** after any mutation that changes `orienta_users`

## XP System

All XP flows through `supabase.rpc('add_user_xp', { uid, amount })`.

| Action | XP |
|---|---|
| Win (grid) | `computeXp(score, true)` → 15–165 |
| Loss (grid) | `computeXp(0, false)` → 10 |
| Streak bonus | `Math.min(streak × 2, 30)` added on top |
| Create (easy) | 25 |
| Create (medium) | 50 |
| Create (hard) | 75 |

XP thresholds: 0 / 500 / 1 500 / 3 500 / 7 000 / 12 000 / 20 000 / 35 000 / 55 000 / 80 000

## Authentication

No Supabase Auth — identity is a pseudo (username) stored in `localStorage` as a UUID. `authStore.init()` rehydrates from `localStorage` on boot.

## Do / Don't

**Do:**
- Keep all styles in `src/index.css` with CSS variables
- Use `refreshUser()` after DB mutations
- Use `supabase.rpc('add_user_xp', ...)` for all XP changes
- Match existing file/folder naming conventions

**Don't:**
- Don't add TypeScript, Tailwind, or extra libs without discussion
- Don't put business logic inside CSS or JSX template literals
- Don't bypass the RPC for XP — never `UPDATE orienta_users SET xp = ...` directly
- Don't add loading states or error handling for paths that can't happen
- Don't commit/push without explicit user approval

## Environment

```bash
VITE_SUPABASE_URL=https://baqvosadoijsvvelugmp.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Dev server runs on `localhost:5173` (or `:5174` if port taken).

## Plans / Active Features

See `plans/` directory for active feature plans and progress.
