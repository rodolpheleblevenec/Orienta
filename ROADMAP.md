# Orienta Roadmap — Séquençage complet

**Status**: Feedback intégré du plan XP/créatures + retours produit P0/P1/P2.

---

## ✅ Phase 0 — Fondations (COMPLÉTÉ)

### Bugs critiques fixes
- ✅ Grid creation button (missing `difficulty` column) — *Supabase migration + error logging*
- ✅ PlayPage drag crash (`setIsDragging` undefined) — *Removed line*
- ✅ Hard mode submit blocked (leurre card in tray) — *Changed allPlaced check to verify placements*
- ✅ Wardrobe skins all locked (ignored collectiveLevel) — *OR condition added*
- ✅ Modal tabs forced scroll (content height mismatch) — *min-height container*
- ✅ Card tray wrapping to 2 lines (flex-wrap) — *nowrap + overflow-x*
- ✅ Poor number readability (stats) — *tabular-nums font-variant*
- ✅ GridCard missing game stats — *Complete rewrite with difficulty + success %*
- ✅ Missing "Statistiques" heading — *Added .profile-stats-block*

---

## 🔄 Phase 1 — XP & Creatures (IN PROGRESS)

**Estimated: 2–3 days** | *Needed for P0 "data reliability" + foundation for P1/P2*

### 1A. Supabase schema + RPC
- [ ] Migration: Add `xp`, `level`, `selected_skin` to `orienta_users`
- [ ] RPC function `add_user_xp()` with atomic level calculation
- [ ] Verify `orienta_collective_progress` exists and is synced

### 1B. Core libraries
- [ ] `src/lib/creatures.jsx` — 10 SVG components (Oeuf → Serpent des mers)
- [ ] `src/lib/levels.js` — LEVELS array + `getLevelProgress()` + `getNextLevel()`
- [ ] `src/lib/scoring.js` — XP_CREATE constants + `xpStreakBonus()`

### 1C. Component updates
- [ ] `CollectiveGauge` — SVG creature + clickable → LevelsModal
- [ ] `LevelsModal` — Two tabs (Paliers grid + Classement leaderboard)
- [ ] `ProfilePage` — Individual XP bar + Wardrobe grid (5×2 skins)
- [ ] `Header` — Avatar: SVG creature if `selected_skin > 1`

### 1D. Gameplay XP integration
- [ ] `CreatePage` — `add_user_xp()` on grid publish (difficulty-based)
- [ ] `PlayPage` — `add_user_xp()` on game over (score + streak bonus)
- [ ] `authStore` — `refreshUser()` after XP changes

### 1E. CSS styling
- [ ] Collective gauge styles + hover state
- [ ] Levels modal backdrop/modal/grid/card/card--locked
- [ ] Wardrobe skin grid + card states
- [ ] Profile XP bar (compact)

**Output**: Players see dual XP progression, unlock creatures individually & collectively, see leaderboard.

---

## 🎯 Phase 2 — P0 Critical UX (3–4 days)

### 2A. Show solution after failure
**Why**: Transform frustration into learning; essential UX closure.

- [ ] `PlayPage` end-screen: add "Voir la solution" section when `attempts >= 3`
- [ ] Display:
  - Correct answer (highlighted)
  - Player's 3 attempts (each vs. correct answer)
  - Visual diff (✓ correct, ✗ wrong)
- [ ] CSS: `.game-over-solution` with clean layout

**Files**: `src/pages/play/PlayPage.jsx`, `src/index.css`

---

### 2B. Replay history from profile
**Why**: Post-game analysis + archive/Wordle-like feature. High retention potential.

#### 2B1. Supabase schema
- [ ] `orienta_plays` ensure stores: `grid_data`, `player_answers`, `correct_answers` (JSON)
- [ ] Or: add `game_state` column with full replay state

#### 2B2. Replay modal
- [ ] New component: `src/components/ui/ReplayModal.jsx`
- [ ] Props: `play` object, `onClose`
- [ ] Display read-only grid with:
  - Player's answers (filled cards, faded)
  - Correct answers overlaid (highlighted)
  - Score + date + difficulty
- [ ] No drag/interact — view only

#### 2B3. Profile integration
- [ ] `ProfilePage` "Grilles jouées" list — each item is clickable
- [ ] Click → opens `ReplayModal` with that play's state
- [ ] Link text: `{clue_top}` + date + `→ Revoir`

**Files**: `src/components/ui/ReplayModal.jsx`, `src/pages/profile/ProfilePage.jsx`

---

### 2C. Fix data reliability on grid cards
**Why**: Data inconsistencies undermine trust. Must be exact.

