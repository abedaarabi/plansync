/**
 * Fix local Prisma migration history drift:
 * 1) Record migrations as applied when the DB already matches (no re-run SQL).
 * 2) Refresh checksums in _prisma_migrations for edited / restored migration files.
 *
 * Do NOT delete rows from _prisma_migrations — that makes Prisma omit those migrations from
 * the expected schema and triggers false drift (e.g. Issue.bimAnchor "missing").
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const runner = resolve(backendRoot, "scripts/load-root-env-run-prisma.mjs");

function prisma(args) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: backendRoot,
    encoding: "utf8",
    shell: false,
  });
}

function resolveAppliedIfNeeded(migrationName) {
  const r = prisma(["migrate", "resolve", "--applied", migrationName]);
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status === 0) {
    console.log(`Recorded as applied: ${migrationName}`);
    return;
  }
  if (
    /already recorded as applied|P3008|Migration `[^`]+` is already recorded as applied/i.test(out)
  ) {
    console.log(`Already applied (skip): ${migrationName}`);
    return;
  }
  console.error(out || `(no output, exit ${r.status})`);
  console.error(`migrate resolve --applied ${migrationName} failed (exit ${r.status}).`);
  process.exit(r.status ?? 1);
}

console.log("Step 1/2: prisma migrate resolve --applied (baselining if row missing)…");
resolveAppliedIfNeeded("20260407120000_issue_bim_anchor");
resolveAppliedIfNeeded("20260412120002_proposal_takeoff_source_fileversion_idx");

console.log("Step 2/2: refresh checksums in _prisma_migrations…");
const exec = prisma([
  "db",
  "execute",
  "--schema",
  "prisma/schema.prisma",
  "--file",
  "prisma/repair-migration-drift.sql",
]);
if (exec.status !== 0) {
  console.error(exec.stdout ?? "");
  console.error(exec.stderr ?? "");
  process.exit(exec.status ?? 1);
}
console.log(exec.stdout ?? "");
console.log("Done. Run: npm run db:local:migrate -w backend");
