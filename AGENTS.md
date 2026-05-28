# AGENTS.md — Orienta

## Project Overview

Orienta is a collaborative daily word-rotation puzzle game. Players place and orient 4-word cards on a 2×2 grid to match 4 directional clues. It has a dual XP progression system (collective + individual), a marine creature/item skin collection, daily grids, and a timed creation mode.

## Stack

- **React 18** (functional components, hooks) + **Vite**
- **React Router v6** (declarative routing)
- **Zustand** (global auth/user state)
- **Framer Motion** (entrance animations)
- **@dnd-kit/core** (drag-and-drop for card placement)
- **Supabase** (PostgreSQL, RPC functions, Edge Functions, anon key auth)
- **CSS vanilla** in `src/index.css` (no CSS-in-JS, no Tailwind)

## Project Structure

```
src/
├── pages/
│   ├── login/       LoginPage.jsx
│   ├── hub/         HubPage.jsx          — daily + community grids, "Ma grille"
│   ├── play/        PlayPage.jsx         — drag-drop game + feedback drawer
│   ├── create/      CreatePage.jsx       — timed grid creation (3 difficulties)
│   ├── result/      ResultPage.jsx       — score + solution tab
│   ├── dashboard/   DashboardPage.jsx    — creator stats + solution display
│   ├── profile/     ProfilePage.jsx      — XP, skins, history
│   └── admin/       AdminDailyPage.jsx   — daily grid management (admin only)
├── components/
│   ├── game/
│   │   ├── WordCard.jsx          — draggable card with per-word counter-rotation
│   │   ├── CloverGrid.jsx        — 2×2 grid + DroppableSlot (named export)
│   │   └── CloverWithInputs.jsx  — grid with clue inputs (create phase)
│   └── ui/
│       ├── Header.jsx            — logo, streak, tutoriel, profil
│       ├── GridCard.jsx          — hub card (status, difficulty, stats)
│       ├── CreatedGridCard.jsx   — creator's own grid card
│       ├── StaticMiniGrid.jsx    — read-only mini grid (feedback/result)
│       ├── CollectiveGauge.jsx   — collective XP gauge
│       ├── TourOverlay.jsx       — first-visit guided tour bubbles
│       └── TutorialModal.jsx     — full tutorial modal (creator + player tabs)
├── lib/
│   ├── supabase.js          — Supabase client (singleton)
│   ├── cardColors.js        — CARD_COLORS palette + getCardColor(index)
│   ├── useBodyScrollLock.js — hook: locks body scroll when a modal is open
│   ├── levels.js            — 10-level thresholds + getLevelProgress()
│   ├── creatures.jsx        — emoji components for collective levels
│   ├── marineItems.jsx      — SVG skin components for individual levels
│   └── scoring.js           — computeScore, computeXp, xpStreakBonus
├── stores/
│   └── authStore.js         — Zustand: user, loading, loginWithPseudo, refreshUser
└── index.css                — All styles (BEM-ish, CSS variables)
```

## Database

**Project**: `baqvosadoijsvvelugmp` (Supabase)

**Key tables** (all prefixed `orienta_`):
| Table | Purpose |
|---|---|
| `orienta_users` | Players — xp, level, selected_skin, xp_contributed, streak |
| `orienta_grids` | Puzzle grids — clues, creator, status, expires_at, **daily_date** |
| `orienta_grid_cards` | Positions/rotations of 4 cards within a grid (solution) |
| `orienta_word_cards` | Reusable 4-word cards (shared library) |
| `orienta_plays` | Play records per player per grid — score, xp_earned, completed_at |
| `orienta_play_attempts` | Per-attempt: answer (jsonb), correct_full, correct_rotation, neither |
| `orienta_collective_progress` | Single-row collective XP (id=1) |

**RLS**: disabled on all `orienta_*` tables (dev speed; must enable before public launch).

**RPC function**: `add_user_xp(uid uuid, amount integer)` — atomically updates `xp`, `level`, `xp_contributed`, and `orienta_collective_progress.total_xp`.

**Edge function**: `check-attempt` — validates a play attempt server-side against `orienta_grid_cards`. Returns `{ success, correctFull, correctRotation, neither, card_feedbacks }`. Uses `SUPABASE_SERVICE_ROLE_KEY`. The client inserts into `orienta_play_attempts` after receiving the result.

