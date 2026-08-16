# Deploy with Docker Compose (including Dokploy)

Production images are **built on GitHub Actions** and pushed to **private GHCR**. Dokploy (or any host) only **pulls** finished images and restarts containers — it must not compile on the VPS.

Image definitions (still used by CI to build):

- [`frontend/Dockerfile`](../frontend/Dockerfile) — Next.js `standalone` output
- [`backend/Dockerfile`](../backend/Dockerfile) — compiled Hono API

Published images (default owner `abedaarabi`):

- `ghcr.io/abedaarabi/plansync-frontend:<tag>`
- `ghcr.io/abedaarabi/plansync-backend:<tag>`

Tags:

| Tag              | Purpose                                               |
| ---------------- | ----------------------------------------------------- |
| `production`     | Mutable deploy target (Dokploy pulls this by default) |
| `<full-git-sha>` | Immutable rollback / audit pin                        |

## Pipeline

```text
push to main
  → CI: npm run check
  → (if green) build only changed service image(s) on GitHub
  → push to private GHCR
  → call Dokploy deploy webhook
  → Dokploy pulls images + restarts
```

PRs run **check only** (no image push, no Dokploy). Failed checks never trigger a deploy. Docs-only changes that do not touch app/compose paths do not deploy.

See [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Compose file

[`docker-compose.deploy.yml`](../docker-compose.deploy.yml) runs **backend** and **frontend** from GHCR (`image:` + `pull_policy: always`). **Postgres is not included** — set `DATABASE_URL` to your managed DB or another container on the same Docker network.

Optional image overrides (Dokploy env):

| Variable             | Default                                | Purpose                                      |
| -------------------- | -------------------------------------- | -------------------------------------------- |
| `FRONTEND_IMAGE`     | `ghcr.io/abedaarabi/plansync-frontend` | Image repository                             |
| `BACKEND_IMAGE`      | `ghcr.io/abedaarabi/plansync-backend`  | Image repository                             |
| `FRONTEND_IMAGE_TAG` | `production`                           | Tag to pull (use a full git SHA to rollback) |
| `BACKEND_IMAGE_TAG`  | `production`                           | Tag to pull (use a full git SHA to rollback) |

Pull and run on a host that is already logged into GHCR:

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/plansync"
export PUBLIC_APP_URL=https://your-domain.example   # no trailing slash
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d
```

Do **not** use `docker compose … --build` for production — images come from GHCR.

To build an image locally for debugging (optional):

```bash
docker build -f frontend/Dockerfile -t ghcr.io/abedaarabi/plansync-frontend:local .
docker build -f backend/Dockerfile -t ghcr.io/abedaarabi/plansync-backend:local .
```

## One-time setup (GitHub)

### 1. Repository variables (frontend image build-args)

GitHub → **Settings → Secrets and variables → Actions → Variables**. Set any `NEXT_PUBLIC_*` values that must be baked into the Next.js production client:

| Variable                        | Purpose                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`          | Public site origin                                           |
| `NEXT_PUBLIC_APP_URL`           | App origin (often same as site)                              |
| `NEXT_PUBLIC_API_URL`           | Public API origin if the browser calls the API host directly |
| `NEXT_PUBLIC_SOCIAL_AUTH`       | Social auth flag (if used)                                   |
| `NEXT_PUBLIC_SMART_UPLOAD_FLOW` | Smart upload flag (if used)                                  |
| `NEXT_PUBLIC_UMAMI_URL`         | Umami script origin (optional)                               |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID`  | Umami site id (optional)                                     |

Empty variables are fine; the Docker build passes empty strings.

### 2. Repository secret (Dokploy webhook)

GitHub → **Settings → Secrets and variables → Actions → Secrets**:

| Secret                   | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `DOKPLOY_DEPLOY_WEBHOOK` | Full Dokploy compose **deploy webhook** URL |

The workflow calls this URL only after CI passes and image push succeeds (or was skipped because that service did not change). If the secret is missing, the deploy job fails without changing production containers.

### 3. Keep GHCR packages private

After the first successful image push:

1. GitHub → **Packages** → `plansync-frontend` / `plansync-backend`
2. Package settings → visibility **Private**
3. Ensure the package is linked to this repository (Actions `GITHUB_TOKEN` can then push)

## One-time setup (Dokploy)

### 1. Compose application

Create a Compose application pointing at this repo with compose file **`docker-compose.deploy.yml`**.

**Disable source-triggered builds / auto-deploy from git.** Dokploy must not run `docker build` on the VPS. Deployment should be **pull images + recreate**, triggered by the webhook from GitHub Actions.

### 2. Registry login (private GHCR)

1. Create a GitHub **fine-grained** personal access token (or classic PAT) with **`read:packages`** only (least privilege for pulls).
2. In Dokploy (or on the VPS Docker host), log in to GHCR:

```bash
echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Store the same credentials in Dokploy’s registry/credentials UI if available so compose pulls work during webhook deploys.

### 3. Environment variables

Define at least:

| Variable             | Purpose                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Full Postgres connection string reachable from the **backend** container (host = service name or IP on shared network). |
| `PUBLIC_APP_URL`     | Public HTTPS origin of the app (same value for Better Auth and CORS), e.g. `https://app.example.com`                    |
| `BETTER_AUTH_SECRET` | Long random string (32+ characters)                                                                                     |

Optional (same names as `.env.example`): `AWS_*`, `S3_BUCKET`, `STRIPE_*`, `RESEND_*`, `GEMINI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY`) and optional `GEMINI_MODEL` for Sheet AI, `NEXT_PUBLIC_UMAMI_*` (runtime is not required for Umami if already baked via GitHub variables). For S3, configure bucket **CORS** for your public app origin — see [s3-setup.md](./s3-setup.md).

