# PlanSync — Developer guide

This guide walks you through running PlanSync locally and understanding how the pieces fit together. It is written for engineers onboarding to the codebase or operating the app like a production SaaS (environments, migrations, optional cloud services).

For a shorter checklist, see the [README](../README.md). For deployment (Docker Compose, Dokploy), see [deploy-dokploy.md](./deploy-dokploy.md).

---

## What you are running

PlanSync is a **monorepo**: a Next.js web app talks to a **Hono** API and a **PostgreSQL** database. Authentication is **Better Auth**. Optional integrations include **AWS S3** (file storage), **Stripe** (billing), and **Resend** (email).

| Layer   | Location          | Role                                                                |
| ------- | ----------------- | ------------------------------------------------------------------- |
| Web app | `frontend/`       | Next.js UI, marketing, PDF viewer, PWA; proxies `/api/*` to the API |
| API     | `backend/`        | REST-style routes, Prisma, auth, webhooks                           |
| Data    | `backend/prisma/` | Schema, migrations, Prisma Client                                   |

```mermaid
flowchart LR
  subgraph browser [Browser]
    UI[Next.js app]
  end
  subgraph host [Your machine or server]
    UI -->|"/api/* proxy"| API[Hono API]
    API --> DB[(PostgreSQL)]
    API -.-> S3[(S3 optional)]
    API -.-> Stripe[Stripe optional]
    API -.-> Resend[Resend optional]
  end
```

---

## Prerequisites

- **Node.js** 20 LTS or newer (recommended; align with your team’s standard).
- **npm** (ships with Node).
- **Docker Desktop** (or Docker Engine) for local PostgreSQL via Compose.
- **Git** (for clone and hooks).

---

## 1. Clone and install dependencies

```bash
git clone <repository-url>
cd plansync
npm install
```

The repo uses **npm workspaces** (`frontend` and `backend`). Install once from the repository root.

---

## 2. Environment variables

Configuration is layered so you can keep **secrets out of git** and still switch between **local** and **remote** databases.

| File           | Committed | Typical use                                                                                                             |
| -------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `.env.example` | Yes       | Template; copy values into your own files                                                                               |
| `.env`         | No        | Your defaults (often gitignored)                                                                                        |
| `.env.prod`    | No        | Production-style overrides (optional)                                                                                   |
| `.env.local`   | No        | **Local overrides** only; use for `DATABASE_URL` pointing at Docker Postgres while `.env` still references a remote URL |

Load order for the app and Prisma helpers: `.env` → `.env.prod` → `backend/.env` → `.env.local` (last wins for overlapping keys).

**Minimum for local development** (in `.env` or `.env` + `.env.local`):

| Variable             | Example (local)                                          |
| -------------------- | -------------------------------------------------------- |
| `DATABASE_URL`       | `postgresql://postgres:postgres@localhost:5432/plansync` |
| `BETTER_AUTH_SECRET` | 32+ random characters                                    |
| `BETTER_AUTH_URL`    | `http://localhost:3000`                                  |
| `CORS_ORIGIN`        | `http://localhost:3000`                                  |
| `PUBLIC_APP_URL`     | `http://localhost:3000`                                  |

Copy from `.env.example` and adjust. Never commit real secrets.

---

## 3. PostgreSQL (Docker)

Start Postgres locally:

```bash
docker compose up -d
```

This uses the root [`docker-compose.yml`](../docker-compose.yml): Postgres **16**, user `postgres`, password `postgres`, database `plansync`, port **5432**.

To stop:

```bash
docker compose down
```

---

## 4. Database schema and migrations

### First-time setup (typical local)

Generate the Prisma Client and apply the schema to your empty database:

```bash
npm run db:generate
npm run db:push
```

`db push` is ideal for rapid local iteration. For **migration history** and **production**, prefer `migrate dev` / `migrate deploy` (see below).

### Seeded demo data (optional)

Creates a password user and a workspace with Pro-like settings (no Stripe required):

```bash
npm run db:seed
```

Default credentials are documented in the seed script; you can override with `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`, and `SEED_WORKSPACE_SLUG`.

### Folder structure presets (optional)

Inserts default **AEC folder tree** presets into `FolderStructureTemplate` (for the Projects UI). Safe to re-run: only **missing** slugs are added; existing rows are left as-is.

```bash
npm run db:seed:templates
```

Requires `DATABASE_URL` (same as other Prisma commands). Run after migrations or `db push` so the table exists.

### Local vs production Prisma commands

| Goal                                                   | Command                          |
| ------------------------------------------------------ | -------------------------------- |
| Open Prisma Studio (local DB when `.env.local` is set) | `npm run db:local:studio`        |
| Generate client                                        | `npm run db:local:generate`      |
| `db push` (dev)                                        | `npm run db:local:push`          |
| Create / apply migrations in dev                       | `npm run db:local:migrate`       |
| **Production** deploy migrations (no `.env.local`)     | `npm run db:prod:migrate:deploy` |
| Studio against **remote** `.env` / `.env.prod` only    | `npm run db:prod:studio`         |

