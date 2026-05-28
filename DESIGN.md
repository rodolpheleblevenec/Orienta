# DESIGN.md — Orienta

## Design Philosophy

Orienta uses a **clean, calm, focused aesthetic** — light backgrounds, teal accent, subtle shadows. The visual language supports the puzzle-first experience: nothing decorative should compete with the grid.

---

## Color System

Defined as CSS variables in `:root` in `src/index.css`.

| Variable | Value | Usage |
|---|---|---|
| `--accent` | `#00B899` | Primary CTA, active states, XP bars, highlights |
| `--accent-dim` | `rgba(0,184,153,0.10)` | Hover backgrounds, accent cards |
| `--accent-border` | `rgba(0,184,153,0.25)` | Borders on accent elements |
| `--success` | `#00A889` | Correct placements, "joué" status |
| `--warning` | `#E89010` | Partial match (rotation only), "en cours" status |
| `--error` | `#F0440A` | Wrong answers |
| `--text-primary` | `#111827` | Body text, headings |
| `--text-secondary` | `#4B5563` | Supporting text |
| `--text-muted` | `#9CA3AF` | Labels, hints, meta |
| `--bg-primary` | `#FFFFFF` | Page background |
| `--bg-secondary` | `#F7F6F3` | App shell / section background |
| `--bg-card` | `#FFFFFF` | Card background |
| `--bg-surface` | `#F2F1EE` | Input fields, track bars |
| `--border` | `rgba(0,0,0,0.08)` | Default border |

**Never** hardcode colors in JSX or CSS — always use variables.

---

## Card Colors

Game cards use a separate vivid palette defined in `src/lib/cardColors.js`. Always `white` background with colored border and text:

| Index | Border / Text | Name |
|---|---|---|
| 0 | `#00A889` | Teal vif |
| 1 | `#F0440A` | Orange-rouge |
| 2 | `#1472E8` | Bleu électrique |
| 3 | `#E89010` | Ambre vif |
| 4 | `#7030E0` | Violet intense |

Use `getCardColor(colorIndex)` — never hardcode card colors directly.

---

## Status & Difficulty Color Coding

### Play status (GridCard)
| Status | Class | Color |
|---|---|---|
| Non joué | (default) | `--text-muted` |
| En cours | `.card-v2-status--inprogress` | `#E89010` (warning) |
| Joué | `.card-v2-status--done` | `#00A889` (success) |

### Difficulty
| Difficulty | Class | Color |
|---|---|---|
| Facile | `.card-v2-difficulty--easy` | `#00A889` |
| Moyen | `.card-v2-difficulty--medium` | `#E89010` |
| Difficile | `.card-v2-difficulty--hard` | `#F0440A` |

---

## Typography

| Variable | Font | Usage |
|---|---|---|
| `--display` | Syne (700, 800) | Headings, scores, logo, level names |
| `--sans` | DM Sans (400, 500, 600) | Body, buttons, labels |

**Rules:**
- Headings use `font-family: var(--display)`
- All body/UI text uses `var(--sans)` (set on `:root`)
- Never inline font-family in JSX

---

## Spacing & Radius

| Variable | Value |
|---|---|
| `--radius-sm` | 8px |
| `--radius-md` | 12px |
| `--radius-lg` | 20px |
| `--radius-xl` | 28px |

Cards and modals use `--radius-md` to `--radius-xl`. Buttons use `--radius-md`. Pills/badges use `--radius-sm` or `6px`.

---

## Shadow System

```css
--card-shadow: 0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06);
```

Use `var(--card-shadow)` on cards. Modals use a stronger shadow:
```css
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
```

---

## Layout Principles

- **Max widths**: Pages use `max-width: 600–680px` centered with `margin: 0 auto`
- **Play/Create layout**: 3-column fixed — left drawer (tray), center (grid), right drawer (feedback)
- **Padding**: `28px 20px` on main content areas, `24px` on modals
- **Gaps**: `24px` between sections, `10–12px` between cards, `8px` within card content
- **Sticky header**: `position: sticky; top: 0; z-index: 100`
- **Sticky footer** (PlayPage): `position: fixed; bottom: 0; z-index: 50`

