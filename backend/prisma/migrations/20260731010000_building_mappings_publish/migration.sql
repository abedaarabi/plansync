-- AlterTable
ALTER TABLE "Building" ADD COLUMN "mappingsPublishedAt" TIMESTAMP(3);
ALTER TABLE "Building" ADD COLUMN "mappingsDirty" BOOLEAN NOT NULL DEFAULT true;
