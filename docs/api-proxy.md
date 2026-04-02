# API proxy (Next.js → Hono)

The Next app proxies **`/api/*`** to Hono using the App Router handler at [`frontend/src/app/api/[[...path]]/route.ts`](../frontend/src/app/api/[[...path]]/route.ts) (not `next.config` rewrites), so **multiple `Set-Cookie` headers** from Better Auth are forwarded correctly.

- Default target: `http://127.0.0.1:8787`
- Override with **`API_PROXY_TARGET`** (required at **runtime** in Docker — see `docker-compose.deploy.yml`).

This keeps **Better Auth** session cookies on the **same site** as the UI (`localhost:3000` or `https://plansync.dev`), avoiding cross-origin cookie issues for `/api/auth/*`.

**Environment**

- **Browser / Better Auth `baseURL`**: use the **public app URL** (e.g. `http://localhost:3000`), not the Hono port.
- **Hono `BETTER_AUTH_URL`**: same public URL.
- **Hono `CORS_ORIGIN`**: `http://localhost:3000` (or your deployed app origin).

**Production**

- Run Next and API behind a reverse proxy with a shared host, or set `API_PROXY_TARGET` to your internal API URL.
