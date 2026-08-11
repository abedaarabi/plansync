---
name: implement-feature
description: >-
  Implement PlanSync product features end-to-end using existing stack patterns:
  Next.js App Router pages, enterprise UI primitives, TanStack Query, api-client,
  Hono v1 routes, Prisma, and fallow-clean modules. Use when the user asks to
  add, build, implement, ship, wire, create, extend, or scaffold a feature,
  screen, flow, CRUD surface, API endpoint, slide-over, list page, module,
  integration, or product capability inside the app — or when opening a feature
  PR / implementation checklist (not marketing landing copy-only work).
---

# Implement a PlanSync feature

Ship features the way this repo already does: thin server pages, client feature
modules, shared UI primitives, typed API client, Hono routes, query keys, no
orphans. Do **not** invent parallel architecture.

Also apply (read when the change touches that area):

- **UI look, type, tokens:** `.cursor/skills/ui-ux-design/SKILL.md`
- **Lean code / no dead exports:** personal `clean-code-writing` + workspace
  rule `fallow-compliance`
- **PWA / mobile shell:** personal `modern-pwa-ios` when touch/safe-area/install
  behavior is involved

Detailed paths and copy-paste skeletons: [reference.md](reference.md).

## 0. Clarify scope (before coding)

1. **Surface:** app enterprise / auth / PDF viewer / BIM viewer / landing.
2. **Scope:** UI-only, API-only, or full stack.
3. **Closest sibling:** find an existing feature that is the same shape (list +
   slide-over create, detail page, board, settings form) and **mirror it**.
4. **Permissions / billing:** workspace role, project role, Pro/OM gates if the
   sibling has them (`isPro`, `ProRequiredError`, route checks).
5. **Do not** redesign chrome, tokens, or navigation unless asked.

## 1. Default architecture

| Layer      | Where                                                            | Rule                                                                                      |
| ---------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Route      | `frontend/src/app/(enterprise)/…/page.tsx`                       | Server component: `metadata`, await `params`, wrap client in `EnterpriseCompactPageShell` |
| UI         | `frontend/src/components/enterprise/*Client.tsx` (+ slide-overs) | `"use client"`; data + interactions live here                                             |
| API client | `frontend/src/lib/api-client/*.ts` + barrel `index.ts`           | Add helpers only when a caller uses them                                                  |
| Query keys | `frontend/src/lib/queryKeys.ts` (`qk`)                           | Central keys; invalidate after mutations                                                  |
| Backend    | `backend/src/routes/v1/*Routes.ts` + register in router          | Hono + Zod + `needUser` + existing auth helpers                                           |
| Data       | Prisma models / migrations as needed                             | Match existing naming and permission loaders                                              |

**Thin page pattern** (required for enterprise lists):

```tsx
// page.tsx — server
export const metadata = { title: "…" };
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <FeatureClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}
```

## 2. Implementation order

Work top-down only if the API already exists; otherwise API → client → UI.

1. **Sibling pass** — open the closest `*Client.tsx` / `*SlideOver.tsx` / route
   file; copy structure (header, empty state, query, mutation, toasts).
2. **Data contract** — types + Zod on the server; mirror types on the client
   helper (or shared shape via response typing).
3. **Backend route** — register with existing middleware; use
   `loadProjectWithAuth` / workspace checks like neighbors; return JSON the
   client already expects.
4. **api-client helper** — add to the right `api-client/*.ts` module and export
   only what is imported; never leave “for later” wrappers.
5. **`qk` entry** — add query key factory; use it in `useQuery` / invalidation.
6. **UI** — list/header/empty/loading + create/edit via `EnterpriseSlideOver`
   (see UI checklist).
7. **Wire navigation** — sidebar / hub / deep links only if the product needs
   entry points; update every consumer when moving files.
8. **Fallow / dead code** — no unreferenced files; no unused exports.
9. **Verify** — typecheck touched packages; `npx fallow dead-code --quiet
--fail-on-issues` when adding TS/TSX.

## 3. UI checklist (enterprise app)

Full visual rules: `ui-ux-design` skill. Non-negotiables for new features:

- [ ] Namespace: `--enterprise-*` (not viewer/landing tokens)
- [ ] Type: prefer `.enterprise-type-{title|subtitle|body|nav|label|caption}` —
      avoid new `text-[10px]` / `text-[11px]` in app chrome
