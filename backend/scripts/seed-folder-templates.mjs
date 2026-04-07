#!/usr/bin/env node
/**
 * Production-safe: insert missing `FolderStructureTemplate` rows from JSON.
 * Does not overwrite existing rows (preserves DB edits). Run after `prisma migrate deploy`.
 *
 * Loads env like `scripts/load-root-env-run-prisma.mjs`:
 * - production from `.env.prod`
 * - local override from `.env.local` (unless PRISMA_SKIP_LOCAL=1)
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const repoRoot = resolve(backendRoot, "..");
const skipLocal = process.env.PRISMA_SKIP_LOCAL === "1" || process.env.PRISMA_SKIP_LOCAL === "true";

config({ path: resolve(repoRoot, ".env.prod"), override: true });
if (!skipLocal) {
  config({ path: resolve(repoRoot, ".env.local"), override: true });
}

const prisma = new PrismaClient();

async function main() {
  const jsonPath = join(__dirname, "../prisma/folder-structure-templates-defaults.json");
  const raw = readFileSync(jsonPath, "utf8");
  const templates = JSON.parse(raw);

  for (const t of templates) {
    const existing = await prisma.folderStructureTemplate.findUnique({
      where: { slug: t.slug },
    });
    if (existing) continue;

    await prisma.folderStructureTemplate.create({
      data: {
        slug: t.slug,
        name: t.name,
        description: t.description,
        sortOrder: t.sortOrder,
        tree: t.tree,
        isActive: t.isActive ?? true,
      },
    });
    console.log(`Folder template created: ${t.slug}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
