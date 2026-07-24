-- BIM viewer platform: server artifacts, takeoff extensions, saved views

ALTER TABLE "FileVersion" ADD COLUMN IF NOT EXISTS "fragmentsS3Key" TEXT;
ALTER TABLE "FileVersion" ADD COLUMN IF NOT EXISTS "quantityIndexS3Key" TEXT;
ALTER TABLE "FileVersion" ADD COLUMN IF NOT EXISTS "bimConversionStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "FileVersion" ADD COLUMN IF NOT EXISTS "bimLoqReport" JSONB;
ALTER TABLE "FileVersion" ADD COLUMN IF NOT EXISTS "bimConversionJobRunId" TEXT;

ALTER TABLE "TakeoffLine" ADD COLUMN IF NOT EXISTS "sourceBimKey" TEXT;
ALTER TABLE "TakeoffLine" ADD COLUMN IF NOT EXISTS "sourceIfcGuid" TEXT;
ALTER TABLE "TakeoffLine" ADD COLUMN IF NOT EXISTS "sourceIfcGuids" JSONB;
ALTER TABLE "TakeoffLine" ADD COLUMN IF NOT EXISTS "ifcType" TEXT;
ALTER TABLE "TakeoffLine" ADD COLUMN IF NOT EXISTS "quantitySource" TEXT;
ALTER TABLE "TakeoffLine" ADD COLUMN IF NOT EXISTS "bimMetadata" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "TakeoffLine_fileVersionId_sourceBimKey_key"
  ON "TakeoffLine"("fileVersionId", "sourceBimKey");

CREATE TABLE IF NOT EXISTS "BimSavedView" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "fileVersionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cameraJson" JSONB NOT NULL,
  "filtersJson" JSONB,
  "hiddenGuids" JSONB,
  "isolatedGuids" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BimSavedView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BimSavedView_fileVersionId_idx" ON "BimSavedView"("fileVersionId");
CREATE INDEX IF NOT EXISTS "BimSavedView_projectId_userId_idx" ON "BimSavedView"("projectId", "userId");

ALTER TABLE "BimSavedView" ADD CONSTRAINT "BimSavedView_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BimSavedView" ADD CONSTRAINT "BimSavedView_fileVersionId_fkey"
  FOREIGN KEY ("fileVersionId") REFERENCES "FileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BimSavedView" ADD CONSTRAINT "BimSavedView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
