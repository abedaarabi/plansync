# PlanSync Design Token & Class Reference

Source of truth: `frontend/src/app/globals.css`. Always prefer these over raw
values. If something is genuinely missing, add it there in the correct namespace.

## Enterprise namespace (default app shell)

### Surfaces & layout

| Token                                  | Value                   | Use                     |
| -------------------------------------- | ----------------------- | ----------------------- |
| `--enterprise-bg`                      | `#f8fafc`               | Page background         |
| `--enterprise-surface`                 | `#ffffff`               | Cards, panels, inputs   |
| `--enterprise-hover-surface`           | `#f1f5f9`               | Hover/rest neutral fill |
| `--enterprise-surface-hover`           | `#f8fafc`               | Subtle row hover        |
| `--enterprise-border`                  | `#e2e8f0`               | Default hairline        |
| `--enterprise-border-subtle`           | `rgba(12,18,34,.06)`    | Faint dividers          |
| `--enterprise-border-muted`            | `rgba(148,163,184,.35)` | Mid dividers            |
| `--enterprise-topbar-h` / `-offset`    | `3.25rem` (+inset)      | Top chrome height       |
| `--enterprise-bottomnav-h` / `-offset` | `3.5rem` (+inset)       | Mobile tab bar          |

### Brand & text

| Token                       | Value                 | Use                      |
| --------------------------- | --------------------- | ------------------------ |
| `--enterprise-primary`      | `#2563eb`             | Primary actions, accents |
| `--enterprise-primary-deep` | `#1d4ed8`             | Hover/pressed primary    |
| `--enterprise-primary-soft` | `rgba(37,99,235,.08)` | Tinted fills             |
| `--enterprise-accent-line`  | `#3b82f6`             | Active accent edge       |
| `--enterprise-text`         | `#0f172a`             | Primary text             |
| `--enterprise-subtitle`     | `#475569`             | Secondary text           |
| `--enterprise-text-muted`   | `#64748b`             | Muted/meta text          |

### Sidebar (navy rail)

`--enterprise-sidebar` `#0f172a`, `--enterprise-sidebar-muted` `#a6b4c7`,
`--enterprise-sidebar-active` `#ffffff`, `--enterprise-sidebar-active-bg`,
`--enterprise-sidebar-hover`, `--enterprise-sidebar-edge`.

### Elevation, radius & focus

Shadows are minimal (border-first UI):

| Token                          | Use                              |
| ------------------------------ | -------------------------------- |
| `--enterprise-shadow-card`     | **none** — default cards         |
| `--enterprise-shadow-xs/sm/md` | hairline / short lift only       |
| `--enterprise-shadow-floating` | dropdowns, popovers, modals only |
| `--enterprise-radius-control`  | **6px** buttons/inputs           |
| `--enterprise-radius-card`     | **8px** cards/panels             |
| `--enterprise-radius-panel`    | **10px** large dialogs           |

`--enterprise-ring-focus` for focus. Tailwind `shadow-*` and `rounded-xl/2xl/3xl`
are tightened globally in `@theme` — prefer tokens over ad-hoc shadows.

### Semantic (status only)

`--enterprise-semantic-{success|warning|info|danger}-{bg|border|text}` plus
`--enterprise-semantic-danger-muted`.

### Typography

Font stack (app shell): `var(--font-inter)`, Geist, system-ui. Base **15px**,
line-height **1.5**, letter-spacing **−0.011em**, antialiased.

| Class                                  | Role                                | Approx size             |
| -------------------------------------- | ----------------------------------- | ----------------------- |
| `.enterprise-type-title`               | Page / panel titles                 | 20px / semibold / tight |
| `.enterprise-type-subtitle`            | Supporting line under titles        | 14px / muted            |
| `.enterprise-type-body`                | Body copy                           | 14px / lh 1.5           |
| `.enterprise-type-nav` / `-nav-strong` | Nav & list primary text             | 14px                    |
| `.enterprise-type-label`               | Section / table headers (uppercase) | 12px / tracking 0.07em  |
| `.enterprise-type-caption`             | Meta, timestamps                    | 12px / muted            |
| `.enterprise-field-label`              | Form labels                         | 14px                    |
| `.enterprise-field-input`              | Inputs                              | 15px                    |

Avoid `text-[10px]` / `text-[11px]` in enterprise UI. Viewer/BIM chrome may stay denser.

### Component classes