## Key Game Mechanics

### Word orientation (WordCard + StaticMiniGrid)
Cards rotate by `rotation` degrees (0/90/180/270). Each word is **counter-rotated** so that:
- Words at **horizontal** physical edges (top/bottom) always read at 0° on screen
- Words at **vertical** physical edges (left/right) always read at -90° on screen

Formula: `physIdx = (originalPos + rotation/90) % 4` → if `physIdx % 2 === 1` (vertical): `deg = -90 - rotation`, else `deg = -rotation`.

`StaticMiniGrid` uses the exact same formula to match the main grid's orientation.

### In-progress play restoration
When a player returns to a grid mid-game (`orienta_plays.completed_at = null`), `fetchGrid` in `PlayPage`:
1. Queries `orienta_play_attempts` for previous attempts
2. Reconstructs `attemptHistory` + `placements` from stored `answer` (jsonb)
3. Restores `attemptNumber` and `attemptsFailed`

### Tour overlay
`TourOverlay` shows once per user per page, keyed in `localStorage` as `orienta_tour_play_{uid}` / `orienta_tour_create_{uid}`. Anchor CSS classes: `center`, `center-right`, `center-left`, `tray-right`, `top-center`, `bottom-center`, `footer-center`.

### Timed creation + forfeit
`CreatePage` runs a countdown timer in `medium`/`difficile` modes. On expiry:
- All clues filled → auto-publish
- Any clue empty → forfeit: `localStorage.setItem('orienta_create_forfeit_{uid}', DATE)`

HubPage reads the forfeit key and disables the "Créer ma grille" button for the rest of the day.

## Card Colors

Centralized in `src/lib/cardColors.js`. Five vivid colors, always `{ bg: '#ffffff', border, text }`:
- Teal vif `#00A889`, orange-rouge `#F0440A`, bleu électrique `#1472E8`, ambre `#E89010`, violet `#7030E0`

`getCardColor(colorIndex)` cycles through them. `WordCard` and `StaticMiniGrid` both use this.

## Code Conventions

- **No TypeScript** — plain `.js` / `.jsx`
- **No comments** unless the WHY is non-obvious
- **No abstraction for one-offs**
- **CSS class naming**: kebab-case, component prefix
- **CSS variables** only — no hardcoded colors or spacings
- **Supabase calls** live directly in the page/component that needs the data
- **RPC for XP mutations** — never `UPDATE orienta_users SET xp = ...` directly
- **`refreshUser()`** after any mutation that changes `orienta_users`
- **Body scroll lock** — use `useBodyScrollLock()` hook in any modal/overlay

## XP System

| Action | XP |
|---|---|
| Win (grid) | `computeXp(score, true)` → 15–165 |
| Loss (grid) | `computeXp(0, false)` → 10 |
| Streak bonus | `Math.min(streak × 2, 30)` added on top |
| Create (facile) | 25 |
| Create (moyen) | 50 |
| Create (difficile) | 75 |

Thresholds: 0 / 500 / 1 500 / 3 500 / 7 000 / 12 000 / 20 000 / 35 000 / 55 000 / 80 000

## Authentication

No Supabase Auth — identity is a pseudo stored in `localStorage` as a UUID. `authStore.init()` rehydrates on boot.

## Do / Don't

**Do:**
- Use `getCardColor(colorIndex)` from `cardColors.js` — never hardcode card colors
- Use `useBodyScrollLock()` in any modal or overlay
- Use `DroppableSlot` (named export from `CloverGrid.jsx`) when building droppable grid variants
- Use `refreshUser()` after DB mutations that touch `orienta_users`
- Use `supabase.rpc('add_user_xp', ...)` for all XP changes

**Don't:**
- Don't add TypeScript, Tailwind, or extra libs without discussion
- Don't bypass the RPC for XP
- Don't commit/push without explicit user approval
- Don't add inline styles except Framer Motion `animate` props
- Don't skip `useBodyScrollLock()` in new modals

## Environment

```bash
VITE_SUPABASE_URL=https://baqvosadoijsvvelugmp.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Dev server: `localhost:5173` (or `:5174` if port taken).
