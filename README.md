# PlanSync monorepo

- **`frontend/`** — Next.js 16 app (marketing, local PDF viewer, enterprise shell, PWA).
- **`backend/`** — Hono API and **Prisma** schema (`backend/prisma/`), Better Auth, Stripe webhooks, S3 presigns, workspaces/projects/files/issues, audit log, sheet locks, storage alerts (Resend).

## Quick start

1. **Postgres** (Docker):

   ```bash
   docker compose up -d
   ```

2. **Environment** — copy `.env.example` to `.env` in the repo root and set at least:
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/plansync`
   - `BETTER_AUTH_SECRET` (32+ random chars)
   - `BETTER_AUTH_URL=http://localhost:3000`
   - `CORS_ORIGIN=http://localhost:3000`
   - `PUBLIC_APP_URL=http://localhost:3000`

3. **Database schema** — put `DATABASE_URL` in the **repo root** `.env` or `.env.prod` (Prisma and the seed script load both). Then:

   ```bash
   npm run db:generate
   npm run db:push
   ```

   Optional **dev seed** (email/password user + a workspace with `subscriptionStatus=active`, no Stripe):

   ```bash
   npm run db:seed
   ```

   Defaults: `dev@plansync.local` / `devpassword123`. Override with `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`, `SEED_WORKSPACE_SLUG`.

   `npm run db:validate` checks the schema only; it uses a default `DATABASE_URL` for Prisma’s config parser and does not require a running database.

4. **Run web + API** — Next proxies `/api/*` to Hono ([docs/api-proxy.md](docs/api-proxy.md)):

   ```bash
   npm run dev
   ```

   Or run each workspace separately: `npm run dev:frontend`, `npm run dev:backend`.

5. Open **http://localhost:3000** — viewer stays free/local; **Sign in** hits Better Auth via the proxy. If you ran `npm run db:seed`, sign in with the seeded email/password and use the **dev** workspace (already Pro). Otherwise create a workspace via the API; **Pro** routes need `subscriptionStatus` active (Stripe or manual DB update / seed).

## Product rules (API)

- Default **10 GiB** workspace quota; **4 members** max (1 admin + 3).
- **Audit log** on mutating routes.
- **Stripe** webhooks idempotent via `ProcessedStripeEvent`.

## Scripts

| Script                      | Description                                           |
| --------------------------- | ----------------------------------------------------- |
| `npm run dev`               | Next (3000) + Hono API (8787) via `concurrently`      |
| `npm run dev:frontend`      | Next only                                             |
| `npm run dev:backend`       | Hono API only                                         |
| `npm run check`             | lint + typecheck + format:check + db:generate + build |
| `npm run db:push`           | `prisma db push`                                      |
| `npm run db:migrate`        | `prisma migrate dev`                                  |
| `npm run db:migrate:deploy` | `prisma migrate deploy` (production / CI)             |
| `npm run db:generate`       | Generate Prisma client                                |
| `npm run db:validate`       | `prisma validate`                                     |
| `npm run db:seed`           | Dev user + Pro workspace (see seed script)            |

## S3 (cloud PDF storage)

Optional. Set `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `S3_BUCKET` for the API. See **[docs/s3-setup.md](docs/s3-setup.md)** for bucket creation, **CORS** (required for browser uploads), and IAM policy.

## Deploying (Docker Compose / Dokploy)

- **Local Postgres only:** `docker compose up -d` (root `docker-compose.yml`).
- **Full stack (Next + API + Postgres):** use [`docker-compose.deploy.yml`](docker-compose.deploy.yml) — build context is the **repo root**. See [docs/deploy-dokploy.md](docs/deploy-dokploy.md) for env vars, migrations, and Dokploy.

Pre-commit (Husky): **lint-staged** (ESLint + Prettier on staged files), then **typecheck** all workspaces, then **`db:validate`**.
