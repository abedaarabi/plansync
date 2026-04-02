-- Folder structure presets (ACC-style and variants). Seed rows via `npm run db:seed` or `node scripts/seed-folder-templates.mjs`.

CREATE TABLE "FolderStructureTemplate" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tree" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolderStructureTemplate_pkey" PRIMARY KEY ("slug")
);

CREATE INDEX "FolderStructureTemplate_isActive_sortOrder_idx" ON "FolderStructureTemplate"("isActive", "sortOrder");
