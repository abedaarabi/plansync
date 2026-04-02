/**
 * Load monorepo env before Prisma reads `schema.prisma` (same order as
 * `scripts/load-root-env-run-prisma.mjs`). Without this, `npx prisma studio`
 * from `backend/` fails: "Environment variable not found: DATABASE_URL" when
 * `DATABASE_URL` only exists in the repo root `.env`.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = __dirname;
const repoRoot = path.resolve(backendRoot, "..");

config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(repoRoot, ".env.prod") });
config({ path: path.join(backendRoot, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