- [ ] Page header: `OmSubPageHeader` (mono icon + one primary CTA)
- [ ] Empty: `OmEmptyState` (short title, one sentence, one CTA)
- [ ] Loading: `EnterpriseLoadingState` / `.enterprise-skeleton`
- [ ] Forms: `.enterprise-field-label` + `.enterprise-field-input` or
      `MOBILE_FIELD_*` / `OM_COMPACT_*`
- [ ] Leading icons on inputs: `.enterprise-field-input--icon` (or `--icon-sm`),
      **not** bare `pl-*` alone
- [ ] Create/edit: `EnterpriseSlideOver` **edge** default (~560px),
      `SlideOverHeader` (+ `titleId`), footer `EnterpriseButton size="sm"`
      (or `SLIDE_OVER_BTN_*` class strings on plain buttons)
- [ ] No `panelVariant="floating"` for standard forms
- [ ] Buttons: `EnterpriseButton`; no ad-hoc primary colors/shadows
- [ ] Lists/tables: dense border-first shells, not card grids of every row
- [ ] Toasts: `sonner`
- [ ] Icons: `lucide-react` line icons only
- [ ] Mobile: shell padding via `EnterpriseCompactPageShell`; touch targets;
      safe areas; no desktop-only fixed widths

## 4. Data & async patterns

- **Reads:** `useQuery({ queryKey: qk.…, queryFn: () => fetch… })`
- **Writes:** `useMutation` → `toast.success/error` →
  `qc.invalidateQueries({ queryKey: qk.… })` (and related roots)
- **Errors:** surface API message; handle `ProRequiredError` like siblings
- **Ids:** pass `projectId` / `workspaceId` from the route; don’t invent global
  stores for server lists
- **Optimistic UI:** only if a sibling already does it for that domain

## 5. Backend patterns

- Add routes next to the domain file (`rfiRoutes`, `workOrderRoutes`, …) or
  extend the existing registrar—don’t create a one-off router style.
- Validate body/query with **Zod**.
- AuthZ: reuse `loadProjectWithAuth`, workspace role helpers, billing gates.
- Side effects (activity log, email, S3): follow the same helpers as neighboring
  handlers; don’t skip audit if the domain logs creates/updates.
- Keep handlers lean; extract pure helpers when complexity spikes (fallow
  complexity: prefer extract over broad suppressions).

## 6. Fallow / module hygiene

- Every new file must be **imported from a reachable entry** (page, layout,
  client used by page, route registrar, test).
- Prefer non-exported helpers until a second module needs them.
- Delete superseded files in the same change; no parallel old/new components.
- Suppressions are last resort (`// fallow-ignore-next-line …` on the
  function, never as a JSX text child).

## 7. Done when

- [ ] Feature works on the happy path and obvious empty/error states
- [ ] Matches sibling UX density and slide-over chrome
- [ ] Query invalidation keeps lists/detail in sync
- [ ] No unused exports/files; fallow clean on new code
- [ ] Permissions/billing aligned with domain
- [ ] Mobile layout sane (375px) and desktop dense
- [ ] No drive-by refactors outside the feature

## 8. Feature PR checklist

Copy into the PR body (or use when the user asks to open/ship a feature PR):

```markdown
## Summary

- [What / why in 1–3 bullets]

## Scope

- [ ] Frontend UI
- [ ] api-client + query keys
- [ ] Backend route(s)
- [ ] Prisma / migration (if any)
- [ ] Nav / deep links

## Implementation

- [ ] Mirrored sibling: `…`
- [ ] Thin `page.tsx` + `*Client.tsx`
- [ ] `qk.*` + invalidation after mutations
- [ ] AuthZ / Pro-OM gates match domain
- [ ] Slide-over edge + `SlideOverHeader` (if forms)
- [ ] Empty + loading + error states
- [ ] Type helpers (no micro 10–11px chrome)

## Verify

- [ ] Happy path manual check
- [ ] Mobile ~375px smoke
- [ ] `cd frontend && npx tsc --noEmit -p tsconfig.json` (if UI/client)
- [ ] `npx fallow dead-code --quiet --fail-on-issues` (new TS/TSX)
- [ ] Backend tests / smoke if routes changed

## Out of scope

- [Anything deliberately not done]
```

## Anti-patterns

- Custom modal/portal for app forms instead of `EnterpriseSlideOver`
- New color/shadow system or “glass” app chrome
- Fetch inside random components without `qk` + api-client
- Giant page components that mix routing, table, and form without extraction
- Backend route without auth checks “because it’s internal”
- Landing-page styling inside `(enterprise)` routes
- Leaving dead api-client wrappers or unregistered route files
- Ad-hoc `text-[10px]` / rainbow icons / marketing empty states in the app
