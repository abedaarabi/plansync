# PlanSync feature implementation reference

Companion to [SKILL.md](SKILL.md). Paths are from repo root.

## Map of the monorepo

| Area                     | Path                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| Enterprise App Router    | `frontend/src/app/(enterprise)/`                                                |
| Auth pages               | `frontend/src/app/sign-in`, `forgot-password`, `reset-password`, `verify-email` |
| Enterprise UI            | `frontend/src/components/enterprise/`                                           |
| Mobile primitives        | `frontend/src/components/mobile/`                                               |
| PDF viewer               | `frontend/src/components/pdf-viewer/`                                           |
| BIM viewer               | `frontend/src/components/bim-viewer/`                                           |
| API client modules       | `frontend/src/lib/api-client/` (barrel: `index.ts`, re-export `api-client.ts`)  |
| Query keys               | `frontend/src/lib/queryKeys.ts`                                                 |
| Form style tokens        | `frontend/src/lib/mobileFormStyles.ts`, `omCompactStyles.ts`                    |
| Design tokens / CSS      | `frontend/src/app/globals.css`                                                  |
| Backend v1 routes        | `backend/src/routes/v1/`                                                        |
| Permissions              | `backend/src/lib/permissions.js` (compiled from TS source in tree)              |
| Product / billing limits | `backend/src/config/product.ts`, subscription helpers                           |

## Sibling features to copy (by shape)

| Shape                            | Good models                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| Project list + create slide-over | RFIs: `ProjectRfisClient` + `RfiCreateSlideOver` + `rfi/page.tsx` |
| Issue list / status language     | `project-issues/*`, `IssueCreateSlideOver`, `issueStatusStyle`    |
| Work orders / OM                 | `WorkOrdersClient`, `WorkOrder*SlideOver`, `OmAssetsClient`       |
| Dense catalog / search           | `MaterialsClient`, `OmAssetsClient`                               |
| Settings toggles                 | `ProjectSettingsClient`, `SettingsToggleRow`                      |
| Team / invites                   | `ProjectTeamClient`, `WorkspaceTeamClient`                        |
| File browser                     | `file-explorer/*`, `ProjectFilesClient`                           |
| Auth forms                       | `sign-in/page.tsx`, `EnterpriseAuthLayout`                        |

## Page shell

```tsx
import type { Metadata } from "next";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";
import { FeatureClient } from "@/components/enterprise/FeatureClient";

export const metadata: Metadata = { title: "Feature" };

export default async function FeaturePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <FeatureClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}
```

Use `fullHeight` on the shell for explorer-style pages (files, assets).

## Client list skeleton

```tsx
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus } from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmEmptyState } from "@/components/enterprise/OmEmptyState";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { fetchThings } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

export function FeatureClient({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data = [], isPending } = useQuery({
    queryKey: qk.projectThings(projectId),
    queryFn: () => fetchThings(projectId),
  });

  // mutations: toast + qc.invalidateQueries({ queryKey: qk.projectThings(projectId) })

  if (isPending) return <EnterpriseLoadingState label="Loading…" />;

  const newButton = (
    <EnterpriseButton
      type="button"
      size="sm"
      onClick={() => {
        /* open slide-over */
      }}
    >
      <Plus className="h-4 w-4" strokeWidth={1.75} />
      New
    </EnterpriseButton>
  );

  return (
    <div className="space-y-3">
      <OmSubPageHeader
        icon={Package}
        title="Things"
        description="One operational sentence."
        action={newButton}
      />
      {data.length === 0 ? (
        <OmEmptyState
          icon={Package}
          title="No things yet"
          description="Create the first item to start tracking."
          action={newButton}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">{/* dense list / table shell */}</div>
      )}
    </div>
  );
}
```

Open `OmEmptyState` / `OmSubPageHeader` if props change — `action` is a `ReactNode`.

## Slide-over create/edit