- Cards: `.enterprise-card`, `.enterprise-card-hover`, `.enterprise-glass`
- Alerts: `.enterprise-alert-{success|warning|info|danger}` (+ `-muted`)
- Badges: `.enterprise-badge-{success|warning|neutral}`
- Nav: `.enterprise-nav-active`, `.enterprise-sidebar-panel`,
  `.enterprise-sidebar-header`, `.enterprise-sidebar-footer`,
  `.enterprise-sidebar-nav-link`
- Misc: `.enterprise-breadcrumb-pill`, `.enterprise-dashed-add` (add tiles),
  `.enterprise-hint-tip` (`data-hint="..."` tooltip)
- Type: `.enterprise-type-{title|subtitle|label|caption|nav|nav-strong|body}`
- Canvas/shell: `.enterprise-main-canvas`, `.enterprise-main-inner`
- Scroll: `.enterprise-scrollbar`, `.enterprise-sidebar-scrollbar`
- Loading: `.enterprise-skeleton` (shimmer)
- Motion: `.enterprise-animate-in` (fade/slide, reduced-motion safe)

## Viewer namespace (dark PDF/markup chrome only)

Surfaces: `--viewer-shell` `#f1f5f9`, `--viewer-surface` `#1e293b`,
`--viewer-canvas` `#f8fafc`, `--viewer-chrome-*` `#0f172a`,
`--viewer-border` `#334155`. Text: `--viewer-text` `#f8fafc`,
`--viewer-text-muted` `#94a3b8`. Brand: `--viewer-primary` `#2563eb`,
`--viewer-primary-hover` `#1d4ed8`, `--viewer-primary-ring`,
`--viewer-primary-glow`. Status: `--viewer-success` `#10b981`,
`--viewer-error` `#ef4444`.

Classes: `.viewer-shell-bg`, `.viewer-canvas-area`, `.viewer-empty-canvas`
(dot grid), `.viewer-loading-canvas`, `.viewer-card`, `.viewer-section-title`,
`.viewer-kbd`, `.viewer-input-dark`, `.viewer-input-select`,
`.viewer-focus-ring`, `.viewer-toolbar-btn` (+ `-active`), `.viewer-pill-toggle`
(+ `-thumb`), `.viewer-range`, `.viewer-markup-tool-btn` (+ `-active`),
type `.viewer-type-{label|caption}`.

## Landing namespace (marketing only)

Tokens: `--landing-bg-deep`, `--landing-bg-mid`, `--landing-paper`,
`--landing-ink` `#0f172a`, `--landing-ink-{muted|soft|faint}`,
`--landing-line` / `-strong`, `--landing-label` / `--landing-cta` `#2563eb`,
`--landing-cta-bright` `#1d4ed8`, `--landing-glass` / `-strong`.

### Cards (use selectively — not every section)

`.landing-card` — white, subtle border, 16px radius, 24–32px padding.
Modifiers: `.landing-card-lg`, `.landing-card-flush`, `.landing-card-hover`,
`.landing-card-featured`. Prefer editorial product UI over grids of identical cards.

### Buttons (not pill-shaped)

`.landing-btn-primary` (`#2563EB` → hover `#1D4ED8`), `.landing-btn-secondary`,
`.landing-btn-ghost` (on dark/hero), `.landing-btn-block`, `.landing-btn-sm`.
Height 44–48px, x-pad 20–24px, radius ~9px, 14–15px / weight 600.

### Icons (lucide line only)

`.landing-icon`, `.landing-icon-sm`, `.landing-icon-lg`, `.landing-icon-accent`.
Restrained slate wells — icons support content, not rainbow feature art.

Other: `.landing-atmosphere`, `.landing-band-{white|pricing|features}`,
`.landing-dots`, `.text-gradient-blue`, `.btn-shine`, `.landing-grain`,
`.landing-vignette`, `.landing-value-pop`, type `.landing-type-{label|nav|body|caption}`.

## Mobile / PWA utilities

`.mobile-scroll`, `.mobile-chip-scroll`, `.mobile-list-row` (≥56px),
`.mobile-touch-target` (≥44px), `.mobile-viewport-pane` (dvh-based),
`.mobile-app-page`, `.mobile-table-wrap`, `.mobile-tappable-row`,
`.mobile-sticky-footer`, `.mobile-sheet-host` / `.mobile-sheet-panel`
(auto bottom-sheet on mobile).

## Conventions

- Global button press feedback (`scale(0.98)` on `:active`) and 150ms transitions
  are applied to all `button`/`[role=button]` — don't redefine.
- iOS input zoom guard: inputs are forced to ≥16px on small coarse-pointer
  screens; never set input font-size below 16px on mobile.
- Print: use `.no-print`, `.pdf-print-only`, `.schedule-print-root` for print
  behavior instead of new media queries.
