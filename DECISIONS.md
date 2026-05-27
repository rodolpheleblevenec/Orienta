# DECISIONS.md — Orienta

Architectural and product decisions that are non-obvious, that have trade-offs, or that future contributors might question.

---

## 2026-05-27 — Pseudo-only authentication (no Supabase Auth)

**Decision**: Use a pseudo (username) as the only identity. No password, no email, no OAuth. The UUID is stored in `localStorage` and used to look up or create a row in `orienta_users`.

**Why**: Orienta is a casual mini-game. Sign-up friction kills adoption. Pseudo-only is frictionless and aligns with the "play in 2 minutes" positioning. A returning user types their pseudo and is back in.

**Trade-offs**:
- No account recovery — if localStorage is cleared, the pseudo can be reclaimed by anyone.
- No real access control — RLS is disabled for now.
- Acceptable for a game where losing state is annoying but not critical.

**Revisit when**: Adding paid features, private grids, or social identity.

---

## 2026-05-27 — RLS disabled in development

**Decision**: Row Level Security is off on all `orienta_*` tables.

**Why**: Speed of iteration. RLS without policies blocks all access; setting up correct policies requires knowing the final auth model first.

**Risk**: The anon key is exposed client-side (standard for Supabase). Any user can read and modify any row.

**Mitigation**: Acceptable for a public game at this stage. All XP mutations go through a server-side RPC, so client-side XP inflation would require calling the RPC directly.

**Must fix before**: Any paid feature, private data, or public launch.

---

## 2026-05-27 — Dual XP progression (collective + individual, strictly separated)

**Decision**: Two completely separate XP tracks:
- **Collective** (`orienta_collective_progress.total_xp`) → unlocks emoji creatures shown in the shared modal
- **Individual** (`orienta_users.xp`) → unlocks marine item skins on the player's profile

**Why**: Encourages both individual play (personal progression) and community contribution (collective gauge moves faster when more players play). Separating the tracks avoids "I unlocked it for everyone vs. I unlocked it for me" confusion.

**Alternative considered**: A single XP feeding both — simpler but loses the social dimension.

**Unlock rule**: A skin is available to the player if `user.level >= item.level` (individual) OR `collectiveLevel >= item.level` (community gift). This means early players benefit from the community's progress.

---

## 2026-05-27 — `add_user_xp` RPC for all XP mutations

**Decision**: Never UPDATE `orienta_users.xp` directly from the client. All XP changes go through `supabase.rpc('add_user_xp', { uid, amount })`.

**Why**: The RPC atomically updates four fields in one transaction:
1. `orienta_users.xp` (individual)
2. `orienta_users.level` (recalculated from thresholds)
3. `orienta_users.xp_contributed` (for the leaderboard)
4. `orienta_collective_progress.total_xp` (for the collective gauge)

Doing this client-side would require 4 separate requests with race conditions.

**Side effect**: XP can't be awarded without also contributing to the collective, which is intentional.

---

## 2026-05-27 — Emoji creatures for collective levels, SVG marine items for individual skins

**Decision**: Collective level creatures use emoji (🥚🐟🐠…). Individual profile skins use inline SVG components.

**Why**: SVG creatures were built first but the user found them visually unsatisfying. Switching collective creatures to emoji solved the aesthetic issue without losing expressiveness. Individual skins remain SVG because they are more design-intentional (profile identity vs. collective mascot).

**Alternative**: Both emoji — simpler, but individual skins benefit from the custom SVG look at small sizes.

---

## 2026-05-27 — Scoring formula client-side, XP commit server-side

**Decision**: `computeXp(score, success)` and `xpStreakBonus(streak)` run on the client to show the result immediately. The resulting `amount` is then sent to `add_user_xp` on the server.

**Why**: The score is already computed client-side (it drives the result page). Recomputing on the server would require sending the full game state (score, streak, success). Since this is not a competitive/ranked game, client-side formula trust is acceptable.

**Risk**: A player could call `add_user_xp` with an inflated amount. Not a priority for a casual game.

**Revisit when**: Adding ranked modes or monetary rewards.

---

## 2026-05-27 — CSS vanilla, no framework

**Decision**: All styles live in `src/index.css` with CSS custom properties. No Tailwind, no CSS-in-JS, no component libraries.

**Why**: The design vocabulary is narrow and stable. A single CSS file with consistent naming is easier to audit and maintain for a small project than a utility class system.

**Trade-offs**: No tree-shaking of unused styles. Acceptable at current scale (CSS file is ~29 KB gzipped ~5 KB).

---

## 2026-05-27 — No `localStorage` for game state

**Decision**: Game state (current play, selected cards, rotation) lives in React component state only. It is not persisted to localStorage or a backend until the game ends.

**Why**: Simpler. An interrupted game just restarts. The grid is fetched fresh on page load.

**Trade-offs**: Refreshing mid-game loses progress. Acceptable for a short-form game (typical play < 3 minutes).

---

## 2026-05-27 — Leaderboard uses `xp_contributed`, not `xp`

**Decision**: The collective leaderboard sorts by `xp_contributed`, not the player's total `xp`.

**Why**: `xp` is individual progression (could be reset or adjusted separately in the future). `xp_contributed` is a monotonically increasing counter of how much that player has put into the collective pool. It is the right metric for a "who helped the community most" leaderboard.

**Note**: Currently both values are incremented together by `add_user_xp`. They will diverge only if individual XP is awarded without contributing to collective (e.g., a bonus or correction).

---

## 2026-05-27 — Documentation structure

**Decision**: Use `AGENTS.md` + `DESIGN.md` + `DECISIONS.md` at root, plus `plans/<feature>/PLAN.md` and `PROGRESS.md` for active feature work.

**Why**: Standardized structure from [agents.md](https://agents.md) convention. `AGENTS.md` gives AI coding agents and contributors a quick orientation. `DESIGN.md` prevents drift in visual language. `DECISIONS.md` captures the "why" that code alone can't convey.

**What NOT to put here**: Implementation details that are obvious from reading the code, temporary workarounds, or decisions that are already reversed.
