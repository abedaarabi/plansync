#!/bin/sh
set -e
cd /app/backend
npx prisma migrate deploy
node ./scripts/seed-folder-templates.mjs
exec node /app/backend/dist/index.js
