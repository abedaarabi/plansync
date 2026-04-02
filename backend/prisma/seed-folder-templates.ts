import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Prisma, PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));

type DefaultRow = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  tree: unknown;
  isActive?: boolean;
};

/**
 * Inserts default presets only when a slug is missing — never overwrites rows
 * so manual DB edits stay in effect. New slugs added to the JSON file are inserted on the next run.
 */
export async function seedFolderStructureTemplates(prisma: PrismaClient): Promise<void> {
  const jsonPath = join(__dirname, "folder-structure-templates-defaults.json");
  const raw = readFileSync(jsonPath, "utf8");
  const templates = JSON.parse(raw) as DefaultRow[];

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
        tree: t.tree as Prisma.InputJsonValue,
        isActive: t.isActive ?? true,
      },
    });
  }
}
