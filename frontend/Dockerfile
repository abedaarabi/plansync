# syntax=docker/dockerfile:1
# Build from repository root:
#   docker build -f frontend/Dockerfile .
#
# Debian-based image: `sharp` (PWA icon script + Next image optimization) is unreliable
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
# Optional platform bindings for lightningcss (Tailwind v4) are often missing after `npm ci`
# in workspaces. npm rejects the wrong CPU (EBADPLATFORM), so install only the binding for this image arch.
RUN npm ci --include=dev --include=optional
RUN LC_VER=$(node -p "require('./package-lock.json').packages['node_modules/lightningcss'].version") \
  && ARCH="$(uname -m)" \
  && if [ "$ARCH" = "x86_64" ]; then \
       npm install --no-save --legacy-peer-deps "lightningcss-linux-x64-gnu@${LC_VER}"; \
     elif [ "$ARCH" = "aarch64" ]; then \
       npm install --no-save --legacy-peer-deps "lightningcss-linux-arm64-gnu@${LC_VER}"; \
     else \
       echo "Unsupported arch for lightningcss: $ARCH (add a branch in frontend/Dockerfile)" && exit 1; \
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
