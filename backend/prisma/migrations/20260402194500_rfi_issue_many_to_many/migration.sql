-- CreateTable
CREATE TABLE "RfiIssueLink" (
    "id" TEXT NOT NULL,
    "rfiId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfiIssueLink_pkey" PRIMARY KEY ("id")
);

-- Migrate existing Rfi.issueId into junction rows
INSERT INTO "RfiIssueLink" ("id", "rfiId", "issueId", "createdAt")
SELECT
  md5("Rfi"."id" || "Rfi"."issueId"),
  "Rfi"."id",
  "Rfi"."issueId",
  CURRENT_TIMESTAMP
FROM "Rfi"
WHERE "Rfi"."issueId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RfiIssueLink_rfiId_issueId_key" ON "RfiIssueLink"("rfiId", "issueId");

-- CreateIndex
CREATE INDEX "RfiIssueLink_issueId_idx" ON "RfiIssueLink"("issueId");

-- CreateIndex
CREATE INDEX "RfiIssueLink_rfiId_idx" ON "RfiIssueLink"("rfiId");

-- AddForeignKey
ALTER TABLE "RfiIssueLink" ADD CONSTRAINT "RfiIssueLink_rfiId_fkey" FOREIGN KEY ("rfiId") REFERENCES "Rfi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfiIssueLink" ADD CONSTRAINT "RfiIssueLink_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "Rfi" DROP CONSTRAINT "Rfi_issueId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Rfi_issueId_idx";

-- AlterTable
ALTER TABLE "Rfi" DROP COLUMN IF EXISTS "issueId";
