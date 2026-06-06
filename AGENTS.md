# AGENTS.md — Orienta

## Project Overview

Orienta is a collaborative daily word-rotation puzzle game. Players place and orient 4-word cards on a 2×2 grid to match 4 directional clues. It has a dual XP progression system (collective + individual), a marine creature/item skin collection, daily grids, and a timed creation mode.

**Design system V2** (applied since 2026-06): Bricolage Grotesque (titles/numbers) + DM Sans (UI text), teal accent (`#0a9e84`), dot-pattern neutral background, white cards with soft shadows. All tokens in `src/index.css` CSS variables.

## Stack

- **React 19** (functional components, hooks) + **Vite 8**
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
│   ├── play/        PlayPage.jsx         — drag-drop game + feedback drawer (V2)
│   ├── create/      CreatePage.jsx       — timed grid creation (3 difficulties, V2)
│   ├── result/      ResultPage.jsx       — score + solution tab + attempts replay
│   ├── classement/  ClassementPage.jsx   — contributor leaderboard
│   ├── tutoriel/    TutorielPage.jsx     — interactive tutorial page
│   ├── dashboard/   DashboardPage.jsx    — creator stats + solution display
│   ├── profile/     ProfilePage.jsx      — XP, skins, history
│   └── admin/       DailyAdminPage.jsx   — daily grid management (admin only)
├── components/
│   ├── game/
│   │   ├── WordCard.jsx          — draggable card with per-word counter-rotation
│   │   ├── CloverGrid.jsx        — 2×2 grid + DroppableSlot (named export)
│   │   └── CloverWithInputs.jsx  — grid with clue inputs (create phase, dual desktop/mobile)
│   └── ui/
│       ├── Header.jsx            — logo, nav (Hub/Classement/Tutoriel), streak, profil, logout
│       ├── GridCard.jsx          — hub card (status, difficulty, stats)
│       ├── CreatedGridCard.jsx   — creator's own grid card
│       ├── StaticMiniGrid.jsx    — read-only mini grid (feedback/result)
│       ├── CollectiveGauge.jsx   — collective XP gauge → opens LevelsModal
│       ├── LevelsModal.jsx       — collective levels + contributor leaderboard
│       ├── ReplayModal.jsx       — attempt replay from profile history
│       ├── StreakModal.jsx       — streak explanation modal
│       ├── TourOverlay.jsx       — first-visit guided tour bubbles
│       ├── NotificationsPanel.jsx — notifications UI
│       └── RequireAuth.jsx       — auth guard wrapper
├── lib/
│   ├── supabase.js          — Supabase client (singleton)
│   ├── cardColors.js        — CARD_COLORS palette + getCardColor(index)
│   ├── useBodyScrollLock.js — hook: locks body scroll when active=true (default)
│   ├── levels.js            — 10-level thresholds (individual + collective) + getLevelProgress()
│   ├── creatures.jsx        — emoji components for collective levels
│   ├── marineItems.jsx      — emoji skin components for individual levels
│   └── scoring.js           — computeScore, computeXp, xpStreakBonus, xpAttemptBonus
│                              NOTE: evaluateAttempt() is DEAD CODE — do not use client-side
├── stores/
│   └── authStore.js         — Zustand: user, loading, loginWithPseudo, refreshUser, markTourDone
└── index.css                — All styles (BEM-ish, CSS variables V2)
supabase/
├── functions/
│   ├── check-attempt/index.ts       — server-side attempt validation (service role key)
│   └── daily-rollover/index.ts       — nightly rollover: finalise daily winner (grant J+3),
│                                       ensure today has a grid (winner → reserve → archive),
│                                       low-reserve & no-show alerts (scheduled via GitHub Actions)
└── migrations/              — 001_initial_schema → 007_add_tutorial_modal_done
```

## Database

**Project**: `baqvosadoijsvvelugmp` (Supabase)

**Key tables** (all prefixed `orienta_`):
| Table | Purpose |
|---|---|
| `orienta_users` | Players — xp, level, selected_skin, xp_contributed, streak_current, streak_best, last_played_at, tour_*_done flags |
| `orienta_grids` | Puzzle grids — clues, creator, status, expires_at, **daily_date** (null = community) |
| `orienta_grid_cards` | Positions/rotations of cards within a grid — `card_id` FK → `orienta_word_cards`, `position` (-1 = decoy) |
| `orienta_word_cards` | Reusable 4-word cards (shared library) — word_top, word_right, word_bottom, word_left |
| `orienta_plays` | Play records per player per grid — score, xp_earned, completed_at, success, time_seconds, attempts_count, comment |
| `orienta_play_attempts` | Per-attempt: answer (jsonb array), correct_full, correct_rotation, neither |
| `orienta_collective_progress` | Single-row collective XP (id=1) — total_xp, level, level_name |

**RLS**: disabled on all `orienta_*` tables (dev; must enable before public launch).

**RPC functions**:
- `add_user_xp(uid uuid, amount integer)` — atomically updates `xp`, `level`, `xp_contributed`, and `orienta_collective_progress.total_xp`
- `award_xp_on_play(p_grid_id, p_player_id, p_success, p_streak_bonus, p_attempt_bonus)` — awards XP to both player and creator

**Edge function**: `check-attempt` — validates attempt server-side against `orienta_grid_cards`. Returns `{ success, correctFull, correctRotation, neither, card_feedbacks }`. Also updates collective XP and user streak if last attempt or success. The **client** inserts into `orienta_play_attempts` after receiving the result.

**Partial credit rule in Edge Function**: `(posMatch && !rotMatch) || (!posMatch && rotMatch)` counts as `correctRotation`.

## Key Game Mechanics

### Word orientation (WordCard + StaticMiniGrid)
Cards rotate by `rotation` degrees (0/90/180/270). Each word is **counter-rotated** so it stays readable:

Formula: `physIdx = (originalPos + rotation/90) % 4` → if `physIdx % 2 === 1` (vertical): `deg = -90 - rotation`, else `deg = -rotation`.

`StaticMiniGrid` uses the exact same formula — never use `writing-mode` CSS for card words.

### Timer in PlayPage
`startTimeRef` starts as `null` and is set to `Date.now()` **after** cards are loaded (`setTrayCards(shuffled)`). The elapsed interval checks `if (startTimeRef.current)` before calculating. This prevents loading time from counting against the player's score.

### In-progress play restoration
When a player returns to a grid mid-game (`completed_at = null`), `fetchGrid` in `PlayPage`:
1. Queries `orienta_play_attempts` for previous attempts
2. Reconstructs `attemptHistory` + placements from stored `answer` (jsonb)
3. Restores `attemptNumber` and `attemptsFailed`

### Lateral clue inputs (CloverWithInputs — create mode)
Two elements rendered simultaneously per lateral side:
- `<input class="clue-lateral--desktop">` — shown ≥681px, hidden on mobile (`display: none`)
- `<button class="clue-lateral--mobile">` — shown on mobile, hidden on desktop

On mobile tap: sets `editingSide` state → renders `.clue-lateral-editor` overlay (centered, `position: absolute` on `.clover-wrapper`). Focusing top/bottom inputs closes the overlay via `onFocus={closeSide}`.

**Why not `writing-mode` on `<input>`**: `<input>` is a replaced element — `writing-mode` doesn't reflow its physical layout.

### Tour overlay
Tour flags stored in `orienta_users` columns (`tour_play_done`, `tour_create_placement_done`, `tour_create_clues_done`). Updated via `markTourDone(flag)` in authStore.

### Timed creation + forfeit
`CreatePage` runs a countdown in `moyen`/`difficile` modes. On expiry:
- All clues filled → auto-publish
- Any clue empty → forfeit: `localStorage.setItem('orienta_create_forfeit_{uid}', DATE)`

HubPage reads the forfeit key and disables "Créer ma grille" for the rest of the day.

## Card Colors

Centralized in `src/lib/cardColors.js`. Five semantic colors, always `{ id, bg: '#ffffff', border, text }`:
- `green` `#16a085`, `coral` `#f2603f`, `orange` `#e8920e`, `blue` `#2f6fd6`, `violet` `#7030E0`

