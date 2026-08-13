-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "imageS3Key" TEXT,
ADD COLUMN     "imageMimeType" TEXT,
ADD COLUMN     "imageFileName" TEXT,
ADD COLUMN     "imageSizeBytes" BIGINT;
