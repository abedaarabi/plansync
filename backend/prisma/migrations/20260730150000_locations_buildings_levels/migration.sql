-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('IFC', 'PDF', 'OTHER');

-- CreateEnum
CREATE TYPE "BuildingDiscipline" AS ENUM ('ARCHITECTURAL', 'STRUCTURAL', 'MEP', 'CIVIL', 'OTHER');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "buildingId" TEXT,
ADD COLUMN     "buildingAssetType" "AssetType",
ADD COLUMN     "buildingDiscipline" "BuildingDiscipline";

-- AlterTable
ALTER TABLE "FileVersion" ADD COLUMN     "thumbnailS3Key" TEXT,
ADD COLUMN     "assetProcessingStatus" "ProcessingStatus",
ADD COLUMN     "assetProcessingError" TEXT;

-- AlterTable
ALTER TABLE "BimModelLevel" ADD COLUMN     "buildingId" TEXT,
ADD COLUMN     "sourceIfcGuid" TEXT,
ADD COLUMN     "thumbnailS3Key" TEXT,
ALTER COLUMN "ifcFileVersionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DrawingLevelMap" ADD COLUMN     "offsetX" DOUBLE PRECISION,
ADD COLUMN     "offsetY" DOUBLE PRECISION,
ADD COLUMN     "scale" DOUBLE PRECISION,
ADD COLUMN     "rotationDeg" DOUBLE PRECISION,
ADD COLUMN     "calibrationJson" JSONB;

-- CreateIndex
CREATE INDEX "Location_projectId_idx" ON "Location"("projectId");

-- CreateIndex
CREATE INDEX "Building_locationId_idx" ON "Building"("locationId");

-- CreateIndex
CREATE INDEX "File_buildingId_idx" ON "File"("buildingId");

-- CreateIndex
CREATE INDEX "BimModelLevel_buildingId_idx" ON "BimModelLevel"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "BimModelLevel_buildingId_sourceName_key" ON "BimModelLevel"("buildingId", "sourceName");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimModelLevel" ADD CONSTRAINT "BimModelLevel_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
