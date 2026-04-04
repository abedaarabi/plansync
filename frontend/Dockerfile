# syntax=docker/dockerfile:1
# Build from repository root:
#   docker build -f frontend/Dockerfile .
#
# Debian-based image: `sharp` (PWA asset script + Next image optimization) is unreliable
# on Alpine/musl under npm workspaces; glibc `linux-x64` binaries work consistently.

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
ENV HUSKY=0
# Dokploy/CI may set NODE_ENV=production; include dev + optional for `sharp` platform bindings.
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
# Tailwind v4 pulls native optional deps (`lightningcss`, `@tailwindcss/oxide`) that npm workspaces
# often omit. npm also rejects wrong CPU (EBADPLATFORM), so install only this image's Linux GNU bindings.
RUN npm ci --include=dev --include=optional
# Read versions from the root lockfile (lockfile v3 `packages` keys). Fails fast if Tailwind drops these entries.
RUN set -eu; \
  LC_VER=$(node -p "require('./package-lock.json').packages['node_modules/lightningcss']?.version ?? ''"); \
  OX_VER=$(node -p "require('./package-lock.json').packages['node_modules/@tailwindcss/oxide']?.version ?? ''"); \
  if [ -z "$LC_VER" ] || [ -z "$OX_VER" ]; then \
    echo "Dockerfile: could not read lightningcss / @tailwindcss/oxide versions from package-lock.json"; \
    exit 1; \
  fi; \
  ARCH="$(uname -m)"; \
  if [ "$ARCH" = "x86_64" ]; then \
    npm install --no-save --legacy-peer-deps \
      "lightningcss-linux-x64-gnu@${LC_VER}" \
      "@tailwindcss/oxide-linux-x64-gnu@${OX_VER}"; \
  elif [ "$ARCH" = "aarch64" ]; then \
    npm install --no-save --legacy-peer-deps \
      "lightningcss-linux-arm64-gnu@${LC_VER}" \
      "@tailwindcss/oxide-linux-arm64-gnu@${OX_VER}"; \
  else \
    echo "Unsupported arch for Tailwind native deps: $ARCH (need x86_64 or aarch64)"; \
    exit 1; \
  fi

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_SITE_URL=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_URL=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCIAL_AUTH=
ENV NEXT_PUBLIC_SOCIAL_AUTH=$NEXT_PUBLIC_SOCIAL_AUTH
ARG NEXT_PUBLIC_SMART_UPLOAD_FLOW=
ENV NEXT_PUBLIC_SMART_UPLOAD_FLOW=$NEXT_PUBLIC_SMART_UPLOAD_FLOW
ARG NEXT_PUBLIC_UMAMI_URL=
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID=
ENV NEXT_PUBLIC_UMAMI_URL=$NEXT_PUBLIC_UMAMI_URL
ENV NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID

ARG API_PROXY_TARGET=http://backend:8787
ENV API_PROXY_TARGET=$API_PROXY_TARGET

RUN npm run build -w @plansync/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG API_PROXY_TARGET=http://backend:8787
ENV API_PROXY_TARGET=$API_PROXY_TARGET

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app/frontend
CMD ["node", "server.js"]
