-- CreateTable
CREATE TABLE "WorkspaceInspectionTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT,
    "checklistJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InspectionTemplate" ADD COLUMN "intervalDays" INTEGER,
ADD COLUMN "nextDueAt" TIMESTAMP(3),
ADD COLUMN "lastCompletedAt" TIMESTAMP(3),
ADD COLUMN "requireFailEvidence" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "InspectionRun" ADD COLUMN "assetId" TEXT,
ADD COLUMN "dueAt" TIMESTAMP(3),
ADD COLUMN "signatureDataUrl" TEXT;

-- CreateTable
CREATE TABLE "OmInspectionReminderDigest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "digestDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmInspectionReminderDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceInspectionTemplate_workspaceId_idx" ON "WorkspaceInspectionTemplate"("workspaceId");

-- CreateIndex
CREATE INDEX "InspectionTemplate_nextDueAt_idx" ON "InspectionTemplate"("nextDueAt");

-- CreateIndex
CREATE INDEX "InspectionRun_assetId_idx" ON "InspectionRun"("assetId");

-- CreateIndex
CREATE INDEX "InspectionRun_dueAt_idx" ON "InspectionRun"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "OmInspectionReminderDigest_workspaceId_digestDate_key" ON "OmInspectionReminderDigest"("workspaceId", "digestDate");

-- CreateIndex
CREATE INDEX "OmInspectionReminderDigest_workspaceId_idx" ON "OmInspectionReminderDigest"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceInspectionTemplate" ADD CONSTRAINT "WorkspaceInspectionTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRun" ADD CONSTRAINT "InspectionRun_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
