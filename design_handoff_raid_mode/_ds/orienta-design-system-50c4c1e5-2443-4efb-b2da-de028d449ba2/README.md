# Orienta — Design System

> The brand & UI system for **Orienta**, a collaborative daily word‑rotation puzzle game (in French, for the **WeFiiT** team). This project lets a design agent build on‑brand Orienta interfaces and assets — production code or throwaway mocks.

Orienta is a daily puzzle: a 2×2 board of four cards, each carrying four words (top/right/bottom/left), and four clues — one per side of the board. You place and rotate the cards so each edge matches its clue, in three tries, with Mastermind‑style feedback. Progress is **dual**: a personal XP track (levels → marine emoji skins) *and* a shared community XP track (levels → emoji creatures). Winners of a day's leaderboard earn the right to author a future daily grid. It's playful, warm, French, and very round.

---

## Sources

This system was reverse‑engineered from the production codebase. Explore it to build higher‑fidelity Orienta work:

- **GitHub:** `rodolpheleblevenec/Orienta` (branch `master`) — https://github.com/rodolpheleblevenec/Orienta
  - Design tokens & every component class: `src/index.css` (the "V2" design system, live since 2026‑06).
  - Components: `src/components/{ui,game}/`. Pages: `src/pages/`. Game data: `src/lib/{cardColors,levels,creatures,marineItems}`.
  - Stack: React 19 + Vite, React Router, Zustand, Framer Motion, @dnd‑kit, Supabase. Vanilla CSS (no Tailwind, no CSS‑in‑JS).
  - `AGENTS.md` and `README.md` in the repo are the authoritative product/technical guides.

> Nothing here assumes you have repo access — but if you do, the repo is the source of truth.

---

## CONTENT FUNDAMENTALS

**Language: French, always.** Every word of UI copy is in French. Keep it that way.

**Voice: warm, direct, second‑person `tu`/`vous`, collective.** The product talks to the player like a teammate. The login uses formal‑ish plural — *"Vos mots, une seule aventure. Relevez le défi du jour, ensemble."* — while in‑game and profile copy slip into singular `tu` — *"Entre ton pseudo…", "Tu as gagné !", "À toi de créer la grille du jour."* Both are fine; the throughline is **personal and encouraging**, never corporate.

**Tone traits:**
- *Collective & celebratory.* "Avec tout le monde.", "Le 1ᵉʳ du classement gagne le droit de créer la grille du jour." Winning is shared.
- *Short, punchy fragments.* Headlines break across lines for rhythm — *"Une grille. Chaque jour. Avec tout le monde."* Sentences are clipped, confident.
- *Plainspoken instructions.* "Tournez les cartes, suivez les indices, résolvez la grille." Verbs first, no jargon.
- *Gentle stakes.* Errors are kind: *"Erreur réseau — réessaie."*, *"Entre un pseudo pour continuer."* Never scold.

**Casing:** Sentence case for everything readable. UPPERCASE only for (a) the small eyebrow labels (e.g. *CHALLENGE DU JOUR*, letter‑spaced) and (b) the words printed on puzzle cards (MER, SEL, PORT…). Titles are sentence case in Bricolage, not Title Case.

**Numbers & units:** French formatting — thin‑space thousands (`8 000 XP`, `9 240 XP collectifs`), ordinals as `1ᵉʳ`, `N°`. XP is the universal currency word; "jetons" (🪙) are the quest currency.

**Emoji:** Yes — but **purposefully**, as game iconography, never as decoration in prose. 🏆 for winning a grant, ✍️ for "créé par", 🪙 jetons, 🛡️ streak‑freeze, ⚔️ raid, ★ for the daily grid, and the whole marine progression set (🌊🐚⚓🧭🐬💎👑🏆 for skins; 🐣🐟🦈🐢🐋🦑🐉🐙🔱 for creatures). Don't sprinkle emoji into sentences.

**Vibe in one line:** *a cozy daily ritual you do together* — encouraging, unhurried, a little gamer‑warm.

---

## VISUAL FOUNDATIONS

**The feeling:** soft, rounded, bright, calm. White cards floating on a pale dotted field, one confident teal, tasteful colour only where it means something. Nothing is sharp, nothing is loud, nothing is dark (except the one hero "stage" and the separate Raid mode).

