-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "buildingId" TEXT;

-- CreateIndex
CREATE INDEX "Issue_buildingId_idx" ON "Issue"("buildingId");

-- CreateIndex
CREATE INDEX "Issue_projectId_buildingId_idx" ON "Issue"("projectId", "buildingId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill building from level when present
UPDATE "Issue" AS i
SET "buildingId" = l."buildingId"
FROM "BimModelLevel" AS l
WHERE i."levelId" = l."id"
  AND i."buildingId" IS NULL
  AND l."buildingId" IS NOT NULL;
