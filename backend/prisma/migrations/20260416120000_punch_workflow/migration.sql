-- CreateTable
CREATE TABLE "PunchTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "itemsJson" JSONB NOT NULL DEFAULT '[]',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PunchTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PunchTemplate_workspaceId_idx" ON "PunchTemplate"("workspaceId");

CREATE INDEX "PunchTemplate_projectId_idx" ON "PunchTemplate"("projectId");

ALTER TABLE "PunchTemplate" ADD CONSTRAINT "PunchTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PunchTemplate" ADD CONSTRAINT "PunchTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PunchTemplate" ADD CONSTRAINT "PunchTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "PunchItem" ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Punch item';

ALTER TABLE "PunchItem" ADD COLUMN "dueDate" TIMESTAMP(3);

ALTER TABLE "PunchItem" ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "PunchItem" ADD COLUMN "templateId" TEXT;

CREATE INDEX "PunchItem_status_idx" ON "PunchItem"("status");

CREATE INDEX "PunchItem_templateId_idx" ON "PunchItem"("templateId");

CREATE INDEX "PunchItem_dueDate_idx" ON "PunchItem"("dueDate");

ALTER TABLE "PunchItem" ADD CONSTRAINT "PunchItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PunchTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PunchItemHistory" (
    "id" TEXT NOT NULL,
    "punchItemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PunchItemHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PunchItemHistory_punchItemId_createdAt_idx" ON "PunchItemHistory"("punchItemId", "createdAt");

ALTER TABLE "PunchItemHistory" ADD CONSTRAINT "PunchItemHistory_punchItemId_fkey" FOREIGN KEY ("punchItemId") REFERENCES "PunchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PunchItemHistory" ADD CONSTRAINT "PunchItemHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
