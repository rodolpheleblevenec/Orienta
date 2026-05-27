# Progression System V1 — Progress

**Status**: Completed  
**Owner**: Rodolphe  
**Date**: 2026-05-27

---

## Summary

Dual XP system (collective + individual), marine creature/item skins, leaderboard with personal rank, and full Supabase persistence.

---

## Milestones

### 1. Database Schema

**Status**: Completed

**Goal**: Add XP columns and the `add_user_xp` RPC.

**Implementation report**:
- Migrations applied:
  - `20260527191139` — `add_user_progression_columns`: added `xp`, `level`, `selected_skin` to `orienta_users`
  - `20260527191145` — `create_add_user_xp_function`: initial RPC (updated xp + level only)
  - `improve_add_user_xp_function` — extended RPC to also update `xp_contributed` and `orienta_collective_progress.total_xp`
- Verification: Columns confirmed via `list_tables`. RPC callable via `supabase.rpc()`.

---

### 2. Level & Creature Libraries

**Status**: Completed

**Goal**: Shared constants and visual components.

**Implementation report**:
- Files created: `src/lib/levels.js`, `src/lib/creatures.jsx`, `src/lib/marineItems.jsx`
- `src/lib/scoring.js` extended with `XP_CREATE` and `xpStreakBonus`
- **Design change**: Creatures originally built as inline SVGs, then converted to emoji components (`EmojiCreature` wrapper) after user feedback on SVG visual quality
- Verification: Components render correctly in Modal and ProfilePage.

---

### 3. Collective Gauge + Modal

**Status**: Completed

**Goal**: Interactive gauge, levels modal, leaderboard tab.

**Implementation report**:
- Files modified: `src/components/ui/CollectiveGauge.jsx`, `src/components/ui/LevelsModal.jsx`, `src/index.css`
- Tabs added: "Paliers" (10 creatures grid) and "Classement" (leaderboard)
- Leaderboard fetches top 10 by `xp_contributed`, then separately fetches user's own `xp_contributed` and computes rank via `COUNT WHERE xp_contributed > user`
- If user is in top 10: row highlighted with `.leaderboard-item--active` (accent bg + left border)
- If user is outside top 10: appended below separator with `.leaderboard-item--user`
- Verification: Build passes. Both tabs render correctly.

---

### 4. Individual Profile Progression

**Status**: Completed

**Goal**: XP bar, bestiaire grid, avatar skin selection.

**Implementation report**:
- Files modified: `src/pages/profile/ProfilePage.jsx`, `src/components/ui/Header.jsx`, `src/index.css`
- XP bar uses Framer Motion animate (`width: pct%`, `duration: 1, easeOut`)
- Bestiaire: 5-column grid (→4 at 600px →3 at 480px)
- **Bug fix**: Avatar wasn't updating after skin selection because `user.selected_skin` from authStore doesn't update instantly. Fixed by adding local `selectedSkin` state, setting it before `refreshUser()`.
- Header avatar shows selected marine item or pseudo initial
- Verification: Skin selection updates avatar in header before `refreshUser` resolves.

---

### 5. XP Wiring

**Status**: Completed

**Goal**: RPC connected to all XP-earning actions.

**Implementation report**:
- Files modified: `src/pages/play/PlayPage.jsx`, `src/pages/create/CreatePage.jsx`
- PlayPage: calls `add_user_xp(uid, computeXp(finalScore, won) + xpStreakBonus(streak))` on win; `add_user_xp(uid, 10)` on loss
- CreatePage: calls `add_user_xp(uid, XP_CREATE[difficulty])` after grid publication
- Both call `refreshUser()` after RPC
- Verification: XP increases on play and create. Collective gauge advances.

---

### 6. Leaderboard Improvements

**Status**: Completed

**Goal**: Personal rank display.

**Implementation report**:
- Files modified: `src/components/ui/LevelsModal.jsx`, `src/index.css`
- Converted `.then()` chain to `async/await` for clarity
- Added `userRank` state — set when user is not in top 10
- CSS: `.leaderboard-item--active` (highlight for top-10 user), `.leaderboard-item--user` (personal rank row below separator)
- Verification: Build passes. Both states (in / out of top 10) handled.

---

### 7. Documentation

**Status**: Completed

**Goal**: Full project documentation.

**Implementation report**:
- Files created:
  - `AGENTS.md` — stack, DB, conventions, XP system
  - `DESIGN.md` — color system, typography, component patterns, responsive breakpoints
  - `DECISIONS.md` — 9 architectural decisions documented
  - `plans/progression-system/PLAN.md`
  - `plans/progression-system/PROGRESS.md` (this file)
  - `README.md` — updated from Vite template to project overview

---

## Decisions Made During This Feature

- Collective creatures → emoji (not SVG) after user feedback on aesthetics
- Individual skins → SVG components (more intentional for profile identity)
- Unlock logic → OR (individual level OR collective level), favoring community
- Leaderboard metric → `xp_contributed` (not `xp`) as it's the community-facing counter
- All XP mutations → single RPC (`add_user_xp`) for atomicity

See `DECISIONS.md` for full rationale.

---

## Manual QA Log

```
Date: 2026-05-27
Build: Full system
Scenario: End-to-end progression smoke test
Result: Passed (dev build, localhost:5174)
Notes:
  - Hub gauge clickable, modal opens with creatures
  - Classement tab shows leaderboard
  - Profile XP bar animates
  - Bestiaire grid shows lock/unlock correctly
  - Skin selection updates header avatar immediately
  - npm run build → 0 errors, 628 kB JS bundle
```

---

## Open Items

- [ ] RLS policies — must be set before public launch
- [ ] Level-up notification/animation (V2 candidate)
- [ ] Real-time collective gauge update via Supabase Realtime (V2 candidate)
- [ ] Leaderboard auto-refresh when tab stays open (V2 candidate)
