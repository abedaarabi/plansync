-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'VIEWER_MARKUP_SAVED';

-- AlterTable
ALTER TABLE "FileVersion" ADD COLUMN "annotationBlobRevision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "hideViewerPresence" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "viewerCollaborationEnabled" BOOLEAN NOT NULL DEFAULT true;
