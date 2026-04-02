-- AlterTable
ALTER TABLE "TakeoffLine" ADD COLUMN     "sourceZoneId" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "TakeoffLine_fileVersionId_sourceZoneId_key" ON "TakeoffLine"("fileVersionId", "sourceZoneId");
