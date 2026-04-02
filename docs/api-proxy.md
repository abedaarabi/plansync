# API proxy (Next.js → Hono)

In development and when `API_PROXY_TARGET` is set, the Next app rewrites:

- `http://localhost:3000/api/*` → `http://127.0.0.1:8787/api/*` (default)

This keeps **Better Auth** session cookies on the **same site** as the UI (`localhost:3000`), avoiding cross-origin cookie issues.

**Environment**

- **Browser / Better Auth `baseURL`**: use the **public app URL** (e.g. `http://localhost:3000`), not the Hono port.
- **Hono `BETTER_AUTH_URL`**: same public URL.
- **Hono `CORS_ORIGIN`**: `http://localhost:3000` (or your deployed app origin).

**Production**

- Run Next and API behind a reverse proxy with a shared host, or set `API_PROXY_TARGET` to your internal API URL.
