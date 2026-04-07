/**
 * Load monorepo env then run Prisma.
 * Source of truth:
 * - local: `.env.local`
 * - production: `.env.prod`
 * `db:prod:*` scripts set PRISMA_SKIP_LOCAL so `.env.local` is ignored.
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: load-root-env-run-prisma.mjs <prisma-args...>");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  cwd: backendRoot,
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
