# Deploy with Docker Compose (including Dokploy)

The monorepo builds **from the repository root**. Image definitions:

- [`frontend/Dockerfile`](../frontend/Dockerfile) — Next.js `standalone` output
- [`backend/Dockerfile`](../backend/Dockerfile) — compiled Hono API

## Compose file

[`docker-compose.deploy.yml`](../docker-compose.deploy.yml) runs **backend** and **frontend**. **Postgres is not included** — set `DATABASE_URL` to your existing database (managed Postgres or another container on the same Docker network). The frontend build receives `API_PROXY_TARGET=http://backend:8787` so Next can proxy `/api/*` to the API inside the Docker network.

Run locally:

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/plansync"
export PUBLIC_APP_URL=https://your-domain.example   # no trailing slash
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
docker compose -f docker-compose.deploy.yml up -d --build
```

## Environment variables (Dokploy)

In Dokploy, create a Compose application pointing at this repo and set the compose file to **`docker-compose.deploy.yml`**. Define at least:

| Variable             | Purpose                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Full Postgres connection string reachable from the **backend** container (host = service name or IP on shared network). |
| `PUBLIC_APP_URL`     | Public HTTPS origin of the app (same value for Better Auth and CORS), e.g. `https://app.example.com`                    |
| `BETTER_AUTH_SECRET` | Long random string (32+ characters)                                                                                     |

Optional (same names as `.env.example`): `AWS_*`, `S3_BUCKET`, `STRIPE_*`, `RESEND_*`, `GEMINI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY`) and optional `GEMINI_MODEL` for Sheet AI, `NEXT_PUBLIC_UMAMI_*`. For S3, configure bucket **CORS** for your public app origin — see [s3-setup.md](./s3-setup.md).

**Web Push (device alerts):** set all three on the Dokploy project env so the **`backend`** service receives them (they are passed through in [`docker-compose.deploy.yml`](../docker-compose.deploy.yml) under `services.backend.environment`):

| Variable            | Purpose                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`  | From `npx web-push generate-vapid-keys` (public line).                                    |
| `VAPID_PRIVATE_KEY` | Same command (private line). Treat as a secret.                                           |
| `VAPID_SUBJECT`     | Contact for push providers, e.g. `mailto:you@yourdomain.com` or `https://yourdomain.com`. |

Redeploy after adding. Backend logs should show `[web-push] VAPID env present — device push API enabled` when all three are non-empty inside the API container.

The compose file does **not** publish Next on a host port; Traefik routes using the Docker network and labels. To hit Next directly on the host for debugging, add a `ports:` override (e.g. `3001:3000`) in a local override file.

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

- **Build context** must be the repo root so `package-lock.json` and workspaces resolve. In Dokploy, set the build context to the project root, not `frontend/` alone.
- The **backend** image runs `node backend/dist/index.js`; Prisma client is generated at build time.
