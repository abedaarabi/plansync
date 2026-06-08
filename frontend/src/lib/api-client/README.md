# API Client Module

This folder owns the frontend HTTP client surface used across the app.

## Files

- `index.ts`: barrel that re-exports all domain modules.

- `core.ts`: barrel for core API modules:
  - `core-project-ops.ts`
  - `core-workspace-portal.ts`
  - `core-members-viewer-rfi.ts`
  - `core-punch-materials.ts`
  - `core-issues-takeoff.ts`

- `proposals.ts`: proposal list/detail/templates/comments/document-version APIs.

- `operations-maintenance.ts`: barrel for O&M modules:
  - `operations-maintenance-assets.ts`
  - `operations-maintenance-maintenance.ts`

- `shared.ts`: common HTTP helpers and error-body parsing.

- `errors.ts`: shared API client error types (`ProRequiredError`, `HttpError`).

- `../api-client.ts`: compatibility barrel so existing imports keep working.

## Maintenance Notes

- Keep endpoint behavior additive and backward compatible.
- Group new exports near related domain functions to keep navigation easy.
- Reuse shared helpers (`readJsonOrEmpty`, `readJsonErrorBody`) for consistent errors.