```tsx
import {
  EnterpriseSlideOver,
  SlideOverHeader,
} from "@/components/enterprise/EnterpriseSlideOver";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { ClipboardList } from "lucide-react";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";

// Prefer EnterpriseButton size="sm" in footers (see RfiCreateSlideOver).
// SLIDE_OVER_BTN_PRIMARY / _SECONDARY / _DANGER are class strings for plain <button>s.

<EnterpriseSlideOver
  open={open}
  onClose={onClose}
  header={
    <SlideOverHeader
      icon={ClipboardList}
      titleId="thing-create-title"
      title="New thing"
      description="Project · operational context"
    />
  }
  footer={
    <>
      <EnterpriseButton type="button" variant="secondary" size="sm" onClick={onClose}>
        Cancel
      </EnterpriseButton>
      <EnterpriseButton
        type="button"
        size="sm"
        loading={pending}
        disabled={pending}
        onClick={() => void onSubmit()}
      >
        Create
      </EnterpriseButton>
    </>
  }
>
  <div className="space-y-4">
    <div className={MOBILE_FORM_SECTION}>
      <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Details</p>
      <div>
        <label htmlFor="thing-title" className={MOBILE_FIELD_LABEL}>
          Title *
        </label>
        <input id="thing-title" className={MOBILE_FIELD_INPUT} … />
      </div>
    </div>
  </div>
</EnterpriseSlideOver>
```

Rules:

- Default edge dock and width (do not set `panelVariant="floating"`).
- Leading search icon: ``className={`${MOBILE_FIELD_INPUT} enterprise-field-input--icon`}``
  with absolute `left-3` / `h-4 w-4` icon.

## api-client + query keys

1. Add functions in the domain file under `frontend/src/lib/api-client/` (e.g.
   `core-members-viewer-rfi.ts`, `operations-maintenance-work-orders.ts`).
2. Re-export from `frontend/src/lib/api-client/index.ts` only if that barrel is
   how siblings export (follow existing file).
3. Import from `@/lib/api-client` in UI.
4. Extend `qk` in `queryKeys.ts`:

```ts
projectThings: (projectId: string) => ["projectThings", projectId] as const,
```

Invalidation after create:

```ts
await qc.invalidateQueries({ queryKey: qk.projectThings(projectId) });
```

## Backend route sketch

```ts
// backend/src/routes/v1/thingRoutes.ts
export function registerThingRoutes(r: Hono, needUser: MiddlewareHandler) {
  r.get("/projects/:projectId/things", needUser, async (c) => {
    // loadProjectWithAuth / list
  });
  r.post("/projects/:projectId/things", needUser, async (c) => {
    // z.parse body, create, logActivity, return row
  });
}
```

Register alongside other `register*Routes` calls (see `backend/src/routes/v1/index.ts`
and domain route files). Match URL style of neighbors (`/api/v1/...` prefix is
applied at app mount).

## Auth / gates

- Session: `needUser` / session middleware on v1.
- Project access: `loadProjectWithAuth` patterns in existing routes.
- Pro/OM: mirror `isWorkspacePro` / frontend `isPro` + `ProRequiredError`.
- Don’t expose admin-only mutations to clients that only have view roles.

## Verification commands

From repo practices:

```bash
# Frontend types (when UI/api-client changed)
cd frontend && npx tsc --noEmit -p tsconfig.json

# Dead code / unused modules (required mindset for new TS/TSX)
npx fallow dead-code --quiet --fail-on-issues

# Pre-commit equivalent when staging
npm run fallow:precommit
```

Backend: run the package’s existing test or typecheck scripts if you touched
routes; prefer domain smoke tests when present (`*.test.ts` next to routes).

## UI skill cross-links

- Tokens & classes: `.cursor/skills/ui-ux-design/reference.md`
- Visual non-negotiables: `.cursor/skills/ui-ux-design/SKILL.md`
- Icon fields / radius / slide-overs / type scale: same skill “Patterns” table
- Feature PR checklist: section 8 in [SKILL.md](SKILL.md)

## Typography quick rules (app)

- Shell base 15px Inter — do not reset body to random sizes
- Titles: `.enterprise-type-title` or `OmSubPageHeader`
- Descriptions: `.enterprise-type-subtitle`
- Table headers / section labels: `.enterprise-type-label` (not `text-[11px]`)
- Meta: `.enterprise-type-caption` (≥12px)
- Forms: `.enterprise-field-label` + `.enterprise-field-input`
