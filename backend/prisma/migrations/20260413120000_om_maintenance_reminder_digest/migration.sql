-- CreateTable
CREATE TABLE "OmMaintenanceReminderDigest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "digestDate" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmMaintenanceReminderDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OmMaintenanceReminderDigest_workspaceId_digestDate_key" ON "OmMaintenanceReminderDigest"("workspaceId", "digestDate");

-- CreateIndex
CREATE INDEX "OmMaintenanceReminderDigest_digestDate_idx" ON "OmMaintenanceReminderDigest"("digestDate");

-- AddForeignKey
ALTER TABLE "OmMaintenanceReminderDigest" ADD CONSTRAINT "OmMaintenanceReminderDigest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
