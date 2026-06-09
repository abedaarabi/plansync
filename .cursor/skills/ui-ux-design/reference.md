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

### Elevation & focus

`--enterprise-shadow-xs|sm|md|card|floating|inner`,
`--enterprise-ring-focus` (focus ring). Tailwind `shadow-sm|md|lg|xl|2xl` are
overridden to slate-tinted versions — safe to use directly.

### Semantic (status only)

`--enterprise-semantic-{success|warning|info|danger}-{bg|border|text}` plus
`--enterprise-semantic-danger-muted`.

### Component classes

- Cards: `.enterprise-card`, `.enterprise-card-hover`, `.enterprise-glass`
- Alerts: `.enterprise-alert-{success|warning|info|danger}` (+ `-muted`)
- Badges: `.enterprise-badge-{success|warning|neutral}`
- Nav: `.enterprise-nav-active`, `.enterprise-sidebar-panel`,
  `.enterprise-sidebar-header`, `.enterprise-sidebar-footer`,
  `.enterprise-sidebar-nav-link`
- Misc: `.enterprise-breadcrumb-pill`, `.enterprise-dashed-add` (add tiles),
  `.enterprise-hint-tip` (`data-hint="..."` tooltip)
- Type: `.enterprise-type-{label|caption|nav|nav-strong|body}`
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
`--landing-line` / `-strong`, `--landing-label` `#3b82f6`, `--landing-cta`
(= enterprise primary), `--landing-glass` / `-strong`.

Classes: `.landing-atmosphere`, `.landing-band-{white|pricing|features}`,
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
