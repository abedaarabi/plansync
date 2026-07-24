-- Prisma upsert needs a non-partial unique index on (fileVersionId, sourceBimKey).
-- The BIM platform migration originally used a partial index (WHERE sourceBimKey IS NOT NULL),
-- which PostgreSQL rejects for ON CONFLICT.

DROP INDEX IF EXISTS "TakeoffLine_fileVersionId_sourceBimKey_key";

CREATE UNIQUE INDEX "TakeoffLine_fileVersionId_sourceBimKey_key"
  ON "TakeoffLine"("fileVersionId", "sourceBimKey");
