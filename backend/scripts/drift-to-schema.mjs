/**
 * Print SQL to move the live database toward prisma/schema.prisma (e.g. add folderKey).
 * Run the output on the DB if non-empty, then: npm run db:migrate:baseline -w backend
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
config({ path: resolve(repoRoot, ".env.local"), override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (check repo root .env / .env.prod / .env.local).");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-url",
    url,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  { stdio: "inherit", cwd: backendRoot, env: process.env, shell: true },
);
process.exit(result.status ?? 1);
