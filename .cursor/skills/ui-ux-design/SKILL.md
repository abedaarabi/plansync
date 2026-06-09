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
- **Type:** Geist Sans. Use the type helpers — `.enterprise-type-label`,
  `-caption`, `-nav`, `-body`. Uppercase labels use tracking `[0.08em]`.
- **Radius:** cards `rounded-2xl`/`1rem`+, controls `rounded-lg`/`rounded-md`,
  pills/badges `rounded-full`/`rounded-md`.
- **Elevation:** prefer the overridden Tailwind `shadow-sm/md/lg` (already
  slate-tinted) or `--enterprise-shadow-*`. Keep shadows soft and diffuse — never
  harsh black.
- **Spacing:** consistent 4px scale; generous padding on cards (`p-4`–`p-6`);
  align to existing density (this is a dense, professional SaaS, not airy).
- **Motion:** subtle and fast (120–200ms). Use `.enterprise-animate-in` for enter
  transitions. Always respect `prefers-reduced-motion` (the existing keyframes do).

## Patterns to reuse, not rebuild

| Need                        | Use                                                              |
| --------------------------- | ---------------------------------------------------------------- |
| Modal / dialog (responsive) | `mobile/EnterpriseResponsiveDialog.tsx`                          |
| Side panel / detail editor  | `enterprise/EnterpriseSlideOver.tsx`                             |
| Bottom sheet (mobile)       | `mobile/EnterpriseBottomSheet.tsx`                               |
| Floating action button      | `mobile/EnterpriseFab.tsx`                                       |
| Loading state               | `enterprise/EnterpriseLoadingState.tsx` / `.enterprise-skeleton` |
| Form field                  | `mobile/MobileFormField.tsx`                                     |
| Toast                       | `sonner` (`toast.success(...)`, `toast.error(...)`)              |
| Icons                       | `lucide-react`                                                   |

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
