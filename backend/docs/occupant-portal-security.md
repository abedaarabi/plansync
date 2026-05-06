# Occupant (tenant) portal — security and operations

## Magic links

- Each **building link** is an `OccupantPortalToken` with an unguessable `token`. Share only over trusted channels.
- Links can **expire** (`expiresAt`) and be **revoked** (`revokedAt`). Revoked or expired tokens return an error to occupants.
- **Equipment QR codes** append `?a=<occupantScanSecret>` to the building URL. The asset secret is unique per asset; use **Regenerate secret** on the asset only if a QR is leaked (printed labels stop working).

## Rate limiting

- `POST /api/v1/occupant/:token/submit` is **rate limited** per portal token and client IP (in-process bucket). High volume deployments may need a shared limiter (e.g. Redis).

## Email

- **Workspace admins** receive notification email with links to the tenant-request list and viewer (when Resend is configured).
- **Reporters** receive a short acknowledgement email; it contains **no** magic tokens or internal-only secrets.

## Data

- Tenant submissions are stored as issues with `issueKind = OCCUPANT`. Promoting to an internal work order changes kind to `WORK_ORDER`.

## External collaborators

- Workspace members marked **external** do not receive **reporter** name/email on `OCCUPANT` issues in API list/detail responses (PII masking).