**Color.** One brand colour — **teal `#0a9e84`** (`--teal`) — carries every CTA, link, active nav, clue chip and progress fill; `--teal-700` is its hover/pressed shade, `--teal-soft #e3f4ef` its pale wash. (A brighter legacy `--accent #00B899` survives in a few older buttons and the gauge gradient.) Surfaces are a warm near‑grey: page `--bg #f1f2f3`, recessed wells `--bg-tint`, cards pure white. Text is three inks: `--ink #1c2128`, `--ink-2 #5d6470`, `--ink-3 #9aa1ac`. A small **fixed identity palette** tints the puzzle cards — green `#16a085`, coral `#f2603f`, orange `#e8920e`, blue `#2f6fd6`, violet `#7030E0` — each used as border+text on a white card; **these are semantic and never recoloured to teal.** The same green/orange/red triad doubles as Mastermind feedback (`--fb-*`). Most colour appears as a soft tinted chip (`*-soft` background + saturated text), rarely as a fill.

**Type.** Two families. **Bricolage Grotesque** (400–800) is the personality — titles, numbers, card words, pills, level names — always with tight negative tracking (`-0.02` to `-0.035em`) that increases with size. **DM Sans** (400–700) is the quiet workhorse for body, UI labels and inputs (16px body, 1.6 line‑height). Eyebrow labels are 11–12px DM Sans, uppercase, `0.06em` tracked, in `--ink-3`.

**Background.** The signature is a **dot field**: `radial-gradient(rgba(28,33,40,0.04) 1px, transparent 1px)` at `24px` over `--bg`. It sits under *every* screen (helper class `.orienta-surface`). No big photos, no mesh gradients, no busy textures. The lone exception is the hub "stage" — a dark teal→navy radial panel with a faint masked grid, used to frame the rotating‑card demo.

**Backgrounds & imagery vibe.** Cool and clean. The one piece of brand art is the **rotating‑card illustration** (`assets/hero-card.png`) — a card lifting and turning, literalising "orientation". Imagery is otherwise emoji + the geometry of the cards themselves. No stock photography.

**Corner radii.** Round everywhere: `--r 22px` (cards, panels, modals), `--r-card 18px` (puzzle cards + grid slots), `--r-sm 14px` (inputs, chips), `--r-pill 999px` (pills, the primary CTA, avatars). Icon buttons use an in‑between 11px.

**Cards.** White (`--card`), 22px radius, hairline border `--line` (`rgba(28,33,40,0.09)`), and a **cool, low‑spread, lifted shadow** — `--shadow-sm` at rest, `--shadow` on hover. Big negative spread keeps shadows soft and floaty rather than dropped. Puzzle cards get the deeper two‑layer `--shadow-card`.

**Shadows.** Four steps, all cool‑toned (`rgba(20,30,45,…)`) with heavy negative spread: `--shadow-xs` (chips), `--shadow-sm` (resting cards), `--shadow` (hover/hero), `--shadow-card` (puzzle cards). No warm or hard shadows.

**Borders & dividers.** Hairlines, never heavy. `--line` for borders, `--line-2` for faint dividers, `1.5px dashed rgba(28,33,40,0.15)` for empty drop targets/placeholders.

**Hover.** Buttons & cards **lift** (`translateY(-2px)`/`-4px`) and gain shadow; interactive cards also switch their border to teal. Pills and nav links don't lift — pills fade slightly (`opacity .85`), nav links/icon‑buttons fill with a grey well (`--bg-tint`). Secondary buttons swap border+text to teal.

**Press.** Everything settles back: `transform: none` on `:active` (the lift collapses). Puzzle cards specifically scale down (`scale(.97)`) when grabbed.

**Motion.** Quick and gentle — `0.15–0.18s` ease on UI state. The one signature is the **springy card rotation**: `cubic-bezier(0.34,1.56,0.64,1)` (a slight overshoot) as a card turns 90°. Entrances are soft fade‑and‑rise (`cubic-bezier(0.16,1,0.3,1)`, via Framer Motion). XP bars fill over `1s`. No bounces on UI chrome, no infinite loops (except the looping hero demo and Raid effects).

