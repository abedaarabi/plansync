-- Per-project sequential punch # + optional reference photos (S3 metadata JSON array).

ALTER TABLE "PunchItem" ADD COLUMN "punchNumber" INTEGER;
ALTER TABLE "PunchItem" ADD COLUMN "referencePhotos" JSONB;

UPDATE "PunchItem" p
SET "punchNumber" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC) AS rn
  FROM "PunchItem"
) sub
WHERE p.id = sub.id;

ALTER TABLE "PunchItem" ALTER COLUMN "punchNumber" SET NOT NULL;

CREATE UNIQUE INDEX "PunchItem_projectId_punchNumber_key" ON "PunchItem"("projectId", "punchNumber");
