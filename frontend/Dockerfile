# syntax=docker/dockerfile:1
# Build from repository root:
#   docker build -f frontend/Dockerfile .

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
ENV HUSKY=0
# Dokploy/CI often sets NODE_ENV=production, which makes `npm ci` skip devDependencies.
# `sharp` is required for `prebuild` → `icons:pwa` (generate-pwa-icons.mjs).
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci --include=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Public / analytics (baked into client bundle where used)
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

# Proxy /api → Hono (compose service name; set at build time for rewrites in next.config)
ARG API_PROXY_TARGET=http://backend:8787
ENV API_PROXY_TARGET=$API_PROXY_TARGET

RUN npm run build -w @plansync/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next standalone output (monorepo): server.js lives under standalone/frontend/
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app/frontend
CMD ["node", "server.js"]
