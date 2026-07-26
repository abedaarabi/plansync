-- AlterTable
ALTER TABLE "FileVersion" ADD COLUMN     "bimPublishedAt" TIMESTAMP(3),
ADD COLUMN     "bimPublishedById" TEXT;

-- CreateTable
CREATE TABLE "BimModelLevel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ifcFileVersionId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "elevationMeters" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL,
    "elementCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BimModelLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingLevelMap" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ifcFileVersionId" TEXT NOT NULL,
    "bimModelLevelId" TEXT NOT NULL,
    "pdfFileId" TEXT NOT NULL,
    "pdfFileVersionId" TEXT,
    "pageIndex" INTEGER NOT NULL,
    "coordTransformJson" JSONB,
    "coordAlignedAt" TIMESTAMP(3),
    "coordAlignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawingLevelMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BimModelLevel_projectId_idx" ON "BimModelLevel"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BimModelLevel_ifcFileVersionId_sourceName_key" ON "BimModelLevel"("ifcFileVersionId", "sourceName");

-- CreateIndex
CREATE INDEX "DrawingLevelMap_projectId_idx" ON "DrawingLevelMap"("projectId");

-- CreateIndex
CREATE INDEX "DrawingLevelMap_pdfFileId_idx" ON "DrawingLevelMap"("pdfFileId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingLevelMap_ifcFileVersionId_pdfFileId_pageIndex_key" ON "DrawingLevelMap"("ifcFileVersionId", "pdfFileId", "pageIndex");

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_bimPublishedById_fkey" FOREIGN KEY ("bimPublishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimModelLevel" ADD CONSTRAINT "BimModelLevel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimModelLevel" ADD CONSTRAINT "BimModelLevel_ifcFileVersionId_fkey" FOREIGN KEY ("ifcFileVersionId") REFERENCES "FileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingLevelMap" ADD CONSTRAINT "DrawingLevelMap_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingLevelMap" ADD CONSTRAINT "DrawingLevelMap_ifcFileVersionId_fkey" FOREIGN KEY ("ifcFileVersionId") REFERENCES "FileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingLevelMap" ADD CONSTRAINT "DrawingLevelMap_bimModelLevelId_fkey" FOREIGN KEY ("bimModelLevelId") REFERENCES "BimModelLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingLevelMap" ADD CONSTRAINT "DrawingLevelMap_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingLevelMap" ADD CONSTRAINT "DrawingLevelMap_pdfFileVersionId_fkey" FOREIGN KEY ("pdfFileVersionId") REFERENCES "FileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingLevelMap" ADD CONSTRAINT "DrawingLevelMap_coordAlignedById_fkey" FOREIGN KEY ("coordAlignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

