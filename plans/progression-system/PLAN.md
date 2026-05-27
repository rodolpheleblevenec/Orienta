# Progression System V1 — Plan

**Status**: Completed  
**Owner**: Rodolphe  
**Date**: 2026-05-27

---

## Summary

Build a dual XP progression system — collective (shared across all players) and individual (per player) — with a marine creature/item skin collection, a leaderboard, and full persistence in Supabase. The system should make the social dimension of the game visible and give players a reason to return.

---

## Milestones

### 1. Database Schema

Add XP columns to `orienta_users` and create the `add_user_xp` RPC function.

**Deliverables**:
- `ALTER TABLE orienta_users ADD COLUMN xp, level, selected_skin`
- RPC `add_user_xp(uid, amount)` updating all 4 fields atomically

**Verification**: Columns exist in Supabase, function callable via client.

---

### 2. Level & Creature Libraries

Create the shared level constants and visual components.

**Deliverables**:
- `src/lib/levels.js` — `LEVELS` array, `getLevelFromXp()`, `getLevelProgress()`
- `src/lib/creatures.jsx` — 10 emoji creature components (collective)
- `src/lib/marineItems.jsx` — 10 SVG marine item components (individual)
- `src/lib/scoring.js` — `XP_CREATE`, `xpStreakBonus` exports

**Verification**: Import and render correctly in isolation.

---

### 3. Collective Gauge + Modal

Make the existing `CollectiveGauge` interactive and build the levels modal.

**Deliverables**:
- `CollectiveGauge.jsx` — clickable, shows current creature, chevron
- `LevelsModal.jsx` — scrollable grid of 10 levels, unlock progress
- Leaderboard tab in modal — top 10 + user rank if outside top 10
- CSS for modal, tabs, leaderboard items, highlight states

**Verification**: Click gauge → modal opens. Switch tabs. Leaderboard shows correct data. User row highlighted or appended.

---

### 4. Individual Profile Progression

Add XP bar and skin selection to the profile page.

**Deliverables**:
- `ProfilePage.jsx` — individual XP bar under avatar, bestiaire grid
- Avatar uses selected marine item (or initials if level 1)
- Clicking an unlocked skin calls `update({ selected_skin })` + `refreshUser()`
- Local state for immediate visual feedback before refreshUser resolves
- `Header.jsx` — avatar shows selected skin

**Verification**: XP bar animates. Skin selection updates avatar in header immediately.

---

### 5. XP Wiring

Connect the RPC to all XP-earning events.

**Deliverables**:
- `PlayPage.jsx` — calls `add_user_xp` on game over (win + loss)
- `CreatePage.jsx` — calls `add_user_xp` after grid publication
- `refreshUser()` called in both places

**Verification**: Play a grid → xp increases. Create a grid → xp increases. Collective gauge advances.

---

### 6. Leaderboard Improvements

Add personal rank display to the classement tab.

**Deliverables**:
- If user is in top 10 → highlight row (`leaderboard-item--active`)
- If user is outside top 10 → compute rank via COUNT query → show at bottom (`leaderboard-item--user`)
- CSS for both highlight states

**Verification**: Works for both top 10 and outside top 10 users.

---

### 7. Documentation

Produce project-level docs following the AGENTS / DESIGN / DECISIONS / plans structure.

**Deliverables**:
- `AGENTS.md` — stack, conventions, DB schema, XP system
- `DESIGN.md` — color system, typography, component patterns
- `DECISIONS.md` — all non-obvious architectural choices
- `plans/progression-system/PLAN.md` (this file)
- `plans/progression-system/PROGRESS.md`

---

## Test Plan

- `npm run build` — zero errors
- Hub → click gauge → modal opens with 10 creatures and level unlock state
- Hub → classement tab → top 10 shown with medals; own row highlighted or appended
- Profil → XP bar visible, bestiaire grid, skin selection updates avatar immediately
- Créer une grille → publish → user.xp increases
- Jouer une grille → game over → user.xp increases, collective gauge advances
- Select locked skin → nothing happens
- Select unlocked non-active skin → becomes active in header instantly

## Assumptions

- No real-time updates — collective gauge refreshes on page load only
- No level-up notification or animation in V1
- RLS stays disabled in development
- Leaderboard fetches on tab open, no auto-refresh
