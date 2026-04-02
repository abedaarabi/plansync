/**
 * Print Prisma migration checksum (SHA-256 hex of migration.sql) and optional SQL.
 * Usage: node scripts/migration-checksum.mjs [migration_folder_name]
 * Example: node scripts/migration-checksum.mjs 20260330110000_add_file_folder_key
 *
 * If checksum drift caused "modified after it was applied", apply the SQL on the
 * server (after backing up) only if the DB already matches the migration SQL.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const name =
  process.argv[2] || "20260330110000_add_file_folder_key";
const sqlPath = resolve(
  backendRoot,
  "prisma/migrations",
  name,
  "migration.sql",
);

const buf = readFileSync(sqlPath);
const checksum = createHash("sha256").update(buf).digest("hex");

console.log("Migration:", name);
console.log("File:", sqlPath);
console.log("Checksum (sha256 hex):", checksum);
console.log("");
console.log("-- Run on PostgreSQL if you intentionally updated migration.sql and DB matches it:");
console.log(
  `UPDATE "_prisma_migrations" SET checksum = '${checksum}' WHERE migration_name = '${name}';`,
);
