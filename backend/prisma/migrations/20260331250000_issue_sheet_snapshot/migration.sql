-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "sheetName" TEXT,
ADD COLUMN "sheetVersion" INTEGER,
ADD COLUMN "pageNumber" INTEGER;

-- Join via WHERE so the UPDATE target is not referenced inside JOIN ON (PostgreSQL restriction).
UPDATE "Issue" AS i
SET
  "sheetName" = f.name,
  "sheetVersion" = fv.version
FROM "File" AS f,
     "FileVersion" AS fv
WHERE i."fileId" = f.id
  AND i."fileVersionId" = fv.id;
