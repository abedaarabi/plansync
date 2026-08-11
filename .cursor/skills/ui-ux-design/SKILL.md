---
name: ui-ux-design
description: >-
  Design and build UI for the PlanSync frontend using the existing design-token
  system, utility classes, and PWA/responsive conventions. Use when creating or
  changing any user-facing UI — pages, components, forms, dialogs, slide-overs,
  empty/loading states, layout, spacing, color, typography, icons, or mobile
  responsiveness — to keep new work visually consistent and accessible.
---

# PlanSync UI & UX Design

Build interfaces that look like they already shipped in this product. Reuse the
established tokens and utility classes; never invent new colors, shadows, or ad
hoc hex values.

## Stack

- Next.js 16 (App Router) + React 19 — read `node_modules/next/dist/docs/` before
  using unfamiliar Next APIs (see `frontend/AGENTS.md`).
- Tailwind CSS v4, CSS-first config. Tokens + component classes live in
  `frontend/src/app/globals.css`. There is no `tailwind.config.js`.
- `lucide-react` for icons, `sonner` for toasts, `zustand` for client state,
  `@tanstack/react-query` for server state, `next-intl` for copy.
- Mobile-first PWA: must work in standalone iOS/Android webviews.

## Core rules

1. **Pick the right namespace.** Three visual contexts, each with its own tokens:
   - `--enterprise-*` → the SaaS app shell (dashboards, projects, tables, forms).
     Light surfaces, navy sidebar. This is the default for in-app screens.
   - `--viewer-*` → the dark PDF/markup viewer chrome only.
   - `--landing-*` → marketing/landing pages only.
     Do not mix namespaces (e.g. no `--viewer-*` colors on an enterprise page).
2. **Use tokens, not raw values.** Reach for `var(--enterprise-primary)`,
   `text-[var(--enterprise-text-muted)]`, etc. Avoid new hex codes, arbitrary
   `shadow-[...]`, or off-palette grays. The full catalog is in
   [reference.md](reference.md).
3. **Reuse component classes before writing CSS.** `.enterprise-card`,
   `.enterprise-glass`, `.enterprise-badge-*`, `.enterprise-alert-*`,
   `.enterprise-skeleton`, `.enterprise-scrollbar`, `.enterprise-animate-in`, and
   the `.viewer-*` set already exist. Compose these instead of restyling.
4. **Match existing components.** Before building, open a sibling in
   `frontend/src/components/enterprise/` (e.g. `ProjectsClient.tsx`) or
   `frontend/src/components/mobile/` and mirror its structure, spacing, and class
   usage.
5. **Accessibility is not optional** — see the checklist below.

## Visual language

- **Color:** slate neutrals + a single blue accent (`--enterprise-primary`
  `#2563eb`). Use color sparingly; semantic colors (success/warning/danger/info)
  only for status, via the `enterprise-semantic-*` tokens or alert/badge classes.
- **Type (app):** **Inter** (`--font-inter`) with Geist fallback. Base **15px**
  / `line-height 1.5` / slight negative tracking on the shell. Prefer helpers:
  `.enterprise-type-title` · `-subtitle` · `-body` · `-nav` · `-nav-strong` ·
  `-label` · `-caption`. Do **not** invent `text-[10px]` / `text-[11px]` for
  app chrome — captions/labels floor at **12px** (`text-xs`). Uppercase labels:
  tracking `~0.07em`. Fields: label **14px**, input **15px**. Page titles via
  `OmSubPageHeader` (uses type helpers). Mobile keeps the larger iOS-like scale
  in `globals.css` (`max-lg`).
- **Radius:** cards **8px** (`.enterprise-card` / `--enterprise-radius-card`);
  controls/buttons **6px** (`--enterprise-radius-control`); dialogs **10px**.
  Prefer `rounded-md`/`rounded-lg` over `rounded-2xl`/`rounded-3xl`. Not pill
  unless badges/toggles.
- **Buttons:** primary `#2563EB` / hover `#1D4ED8`; weight 600; **no button
  shadows**. Landing: `.landing-btn-*`. App: `.enterprise-btn-*`.
- **Icons:** `lucide-react` line icons only — restrained mono wells
  (`.landing-icon`); never rainbow fills on every feature card.
- **Cards:** white, hairline border, **no card shadow**. Use selectively.
- **Elevation:** border-first. Cards/surfaces: shadow none. Dropdowns/modals
  only: short `--enterprise-shadow-floating` / `shadow-lg`. Avoid glow stacks,
  ring+shadow combos, and frosted-glass chrome. App chrome (sidebar, top bar)
  is solid navy/white — no gradients, blur, or soft inset highlights.
