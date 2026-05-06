-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "occupantScanSecret" TEXT;

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "occupantPhotoToken" TEXT,
ADD COLUMN     "occupantPhotoTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_occupantScanSecret_key" ON "Asset"("occupantScanSecret");
