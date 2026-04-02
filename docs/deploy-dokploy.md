# Deploy with Docker Compose (including Dokploy)

The monorepo builds **from the repository root**. Image definitions:

- [`frontend/Dockerfile`](../frontend/Dockerfile) — Next.js `standalone` output
- [`backend/Dockerfile`](../backend/Dockerfile) — compiled Hono API

## Compose file

[`docker-compose.deploy.yml`](../docker-compose.deploy.yml) runs **postgres**, **backend**, and **frontend**. The frontend build receives `API_PROXY_TARGET=http://backend:8787` so Next can proxy `/api/*` to the API inside the Docker network.

Run locally:

```bash
export PUBLIC_APP_URL=https://your-domain.example   # no trailing slash
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
docker compose -f docker-compose.deploy.yml up -d --build
```

## Environment variables (Dokploy)

In Dokploy, create a Compose application pointing at this repo and set the compose file to **`docker-compose.deploy.yml`**. Define at least:

| Variable             | Purpose                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `PUBLIC_APP_URL`     | Public HTTPS origin of the app (same value for Better Auth and CORS), e.g. `https://app.example.com` |
| `BETTER_AUTH_SECRET` | Long random string (32+ characters)                                                                  |
| `POSTGRES_PASSWORD`  | Optional; defaults to `postgres` if unset                                                            |

Optional (same names as `.env.example`): `AWS_*`, `S3_BUCKET`, `STRIPE_*`, `RESEND_*`, `NEXT_PUBLIC_UMAMI_*`. For S3, configure bucket **CORS** for your public app origin — see [s3-setup.md](./s3-setup.md).

`FRONTEND_PORT` maps the host port for the Next container (default `3000`). Put TLS and your public hostname on Dokploy’s reverse proxy in front of that port.

## Database migrations (production)

Use **migrate deploy**, not `db:push`:

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

## Notes

- **Build context** must be the repo root so `package-lock.json` and workspaces resolve. In Dokploy, set the build context to the project root, not `frontend/` alone.
- The **backend** image runs `node backend/dist/index.js`; Prisma client is generated at build time.
