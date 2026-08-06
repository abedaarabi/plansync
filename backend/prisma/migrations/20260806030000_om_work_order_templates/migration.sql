-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "statusChangedAt" TIMESTAMP(3),
ADD COLUMN "sourceInspectionRunId" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceWorkOrderTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workOrderType" TEXT NOT NULL DEFAULT 'CORRECTIVE',
    "priority" "IssuePriority",
    "procedureJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceWorkOrderTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceWorkOrderTemplate_workspaceId_idx" ON "WorkspaceWorkOrderTemplate"("workspaceId");

-- CreateIndex
CREATE INDEX "Issue_sourceInspectionRunId_idx" ON "Issue"("sourceInspectionRunId");

-- AddForeignKey
ALTER TABLE "WorkspaceWorkOrderTemplate" ADD CONSTRAINT "WorkspaceWorkOrderTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_sourceInspectionRunId_fkey" FOREIGN KEY ("sourceInspectionRunId") REFERENCES "InspectionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