---

## Component Patterns

### Buttons

```css
.btn-primary    → accent bg, white text, 12px 24px padding, radius-md
.btn-primary:hover → translateY(-1px) + accent glow shadow

.btn-secondary  → transparent, border, accent on hover
```

Only two button variants. Never create a third without adding it here.

### Cards

```css
.some-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--card-shadow);
  padding: 14px 18px;
}
.some-card:hover {
  border-color: var(--accent-border);
  transform: translateY(-1px);
}
```

### Badges / Pills

```css
background: var(--accent-dim);
border: 1px solid var(--accent-border);
border-radius: 6px;
padding: 2px 8px;
font-size: 11px;
color: var(--accent);
```

### Modals

- Backdrop: `position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000`
- Panel: `max-width: 520px; max-height: 80dvh; overflow-y: auto`
- Always use `useBodyScrollLock()` to prevent background scroll
- Click backdrop to close, ✕ button in header

### Tour Overlay Bubbles

CSS anchor classes for `TourOverlay`:
| Class | Position | Arrow |
|---|---|---|
| `tour-card--center` | Centered | None |
| `tour-card--center-right` | Right edge, middle | ← (left) |
| `tour-card--center-left` | After left tray, middle | → (right) |
| `tour-card--tray-right` | Just right of tray | ← (left, toward tray) |
| `tour-card--top-center` | Top, centered | ↓ (down) |
| `tour-card--bottom-center` | Bottom, centered | ↑ (up) |
| `tour-card--footer-center` | Above sticky footer | ↓ (down, toward footer) |

Mobile: all non-center positions collapse to bottom-centered, arrows hidden.

### XP / Progress Bars

```css
.track { height: 6–8px; background: var(--bg-surface); border-radius: 4px; }
.fill  { background: linear-gradient(90deg, var(--accent), #00E8B8); }
```

---

## Header

```
[Orienta logo] ────────────── [🔥 streak] [🎓 Tutoriel] [Avatar Profil]
```

- Logo: `--display` font, accent color, left-aligned
- Right cluster: gap `10px`, icon + text label per item
- Avatar: 36px circle, accent border, shows skin emoji or pseudo initial

---

## Icons / Emojis

- **Collective creatures** (10 levels): emoji (`🥚🐟🐠🔭🗺️🦈🐢🐋🦑🐉`)
- **Individual skins** (10 levels): SVG components in `src/lib/marineItems.jsx`
- **UI icons**: emoji for streak 🔥, tutorial 🎓, lock 🔒
- **GridCard icons**: inline SVG only (IconClock, IconPlay, IconCheckmark, etc.)
- Never import SVGs as assets — inline SVGs or emoji only

---

## Animations

- **Framer Motion** for entrance animations and XP bar fills
- Default entrance: `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}`
- Stagger: `transition={{ delay: i * 0.05 }}`
- Hover states: CSS `transition: all 0.18s` (not Framer Motion)
- Keep animations subtle — no bouncing, no spinning, no color flash

---

## Responsive Breakpoints

| Breakpoint | Notes |
|---|---|
| `max-width: 768px` | Play/Create: drawers become inline flow |
| `max-width: 600px` | Word cards shrink, skin grid 5→4 cols |
| `max-width: 480px` | Skin grid 4→3 cols |
| `max-width: 640px` | Tour bubbles collapse to bottom |

Mobile-first adjustments live in `@media (max-width: X)` blocks **after** the default rule.

---

## Things to Avoid

- No dark mode theming (not in scope)
- No CSS frameworks (Tailwind, Bootstrap, etc.)
- No inline styles except Framer Motion `animate` props
- No emoji in button labels (icon + text pattern)
- No shadows on text
- No `!important` unless overriding a library
- No hardcoded card colors — always `getCardColor(index)` from `cardColors.js`
