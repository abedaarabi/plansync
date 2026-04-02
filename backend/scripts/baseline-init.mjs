/**
 * Mark 20260330100000_init as applied without running SQL (fixes Prisma P3005 on first deploy to non-empty DB).
 * Use only when the database already matches that migration (after db push or manual SQL from drift-to-schema).
 * Next: npm run db:migrate:deploy -w backend
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

const result = spawnSync(
  "npx",
  ["prisma", "migrate", "resolve", "--applied", "20260330100000_init"],
  { stdio: "inherit", cwd: backendRoot, env: process.env, shell: true },
);
if ((result.status ?? 1) === 0) {
  console.error("\nNext: npm run db:migrate:deploy -w backend\n");
}
process.exit(result.status ?? 1);