All cards have white background; only `border` and `text` carry the identity color. `getCardColor(colorIndex)` cycles through them. Both `WordCard` and `StaticMiniGrid` use this.

These colors are **semantically fixed** — never replace them with the brand teal (`--accent`).

## XP System

| Action | XP |
|---|---|
| Win (joueur) | `XP_RESOLVE = 25` |
| Loss (joueur) | `0` |
| Streak bonus | `Math.min(streak × 2, 30)` additionné au win |
| Bonus de rapidité | `XP_FIRST_TRY = 6` (1er essai) · `XP_SECOND_TRY = 3` (2e essai) · 0 sinon |
| Créateur (quelqu'un joue) | `XP_CREATE_BASE = 15` |
| Créateur bonus (quelqu'un réussit) | `XP_CREATE_BONUS = 30` |

Thresholds individuels: 0 / 50 / 130 / 260 / 500 / 900 / 1 600 / 2 800 / 4 800 / 8 000 XP
Thresholds collectifs: 0 / 500 / 1 300 / 2 600 / 5 000 / 9 000 / 16 000 / 28 000 / 48 000 / 80 000 XP

**Note** : les thresholds dans l'Edge Function (`LEVEL_THRESHOLDS`) sont différents — désynchronisation connue, non critique.

## Authentication

No Supabase Auth — identity is a pseudo stored in `localStorage` as a UUID. `authStore.init()` rehydrates on boot. Pseudo lookup is **case-sensitive**.

## Error Handling Patterns

- **`check-attempt` failure**: `submitError` state in `PlayPage` → shows "Erreur réseau — réessaie." above submit button, cleared on next attempt
- **Async data in `useEffect`**: use `let cancelled = false` + `return () => { cancelled = true }` guard to prevent state updates after unmount (see `ResultPage`)
- **Loading states**: all async pages show a skeleton or "Chargement…" — never render with null data

## Code Conventions

- **No TypeScript** — plain `.js` / `.jsx`
- **No comments** unless the WHY is non-obvious
- **No abstraction for one-offs**
- **CSS class naming**: kebab-case, component prefix
- **CSS variables** only — no hardcoded colors or spacings
- **Supabase calls** live directly in the page/component that needs the data
- **RPC for XP mutations** — never `UPDATE orienta_users SET xp = ...` directly
- **`refreshUser()`** after any mutation that changes `orienta_users`
- **Body scroll lock** — `useBodyScrollLock()` (no argument = always active) in any modal/overlay

## Do / Don't

**Do:**
- Use `getCardColor(colorIndex)` from `cardColors.js` — never hardcode card colors
- Use `useBodyScrollLock()` in any modal or overlay
- Use `DroppableSlot` (named export from `CloverGrid.jsx`) when building droppable grid variants
- Use `refreshUser()` after DB mutations that touch `orienta_users`
- Use `supabase.rpc('award_xp_on_play', ...)` for XP after play completion
- Add `cancelled` guard in `useEffect` that starts multiple sequential async operations
- Start `startTimeRef.current = Date.now()` only after data is ready (not at mount)

**Don't:**
- Don't use `evaluateAttempt()` from `scoring.js` for real game logic — it's dead code; the Edge Function handles it
- Don't add TypeScript, Tailwind, or extra libs without discussion
- Don't bypass the RPC for XP
- Don't commit/push without explicit user approval
- Don't add inline styles except Framer Motion `animate` props
- Don't skip `useBodyScrollLock()` in new modals
- Don't use `writing-mode` CSS on `<input>` elements (replaced elements ignore it)

## Design System V2 (CSS Variables)

All design tokens live in `src/index.css`. Key variables:

```css
/* Brand */
--accent: #0a9e84;        /* teal — CTA, active states, brand */
--accent-soft: #e3f4ef;   /* teal pale — clue chips, active tab background */

/* Surfaces */
--bg: #f1f2f3;            /* page background (dot-pattern radial-gradient 24px) */
--card: #ffffff;          /* cards, panels, header/footer (translucent) */
--ink: #1c2128;           /* primary text */
--ink-2: #5d6470;         /* secondary text */
--line: rgba(28,33,40,0.10); /* borders */

/* Card identities — semantically fixed, never reassign to --accent */
--green: #16a085;   --coral: #f2603f;
--orange: #e8920e;  --blue: #2f6fd6;

/* Feedback (Mastermind) */
--fb-green: #16a085;  --fb-orange: #e8920e;  --fb-red: #f2603f;

/* Radii */
--r: 22px;  --r-sm: 14px;  --r-pill: 999px;
```

Fonts: `Bricolage Grotesque` (titles, card words, numbers) + `DM Sans` (UI text). Imported via Google Fonts in `index.html`.

## Environment

```bash
VITE_SUPABASE_URL=https://baqvosadoijsvvelugmp.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Dev server: `localhost:5173` (or `:5174` if port taken).