#### 2C1. GridCard data accuracy
- [ ] Verify `created_at` is ISO & correct timezone handling
- [ ] Verify success rate calculation matches backend intent
- [ ] Verify player count excludes creator if needed

#### 2C2. Supabase query check
- [ ] Confirm `orienta_plays` join in `HubPage` fetch is complete
- [ ] Add `.not('completed_at', 'is', null)` to count only finished games
- [ ] Test with varied play states

#### 2C3. Testing
- [ ] Create 3 test grids (facile, moyen, difficile)
- [ ] Play each as 2 different users (1 success, 1 fail)
- [ ] Verify GridCard shows: `2 joueurs · 50% réussi`

**Files**: `src/pages/hub/HubPage.jsx`, `src/components/ui/GridCard.jsx`

---

## 📊 Phase 3 — P1 Important UX (2–3 days)

### 3A. Grid AI balancing (optional, product-driven)
*If backend grid generation exists, audit for:*
- [ ] Difficulty calibration (are "facile" actually easy?)
- [ ] Category balance (no one topic dominates)
- [ ] Obscurity check (clues neither trivial nor impossible)

**Depends on**: Your grid generation logic. Likely separate from code roadmap.

---

### 3B. Refactor attempts display
**Why**: Cleaner UX, remove redundant counter.

- [ ] Remove attempts counter from top-right of PlayPage grid
- [ ] Move to bottom card ("Essai X / 3" + "Erreurs: Y")
- [ ] Add `.attempts-info` styling

**Files**: `src/pages/play/PlayPage.jsx`, `src/index.css`

---

### 3C. Notifications for comments (async, low priority for MVP)
**Why**: Community feedback loop.

- [ ] Create `orienta_comments` table + `orienta_notifications` table
- [ ] Add comment form below grid in PlayPage (low priority)
- [ ] Add notifications badge to Header
- [ ] Notification modal shows comments on user's grids

**Note**: Can defer to Phase 4. Requires schema expansion + UI work.

---

### 3D. Improve collective progression nav
**Why**: Tab switching is already working (fixed in Phase 1).

**Status**: Should be resolved by `LevelsModal` tab system in Phase 1. Verify no further work needed.

---

## ✨ Phase 4 — P2 Polish (1–2 days)

### 4A. Win animation (confetti + XP bar)
- [ ] `npm install canvas-confetti` (or similar)
- [ ] On game over with success → trigger confetti
- [ ] Animate XP bar fill (Framer Motion)
- [ ] Show "+X XP" popup

**Files**: `src/pages/play/PlayPage.jsx`, `src/index.css`

---

### 4B. Optimize tray card spacing
- [ ] Reduce `gap` in `.card-tray-items` (currently 8px → try 4px)
- [ ] Reduce padding on `.card-tray-item`
- [ ] Consider card size reduction if overflow still occurs

**Files**: `src/index.css`

---

### 4C. Accessible logout button
- [ ] Add logout button to Header (next to profile avatar)
- [ ] Click → confirm modal "Changer de pseudo?"
- [ ] On confirm → `logout()` → redirect to login

**Files**: `src/components/ui/Header.jsx`

---

## 📈 Phase 5 — Future/Nice-to-have

- [ ] Dark mode support
- [ ] Mobile responsiveness audit
- [ ] Leaderboard time-frame filters (week, month, all-time)
- [ ] Daily challenge mode (fixed grid for all players)
- [ ] Difficulty progression: unlock harder grids as XP increases
- [ ] Share grid invite links

---

## 🔗 Dependency Graph

```
Phase 1 (XP + Creatures)
  ↓
Phase 2A (Show solution)  [independent]
Phase 2B (Replay history) [needs Phase 1 complete + game_state storage]
Phase 2C (Data reliability) [independent, verify]
  ↓
Phase 3A–D (P1 improvements)
  ↓
Phase 4A–C (P2 polish)
```

**Critical path**: Phase 1 → Phase 2B → Phase 2A → Phase 2C → Phase 3+ → Phase 4

---

## 🎯 Milestones

| Milestone | Phase | Date Estimate | Criteria |
|-----------|-------|---|---|
| **MVP2: Core progression** | 1 | +2-3d | XP bar, creatures unlock, leaderboard visible |
| **MVP3: Closure UX** | 2A, 2B, 2C | +5-7d | Solution visibility, replay history, data accuracy |
| **MVP4: Polish** | 3, 4 | +3-5d | Better UI feedback, animations, community features |

---

## 🚀 Next Action

**Start Phase 1A** immediately:
1. Apply Supabase migrations (xp, level, selected_skin columns)
2. Create RPC `add_user_xp()` function
3. Build `creatures.jsx` + `levels.js` libraries

Estimated **2–3 days** for Phase 1 completion. Once done, Phases 2A/2C can run in parallel with 2B.
