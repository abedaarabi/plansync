-- Databases baselined with `migrate resolve` but never ran init SQL are missing `File.folderKey`.
-- Safe if the column/index already exists (e.g. full init was applied).

ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "folderKey" TEXT NOT NULL DEFAULT '';

UPDATE "File" SET "folderKey" = COALESCE("folderId", '');

-- Pre-unique: duplicate logical files (same project + name + folder) must get distinct names.
-- Keeps earliest row (by createdAt, id); renames others with a stable id suffix.
UPDATE "File" f
SET name = f.name || ' [' || f.id || ']'
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "projectId", name, "folderKey"
           ORDER BY "createdAt" ASC, id ASC
         ) AS rn
  FROM "File"
) r
WHERE f.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "File_projectId_name_folderKey_key" ON "File"("projectId", "name", "folderKey");