**Transparency & blur.** Used sparingly: the sticky topbar is `rgba(241,242,243,0.88)` with a backdrop blur; modal backdrops are `rgba(28,33,40,0.5)` with a tiny `blur(2px)`. Board background is a barely‑there `rgba(28,33,40,0.018)`.

**Layout.** Centered single columns on a dotted field. Content max‑width ~1200px (hub), ~680–720px (profile/dashboard). Generous 22–32px padding inside cards. Sticky translucent topbar; a fixed footer on some pages. Sections are chaptered with a **numbered kicker** ("01 — La grille du jour") + a hairline rule.

---

## ICONOGRAPHY

**Two icon languages, used deliberately.**

1. **Stroked line icons — inline SVG.** All functional UI icons (bell, gear, logout, play ▶, chevrons, arrows, hamburger, streak flame) are hand‑inlined SVGs in a **feather/Lucide idiom**: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, round caps/joins. They inherit colour from text. There is **no icon font and no sprite in active use** (a tiny `public/icons.svg` exists in the repo but the app inlines SVGs directly). → **When you need a functional icon, use [Lucide](https://lucide.dev) (CDN) — it is the same stroke language**; match `stroke-width:2`, 24px grid, `currentColor`. *(Flagged substitution: Lucide stands in for the app's hand‑inlined SVGs.)*

2. **Emoji — as game iconography.** Progression, rewards and status use emoji as first‑class icons (see CONTENT → Emoji). The marine creature/skin sets ARE the visual reward system; reproduce them with real emoji glyphs, never redraw them.

**Logo / app icon.** `assets/logo-icon.svg` — a white rounded‑square tile with a teal (`#0E9A7D`) abstract rotation/comet glyph. `assets/apple-touch-icon.png` is the raster version. The lockup is the icon + "Orienta" wordmark in Bricolage 800, teal, `-0.035em`. A few unicode marks are used as glyphs too (★ daily, › chevron, ↻ rotate, ✍️).

**Never** hand‑draw brand illustrations or invent new SVG icons in a brand‑sensitive way — use the rotating‑card hero (`assets/hero-card.png`), Lucide for line icons, and emoji for game elements.

---

## What's in here (index)

**Foundations**
- `styles.css` — the single entry point consumers link. Only `@import`s.
- `tokens/colors.css` · `typography.css` · `spacing.css` · `fonts.css` — all design tokens + the Google‑Fonts webfont import.
- `components/components.css` — the shipped component classes (`o-btn`, `o-card`, `o-wordcard`, …).
- `guidelines/*.card.html` — Design‑System‑tab specimen cards (Colors, Type, Spacing, Brand).

**Components** (`window.OrientaDesignSystem_50c4c1` at runtime)
- `components/core/` — `Button`, `IconButton`, `StatPill`, `Badge`, `Card`, `TextField`, `Avatar`
- `components/feedback/` — `XPGauge`, `SectionKicker`
- `components/game/` — `WordCard`, `PuzzleBoard` (+ exported `CARD_COLORS`)
- Each has a `.jsx`, a `.d.ts` (props), a `.prompt.md` (how/when), and one `@dsCard` demo per directory.

**UI kit**
- `ui_kits/orienta_app/` — an interactive click‑through of the real game: Login → Hub → Play (rotate & place) → Result. See its `README.md`.

**Assets** (`assets/`)
- `logo-icon.svg`, `apple-touch-icon.png` — logo.
- `hero-card.png` — the rotating‑card brand illustration.
- `icons.svg` — the repo's (unused) icon sprite, kept for reference.

**Skill**
- `SKILL.md` — makes this folder usable as an Agent Skill (e.g. in Claude Code).

---

## Caveats & substitutions

- **Fonts load from Google Fonts**, exactly as the production app does — no local font binaries ship here. If you need offline/self‑hosted fonts, drop the `.woff2` files in and add `@font-face` to `tokens/fonts.css`.
- **Line icons:** Lucide (CDN) is substituted for the app's hand‑inlined feather‑style SVGs (same idiom). Swap in exact repo SVGs if you need 1:1 fidelity.
- The system models the **light, everyday game UI**. The separate dark **Raid** mode and the admin tooling exist in the repo but are out of scope here.
