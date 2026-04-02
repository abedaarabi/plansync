-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'FILE_MOVED';
ALTER TYPE "ActivityType" ADD VALUE 'FOLDER_MOVED';

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "ActivityLog_projectId_createdAt_idx" ON "ActivityLog"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
