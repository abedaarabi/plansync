/**
 * Load monorepo env (repo root `.env`, `.env.prod`, `backend/.env`) then run Prisma.
 * Prisma CLI only auto-loads `.env` next to the schema; we load repo-root `.env.prod` for DATABASE_URL etc.
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const repoRoot = resolve(backendRoot, "..");

config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, ".env.prod") });
config({ path: resolve(backendRoot, ".env") });

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
