/**
 * Load monorepo env before Prisma reads `schema.prisma`.
 * Source of truth:
 * - local: `.env.local`
 * - production: `.env.prod`
 * `db:prod:*` scripts set PRISMA_SKIP_LOCAL to ignore `.env.local`.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = __dirname;
const repoRoot = path.resolve(backendRoot, "..");

const skipLocal = process.env.PRISMA_SKIP_LOCAL === "1" || process.env.PRISMA_SKIP_LOCAL === "true";

config({ path: path.join(repoRoot, ".env.prod"), override: true });
if (!skipLocal) {
  config({ path: path.join(repoRoot, ".env.local"), override: true });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