**Web Push (device alerts):** set all three on the Dokploy project env so the **`backend`** service receives them (they are passed through in [`docker-compose.deploy.yml`](../docker-compose.deploy.yml) under `services.backend.environment`):

| Variable            | Purpose                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`  | From `npx web-push generate-vapid-keys` (public line).                                    |
| `VAPID_PRIVATE_KEY` | Same command (private line). Treat as a secret.                                           |
| `VAPID_SUBJECT`     | Contact for push providers, e.g. `mailto:you@yourdomain.com` or `https://yourdomain.com`. |

Redeploy after adding. Backend logs should show `[web-push] VAPID env present — device push API enabled` when all three are non-empty inside the API container.

The compose file does **not** publish Next on a host port; Traefik routes using the Docker network and labels. To hit Next directly on the host for debugging, add a `ports:` override (e.g. `3001:3000`) in a local override file.

### 4. Wire the webhook

1. In Dokploy, open the compose application → copy the **Deploy webhook** URL.
2. Paste it into the GitHub secret `DOKPLOY_DEPLOY_WEBHOOK`.
3. Push to `main` (or re-run the workflow) and confirm Actions → **deploy** job succeeds and Dokploy pulls new images.

## First release checklist

1. GitHub variables + `DOKPLOY_DEPLOY_WEBHOOK` secret set.
2. Dokploy logged into `ghcr.io` with a read-only packages token.
3. Dokploy auto-build from git **off**; compose uses `docker-compose.deploy.yml`.
4. Merge/push to `main` → Actions **check** green → **build-\*** jobs push images → **deploy** webhook fires.
5. Confirm packages exist under GHCR and are **private**.
6. Confirm containers are healthy in Dokploy and the public site/API respond.
7. If the deploy job fails with a missing webhook secret, production containers are unchanged — fix the secret and re-run the failed jobs.

## How to see build failures

1. GitHub → **Actions** → failed workflow run (red ✕).
2. Open the failed job (`check`, `build-frontend`, `build-backend`, or `deploy`).
3. Read the step log for the exact error.
4. Production keeps the previous image until a later successful deploy.

## Rollback

1. Find a known-good commit SHA (full 40 characters) that was previously pushed as an image tag.
2. In Dokploy env, set for example:
   - `FRONTEND_IMAGE_TAG=<sha>`
   - `BACKEND_IMAGE_TAG=<sha>`
3. Trigger a Dokploy redeploy (webhook or UI). Compose pulls those immutable tags.
4. When ready to track tip again, set both tags back to `production` (or leave unset) and redeploy after the next green Actions run.

## Database migrations (production)

The **backend image** runs `prisma migrate deploy` on each container start (see `backend/docker-entrypoint.sh`), then starts the API. New migrations in `backend/prisma/migrations/` apply automatically when you deploy a new image, as long as `DATABASE_URL` is set and the migration history is valid.

You can still run migrations manually if needed:

```bash
# From repo root, with DATABASE_URL pointing at production Postgres:
npm run db:migrate:deploy
```

For a one-off run against the same DB as Compose (replace stack name if different):

```bash
docker compose -f docker-compose.deploy.yml exec backend \
  sh -c 'cd backend && npx prisma migrate deploy'
```

(Requires `DATABASE_URL` inside the container — the compose file already sets it for `backend`.)

**Local dev:** if your database was created without Prisma migration history (`migrate deploy` fails with P3005), use `npm run db:push` once to sync the schema, or run a [baseline](https://www.pris.ly/d/migrate-baseline) so `migrate deploy` works.

## Notes

- Dockerfiles still expect the **repo root** as build context (CI builds that way). Dokploy no longer builds.
- The **backend** image runs `node backend/dist/index.js`; Prisma client is generated at image build time on GitHub.
- Health checks hit the API JSON home route and the Next.js root; frontend waits until backend is healthy before starting.
- Moving later to EC2/ECS keeps the same GHCR images; only the pull/restart target changes.
