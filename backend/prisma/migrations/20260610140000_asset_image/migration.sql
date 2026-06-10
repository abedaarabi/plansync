-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "imageS3Key" TEXT,
ADD COLUMN "imageMimeType" TEXT,
ADD COLUMN "imageFileName" TEXT,
ADD COLUMN "imageSizeBytes" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "Asset_imageS3Key_key" ON "Asset"("imageS3Key");
