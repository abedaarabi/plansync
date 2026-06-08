-- AlterTable
ALTER TABLE "MaintenanceSchedule" ADD COLUMN "assignedToUserId" TEXT;

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_assignedToUserId_idx" ON "MaintenanceSchedule"("assignedToUserId");

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