Scripts prefixed with `db:prod:` set `PRISMA_SKIP_LOCAL` so `.env.local` does not override `DATABASE_URL`—use when you have a local override file but need to target CI or a remote database.

---

## 5. Run the application

### Full stack (recommended)

```bash
npm run dev
```

This starts:

- **Next.js** on `http://localhost:3000`
- **Hono API** on `http://127.0.0.1:8787`

The browser only talks to **port 3000**. Next.js **proxies** `/api/*` to Hono so cookies and auth stay on the same origin. See [api-proxy.md](./api-proxy.md).

### Run services separately

| Command                | Purpose   |
| ---------------------- | --------- |
| `npm run dev:frontend` | Next only |
| `npm run dev:backend`  | API only  |

Use `API_PROXY_TARGET` if the API listens on a non-default host or port (see [api-proxy.md](./api-proxy.md)).

---

## 6. Verify everything works

1. Open **http://localhost:3000**.
2. If you ran `npm run db:seed`, sign in with the seeded email and password.
3. Without a seed, you will need to create accounts and workspaces through the product flows or API; Pro-gated features expect a workspace with an active subscription (Stripe or seed).

---

## 7. Optional cloud services

These are not required for basic local UI and API development, but they enable full SaaS behavior.

| Service                          | Docs                                                               |
| -------------------------------- | ------------------------------------------------------------------ |
| **S3** (uploads, PDF storage)    | [s3-setup.md](./s3-setup.md)                                       |
| **Stripe**                       | Variables in `.env.example`; webhooks must reach your deployed API |
| **Resend** (transactional email) | Set `RESEND_API_KEY` and `RESEND_FROM` for production mail flows   |

---

## 8. Quality checks and Git hooks

**On every commit**, Husky runs:

1. **lint-staged** — ESLint + Prettier on staged files; **`prisma format`** if `backend/prisma/schema.prisma` changed.
2. **Typecheck** — all workspaces.
3. **`npm run test`** — Vitest for `backend/` and `frontend/` (no database required for current tests).
4. **`npm run db:precommit`** — `prisma validate`, **`prisma format --check`**, and **`prisma generate`**. This keeps the Prisma schema valid, consistently formatted, and the generated client aligned with the schema. **No database connection is required.**

These checks do **not** run `migrate dev` or compare migrations to a live database (Prisma needs a shadow database URL for that). When you change the schema, create or update migrations locally with `npm run db:local:migrate`, commit the `prisma/migrations` folder, and apply in production with **`npm run db:prod:migrate:deploy`**.

To skip hooks (use sparingly): `git commit --no-verify`.

**Before you push**, run the full CI-like script:

```bash
npm run check
```

This runs lint, typecheck, `format:check`, **`npm run test`** (Vitest in `backend/` and `frontend/`), **`db:precommit`**, and a full build. Use this (or your CI running the same steps) before merging or deploying to production.

### Tests

| Area                            | Location                    | Runner                          |
| ------------------------------- | --------------------------- | ------------------------------- |
| Backend — pure logic, API smoke | `backend/src/**/*.test.ts`  | `npm run test -w backend`       |
| Frontend — lib helpers          | `frontend/src/**/*.test.ts` | `npm run test -w @plansync/web` |

From the repo root, **`npm run test`** runs both. Add tests for new behavior next to the code under test (`*.test.ts`). End-to-end tests with a browser are not in this repo yet; add Playwright or similar in CI when you need full user flows.

On **GitHub**, the workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs **`npm run check`** on pushes and pull requests to `main`.

---

## 9. Production deployment

- **Docker Compose** (Next + API + external Postgres): [deploy-dokploy.md](./deploy-dokploy.md).

Production databases should use **`prisma migrate deploy`**, not `db push`, unless you have a deliberate exception.

---

## 10. Troubleshooting

| Symptom                                     | What to check                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL` points at the wrong database | `.env.local` overrides `.env`; use `db:prod:*` to target `.env` / `.env.prod` only                                       |
| Prisma cannot connect                       | Postgres is up (`docker compose ps`), port 5432 is free, credentials match `docker-compose.yml`                          |
| Auth or cookies fail                        | `BETTER_AUTH_URL`, `CORS_ORIGIN`, and `PUBLIC_APP_URL` match the URL you open in the browser (including scheme and port) |
| API 404 from the browser                    | Use the Next app URL; do not call `8787` directly from the browser unless CORS and cookie are configured for that        |

---

## Related documentation

- [README](../README.md) — quick start and script index
- [API proxy](./api-proxy.md) — how `/api/*` reaches Hono
- [S3 setup](./s3-setup.md) — bucket, IAM, CORS
- [Deploy (Dokploy / Compose)](./deploy-dokploy.md) — production images and env

-pm run db:local:generate prisma generate (uses .env.local if present)
npm run db:local:push prisma db push
npm run db:local:studio Prisma Studio
npm run db:local:migrate prisma migrate dev
npm run db:prod:generate prisma generate without .env.local
npm run db:prod:push db push without .env.local
npm run db:prod:studio Studio against prod URL from .env / .env.prod
npm run db:prod:migrate:deploy migrate deploy without .env.local
