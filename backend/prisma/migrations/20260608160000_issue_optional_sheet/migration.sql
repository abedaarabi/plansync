-- Allow issues without a linked drawing (sheet-less coordination / work orders).

ALTER TABLE "Issue" DROP CONSTRAINT "Issue_fileId_fkey";
ALTER TABLE "Issue" DROP CONSTRAINT "Issue_fileVersionId_fkey";

ALTER TABLE "Issue" ALTER COLUMN "fileId" DROP NOT NULL;
ALTER TABLE "Issue" ALTER COLUMN "fileVersionId" DROP NOT NULL;

ALTER TABLE "Issue" ADD CONSTRAINT "Issue_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "FileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
