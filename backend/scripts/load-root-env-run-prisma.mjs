/**
 * Load monorepo env then run Prisma.
 * Source of truth:
 * - local: `.env.local`
 * - production: `.env.prod`
 * `db:prod:*` scripts set PRISMA_SKIP_LOCAL so `.env.local` is ignored.
 *
 * CI has no `.env*` files; validate/generate only need a dummy DATABASE_URL present.
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const repoRoot = resolve(backendRoot, "..");

const skipLocal = process.env.PRISMA_SKIP_LOCAL === "1" || process.env.PRISMA_SKIP_LOCAL === "true";

// Always override shell-exported values so script-controlled precedence is deterministic.
config({ path: resolve(repoRoot, ".env.prod"), override: true });
if (!skipLocal) {
  config({ path: resolve(repoRoot, ".env.local"), override: true });
}

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/plansync";
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: load-root-env-run-prisma.mjs <prisma-args...>");
  process.exit(1);
}

const prismaJs = resolve(repoRoot, "node_modules/prisma/build/index.js");
const prismaBin = resolve(backendRoot, "node_modules/.bin/prisma");
const useJs = existsSync(prismaJs);

const result = useJs
  ? spawnSync(process.execPath, [prismaJs, ...args], {
      stdio: "inherit",
      cwd: backendRoot,
      env: process.env,
    })
  : spawnSync(prismaBin, args, {
      stdio: "inherit",
      cwd: backendRoot,
      env: process.env,
    });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.signal) {
  console.error(`prisma exited from signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