- **Auth:** use `EnterpriseAuthLayout`, `.enterprise-auth-card`,
  `.enterprise-field-input` / `.enterprise-field-label`. Copy is operational
  (workspace access), not marketing flourish.
- **Spacing:** consistent 4px scale; **dense professional SaaS** in the app
  (`space-y-3`, card `p-3`–`p-4`, compact page shell). Landing may stay airier.
- **Empty states:** `OmEmptyState` — short title, one sentence, single CTA. No
  large decorative icon wells or marketing copy inside the app.
- **Page headers:** `OmSubPageHeader` — mono icon tile, one primary action right.
- **Tables:** prefer list/table shells over nested cards for bulk work (issues,
  RFI, punch, team). Status via `issueStatusStyle` labels only.
- **Motion:** subtle and fast (120–200ms). Use `.enterprise-animate-in` for enter
  transitions. Always respect `prefers-reduced-motion` (the existing keyframes do).
- **Slide-overs:** always `EnterpriseSlideOver` with default **edge** dock (full
  height right rail) — do not use `panelVariant="floating"` for create/edit forms.
  Default width `max-w-[min(100%,560px)]`. Solid surface, hairline border, no
  glass/blur. Dense header via `SlideOverHeader` (32px mono icon, `text-base`
  title, `text-xs` description). Footer actions: `EnterpriseButton size="sm"` or
  `SLIDE_OVER_BTN_*`. Mobile: bottom sheet `rounded-t-lg`.

## Patterns to reuse, not rebuild

| Need                        | Use                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| Modal / dialog (responsive) | `mobile/EnterpriseResponsiveDialog.tsx`                                                              |
| Side panel / detail editor  | `enterprise/EnterpriseSlideOver.tsx` + `SlideOverHeader` / `SLIDE_OVER_BTN_*`                        |
| Bottom sheet (mobile)       | `mobile/EnterpriseBottomSheet.tsx`                                                                   |
| Floating action button      | `mobile/EnterpriseFab.tsx`                                                                           |
| Loading state               | `enterprise/EnterpriseLoadingState.tsx` / `.enterprise-skeleton`                                     |
| Empty list                  | `enterprise/OmEmptyState.tsx`                                                                        |
| Page header + primary CTA   | `enterprise/OmSubPageHeader.tsx`                                                                     |
| Form field                  | `.enterprise-field-*` / `lib/mobileFormStyles.ts` / `lib/omCompactStyles.ts`                         |
| Input with leading icon     | `.enterprise-field-input.enterprise-field-input--icon` (or `--icon-sm`) — never rely on `pl-*` alone |
| Typography                  | `.enterprise-type-title` / `-subtitle` / `-body` / `-nav` / `-label` / `-caption`                    |
| Toast                       | `sonner` (`toast.success(...)`, `toast.error(...)`)                                                  |
| Icons                       | `lucide-react`                                                                                       |

## Responsive & PWA

- Design mobile-first; verify at 375px, 768px, and ≥1024px.
- Touch targets ≥ 44px (`.mobile-touch-target`); rows ≥ 56px (`.mobile-list-row`).
- Inputs need `font-size ≥ 16px` on mobile to avoid iOS zoom (handled globally,
  don't override below 16px).
- Respect safe areas: use `--enterprise-topbar-offset` /
  `--enterprise-bottomnav-offset` and `env(safe-area-inset-*)` for fixed/sticky
  elements, never hardcoded bar heights.
- Use `100dvh` (not `100vh`) and the `.mobile-*` utilities for scroll containers,
  sticky footers, and sheets.

## Accessibility checklist

- [ ] Interactive elements are real `<button>`/`<a>` (or have `role` + key handlers)
- [ ] Visible focus: use `.viewer-focus-ring` or `--enterprise-ring-focus`; never
      remove outlines without a replacement
- [ ] Icon-only controls have `aria-label`
- [ ] Color is not the only signal (pair with icon/text/shape)
- [ ] Text on surfaces meets WCAG AA contrast (use the muted tokens, not lighter)
- [ ] Dialogs/sheets trap focus, close on Esc, and restore focus on close
- [ ] Forms have associated `<label>`s and inline error text
- [ ] Motion respects `prefers-reduced-motion`

## Workflow

1. Identify the namespace (enterprise / viewer / landing) and find the closest
   existing component to model after.
2. Compose from existing tokens, utility classes, and components.
3. Build mobile layout first, then enhance for `lg:`.
4. Run the accessibility checklist.
5. Check `frontend/src/app/globals.css` if you think you need a new token/class —
   add it there (in the right namespace) rather than inlining one-off values, and
   only when nothing existing fits.

## Additional resources

- Full token catalog and class reference: [reference.md](reference.md)
