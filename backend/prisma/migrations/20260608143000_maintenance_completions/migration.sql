-- AlterTable
ALTER TABLE "Issue"
  ADD COLUMN "maintenanceScheduleId" TEXT,
  ADD COLUMN "maintenanceDueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MaintenanceCompletion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedByUserId" TEXT,
    "previousDueAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "workOrderId" TEXT,
    "notes" TEXT,
    "vendorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Issue_maintenanceScheduleId_idx" ON "Issue"("maintenanceScheduleId");
CREATE UNIQUE INDEX "Issue_maintenanceScheduleId_maintenanceDueAt_key" ON "Issue"("maintenanceScheduleId", "maintenanceDueAt");
CREATE INDEX "MaintenanceCompletion_workspaceId_completedAt_idx" ON "MaintenanceCompletion"("workspaceId", "completedAt");
CREATE INDEX "MaintenanceCompletion_projectId_completedAt_idx" ON "MaintenanceCompletion"("projectId", "completedAt");
CREATE INDEX "MaintenanceCompletion_assetId_completedAt_idx" ON "MaintenanceCompletion"("assetId", "completedAt");
CREATE INDEX "MaintenanceCompletion_scheduleId_completedAt_idx" ON "MaintenanceCompletion"("scheduleId", "completedAt");
CREATE INDEX "MaintenanceCompletion_completedByUserId_idx" ON "MaintenanceCompletion"("completedByUserId");
CREATE UNIQUE INDEX "MaintenanceCompletion_workOrderId_key" ON "MaintenanceCompletion"("workOrderId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_maintenanceScheduleId_fkey" FOREIGN KEY ("maintenanceScheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceCompletion" ADD CONSTRAINT "MaintenanceCompletion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceCompletion" ADD CONSTRAINT "MaintenanceCompletion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceCompletion" ADD CONSTRAINT "MaintenanceCompletion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceCompletion" ADD CONSTRAINT "MaintenanceCompletion_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceCompletion" ADD CONSTRAINT "MaintenanceCompletion_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceCompletion" ADD CONSTRAINT "MaintenanceCompletion_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
