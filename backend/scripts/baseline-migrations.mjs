/**
 * One-time fix for P3005: DB has schema but no `_prisma_migrations` history.
 * Marks every folder in `prisma/migrations` as already applied (no SQL run).
 *
 * Use only when the database schema already matches what those migrations would produce
 * (e.g. you used `db push` or restored from backup). Then `migrate deploy` works going forward.
 *
 * Usage (from repo root):
 *   npm run db:baseline
 */
import { config } from "dotenv";
import { readdir, stat } from "node:fs/promises";
import { join, dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..");
const repoRoot = join(backendRoot, "..");

const skipLocal = process.env.PRISMA_SKIP_LOCAL === "1" || process.env.PRISMA_SKIP_LOCAL === "true";
config({ path: pathResolve(repoRoot, ".env") });
config({ path: pathResolve(repoRoot, ".env.prod") });
config({ path: pathResolve(backendRoot, ".env") });
if (!skipLocal) {
  config({ path: pathResolve(repoRoot, ".env.local"), override: true });
}

const migrationsDir = join(backendRoot, "prisma", "migrations");

async function main() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();

  if (dirs.length === 0) {
    console.error("No migration folders found in", migrationsDir);
    process.exit(1);
  }

  console.log(`Baselining ${dirs.length} migrations (mark as applied, no SQL)…\n`);

  for (const name of dirs) {
    const migSql = join(migrationsDir, name, "migration.sql");
    try {
      await stat(migSql);
    } catch {
      console.warn(`Skip ${name} (no migration.sql)`);
      continue;
    }

    const r = spawnSync(
      "npx",
      ["prisma", "migrate", "resolve", "--applied", name],
      { cwd: backendRoot, stdio: "inherit", shell: true, env: process.env },
    );
    if (r.status !== 0) {
      console.error(`\nFailed on ${name}. If it says already recorded, you can continue from the next.`);
      process.exit(r.status ?? 1);
    }
  }

  console.log("\nDone. Run: npm run db:migrate:deploy (or db:prod:migrate:deploy)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
