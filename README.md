# PlanSync monorepo

- **`frontend/`** — Next.js 16 app (marketing, local PDF viewer, enterprise shell, PWA).
- **`backend/`** — Hono API and **Prisma** schema (`backend/prisma/`), Better Auth, Stripe webhooks, S3 presigns, workspaces/projects/files/issues, audit log, sheet locks, storage alerts (Resend).

**Full developer guide** (architecture, environments, Prisma, troubleshooting): [docs/getting-started.md](docs/getting-started.md). **CI** runs `npm run check` on PRs and pushes (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

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

   If `.env` already points at a remote database but you want **local Docker Postgres** for development, add a repo root **`.env.local`** (gitignored) with only `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/plansync`. It is loaded after `.env` / `.env.prod` and overrides `DATABASE_URL`.

3. **Database schema** — put `DATABASE_URL` in the **repo root** `.env`, `.env.prod`, or `.env.local` (Prisma and the seed script load all three in that order). Then:

   ```bash
   npm run db:generate
   npm run db:push
   ```

   **Scripts** — `db:local:*` (studio, generate, push, migrate) use `.env.local` when present. **`db:prod:*`** (generate, push, studio, `migrate:deploy`) set `PRISMA_SKIP_LOCAL` so only `.env` / `.env.prod` apply—use for CI or when targeting a remote DB while `.env.local` exists.

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

| Script                      | Description                                                                   |
| --------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`               | Next (3000) + Hono API (8787) via `concurrently`                              |
| `npm run dev:frontend`      | Next only                                                                     |
| `npm run dev:backend`       | Hono API only                                                                 |
| `npm run test`              | Vitest — backend + frontend unit / smoke tests                                |
| `npm run check`             | lint + typecheck + format + **test** + db:precommit + build (run before prod) |
| `npm run db:push`           | `prisma db push`                                                              |
| `npm run db:migrate`        | `prisma migrate dev`                                                          |
| `npm run db:migrate:deploy` | `prisma migrate deploy` (production / CI)                                     |
| `npm run db:generate`       | Generate Prisma client                                                        |
| `npm run db:validate`       | `prisma validate`                                                             |
| `npm run db:precommit`      | validate + `format --check` + `generate` (also runs on commit)                |
| `npm run db:seed`           | Dev user + Pro workspace (see seed script)                                    |
| `npm run db:seed:templates` | Folder structure presets only (`FolderStructureTemplate`) — local DB          |

## S3 (cloud PDF storage)

Optional. Set `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `S3_BUCKET` for the API. See **[docs/s3-setup.md](docs/s3-setup.md)** for bucket creation, **CORS** (required for browser uploads), and IAM policy.

## Deploying (Docker Compose / Dokploy)

- **Local Postgres only:** `docker compose up -d` (root `docker-compose.yml`).
- **Full stack (Next + API + Postgres):** use [`docker-compose.deploy.yml`](docker-compose.deploy.yml) — build context is the **repo root**. See [docs/deploy-dokploy.md](docs/deploy-dokploy.md) for env vars, migrations, and Dokploy.

Pre-commit (Husky): **lint-staged**, then **typecheck**, then **`npm run test`**, then **`db:precommit`** (Prisma validate, **`format --check`**, **`generate`**).
