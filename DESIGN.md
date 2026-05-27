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
| `--text-primary` | `#111827` | Body text, headings |
| `--text-secondary` | `#4B5563` | Supporting text |
| `--text-muted` | `#9CA3AF` | Labels, hints, meta |
| `--bg-primary` | `#FFFFFF` | Page background |
| `--bg-secondary` | `#F7F6F3` | App shell / section background |
| `--bg-card` | `#FFFFFF` | Card background |
| `--bg-surface` | `#F2F1EE` | Input fields, track bars |
| `--coral` | `#FF6B6B` | Error, wrong answers |
| `--coral-dim` | `rgba(255,107,107,0.10)` | Error backgrounds |
| `--warning` | `#F59E0B` | Partial match (rotation only) |
| `--border` | `rgba(0,0,0,0.08)` | Default border |
| `--border-subtle` | `rgba(0,0,0,0.04)` | Dividers |

**Never** hardcode colors in JSX or CSS — always use variables.

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

Cards and modals use `--radius-md` to `--radius-xl`.
Buttons use `--radius-md`.
Pills/badges use `--radius-sm` or `6px`.

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
- **Padding**: `28px 20px` on main content areas, `24px` on modals
- **Gaps**: `24px` between sections, `10–12px` between cards, `8px` within card content
- **Sticky header**: `position: sticky; top: 0; z-index: 100`

---

## Component Patterns

### Buttons

```css
/* Primary */
.btn-primary    → accent bg, white text, 12px 24px padding, radius-md
.btn-primary:hover → translateY(-1px) + accent glow shadow

/* Secondary */
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

Hover: subtle lift (`translateY(-1px)`) + accent border.

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
- Click backdrop to close, ✕ button in header

### XP / Progress Bars

```css
.track { height: 6–8px; background: var(--bg-surface); border-radius: 4px; overflow: hidden; }
.fill  { background: linear-gradient(90deg, var(--accent), #00E8B8); }
```

Animate with Framer Motion: `initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }}`

### Skin Cards (Bestiaire)

- Grid: 5 cols desktop → 4 at 600px → 3 at 480px
- Active: `border-color: var(--accent); border-width: 2px; background: var(--accent-dim)`
- Locked: `opacity: 0.6; cursor: default`

---

## Header

```
[Orienta logo] ────────────── [🔥 streak] [🎓 Tutoriel] [Avatar Profil]
```

- Logo: `--display` font, accent color, left-aligned
- Right cluster: gap `10px`, all items show text label + icon
- Avatar: 36px circle, accent border, shows skin emoji or pseudo initial
- Tutorial button: surface bg, border, hover → accent tint + translateY(-2px) + glow

---

## Icons / Emojis

- **Collective creatures** (10 levels): pure emoji (`🥚🐟🐠🔭🗺️🦈🐢🐋🦑🐉`)
- **Individual skins** (10 levels): SVG components in `src/lib/marineItems.jsx`
- **UI icons**: emoji for streak 🔥, tutorial 🎓, lock 🔒, medal 🥇🥈🥉
- Never use an icon library or import SVGs as assets — inline SVGs or emoji only

---

## Animations

- **Framer Motion** for entrance animations and XP bar fills
- Default entrance: `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}`
- Stagger children with `transition={{ delay: i * 0.05 }}`
- Hover states: CSS `transition: all 0.18s` (not Framer Motion for hover)
- Keep animations subtle — no bouncing, no spinning, no color flash

---

## Responsive Breakpoints

| Breakpoint | Notes |
|---|---|
| `max-width: 768px` | Play page switches to column layout |
| `max-width: 600px` | Word cards shrink (170→140px), skin grid 5→4 cols |
| `max-width: 480px` | Skin grid 4→3 cols |

Mobile-first adjustments live in `@media (max-width: X)` blocks **after** the default rule.

---

## Things to Avoid

- No dark mode theming (not in scope)
- No CSS frameworks (Tailwind, Bootstrap, etc.)
- No inline styles except for Framer Motion `animate` props
- No emoji in button labels (stick to icon + text pattern from header)
- No shadows on text
- No `!important` unless overriding a library
