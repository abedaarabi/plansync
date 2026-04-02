# syntax=docker/dockerfile:1
# Build from repository root:
#   docker build -f backend/Dockerfile .

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app
ENV HUSKY=0

COPY package.json package-lock.json ./
COPY backend ./backend

RUN npm ci
RUN npm run db:generate -w backend
RUN npm run build -w backend
RUN chmod +x backend/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 8787

CMD ["./backend/docker-entrypoint.sh"]
