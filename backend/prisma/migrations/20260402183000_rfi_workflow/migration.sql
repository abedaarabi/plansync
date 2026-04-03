-- CreateEnum
CREATE TYPE "RfiPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'RFI_SENT_FOR_REVIEW';
ALTER TYPE "ActivityType" ADD VALUE 'RFI_RESPONSE_SUBMITTED';
ALTER TYPE "ActivityType" ADD VALUE 'RFI_CLOSED';
ALTER TYPE "ActivityType" ADD VALUE 'RFI_ATTACHMENT_ADDED';

-- AlterTable
ALTER TABLE "Rfi" ADD COLUMN "rfiNumber" INTEGER;
ALTER TABLE "Rfi" ADD COLUMN "officialResponse" TEXT;
ALTER TABLE "Rfi" ADD COLUMN "assignedToUserId" TEXT;
ALTER TABLE "Rfi" ADD COLUMN "creatorId" TEXT;
ALTER TABLE "Rfi" ADD COLUMN "priority" "RfiPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Rfi" ADD COLUMN "issueId" TEXT;
ALTER TABLE "Rfi" ADD COLUMN "fileId" TEXT;
ALTER TABLE "Rfi" ADD COLUMN "fileVersionId" TEXT;
ALTER TABLE "Rfi" ADD COLUMN "pageNumber" INTEGER;
ALTER TABLE "Rfi" ADD COLUMN "pinNormX" DOUBLE PRECISION;
ALTER TABLE "Rfi" ADD COLUMN "pinNormY" DOUBLE PRECISION;
ALTER TABLE "Rfi" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "Rfi" ADD COLUMN "lastOverdueNotifiedAt" TIMESTAMP(3);

UPDATE "Rfi" AS r
SET "rfiNumber" = sub.n
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt") AS n
  FROM "Rfi"
) AS sub
WHERE r.id = sub.id;

ALTER TABLE "Rfi" ALTER COLUMN "rfiNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Rfi_projectId_rfiNumber_key" ON "Rfi"("projectId", "rfiNumber");

ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "FileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Rfi_assignedToUserId_idx" ON "Rfi"("assignedToUserId");
CREATE INDEX "Rfi_creatorId_idx" ON "Rfi"("creatorId");
CREATE INDEX "Rfi_issueId_idx" ON "Rfi"("issueId");

-- CreateTable
CREATE TABLE "RfiAttachment" (
    "id" TEXT NOT NULL,
    "rfiId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "sizeBytes" BIGINT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfiAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RfiAttachment_rfiId_idx" ON "RfiAttachment"("rfiId");

ALTER TABLE "RfiAttachment" ADD CONSTRAINT "RfiAttachment_rfiId_fkey" FOREIGN KEY ("rfiId") REFERENCES "Rfi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RfiAttachment" ADD CONSTRAINT "RfiAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
