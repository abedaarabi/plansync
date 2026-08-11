-- AlterTable
ALTER TABLE "DrawingLevelMap" ALTER COLUMN "ifcFileVersionId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DrawingLevelMap_bimModelLevelId_pdfFileId_pageIndex_key" ON "DrawingLevelMap"("bimModelLevelId", "pdfFileId", "pageIndex");

-- CreateIndex
CREATE INDEX "DrawingLevelMap_bimModelLevelId_idx" ON "DrawingLevelMap"("bimModelLevelId");

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "levelId" TEXT;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "levelId" TEXT;

-- CreateIndex
CREATE INDEX "Issue_levelId_idx" ON "Issue"("levelId");

-- CreateIndex
CREATE INDEX "Issue_projectId_levelId_idx" ON "Issue"("projectId", "levelId");

-- CreateIndex
CREATE INDEX "Asset_levelId_idx" ON "Asset"("levelId");

-- CreateIndex
CREATE INDEX "Asset_projectId_levelId_idx" ON "Asset"("projectId", "levelId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "BimModelLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "BimModelLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
