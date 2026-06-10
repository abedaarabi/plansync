-- Work order CMMS extensions: vendors, parts, meters, execution fields

CREATE TYPE "WorkOrderType" AS ENUM ('CORRECTIVE', 'PREVENTIVE', 'INSPECTION_FOLLOWUP', 'TENANT', 'OCCUPANT');
CREATE TYPE "AssetMeterType" AS ENUM ('RUN_HOURS', 'CYCLES', 'PRESSURE', 'TEMPERATURE', 'CUSTOM');

ALTER TABLE "Issue" ADD COLUMN "workOrderType" "WorkOrderType";
ALTER TABLE "Issue" ADD COLUMN "procedureJson" JSONB;
ALTER TABLE "Issue" ADD COLUMN "procedureResultJson" JSONB;
ALTER TABLE "Issue" ADD COLUMN "laborMinutes" INTEGER;
ALTER TABLE "Issue" ADD COLUMN "partsUsedJson" JSONB;
ALTER TABLE "Issue" ADD COLUMN "completedById" TEXT;
ALTER TABLE "Issue" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "Issue" ADD COLUMN "sourceOccupantIssueId" TEXT;
ALTER TABLE "Issue" ADD COLUMN "vendorAccessToken" TEXT;
ALTER TABLE "Issue" ADD COLUMN "vendorAccessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Issue" ADD COLUMN "completionEvidenceRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Issue_vendorAccessToken_key" ON "Issue"("vendorAccessToken");
CREATE INDEX "Issue_vendorId_idx" ON "Issue"("vendorId");
CREATE INDEX "Issue_sourceOccupantIssueId_idx" ON "Issue"("sourceOccupantIssueId");
CREATE INDEX "Issue_completedById_idx" ON "Issue"("completedById");

ALTER TABLE "Issue" ADD CONSTRAINT "Issue_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_sourceOccupantIssueId_fkey" FOREIGN KEY ("sourceOccupantIssueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "trade" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Vendor_projectId_idx" ON "Vendor"("projectId");
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AssetMeterReading" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "meterType" "AssetMeterType" NOT NULL,
    "label" TEXT,
    "value" DECIMAL(19,4) NOT NULL,
    "unit" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,

    CONSTRAINT "AssetMeterReading_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssetMeterReading_assetId_meterType_recordedAt_idx" ON "AssetMeterReading"("assetId", "meterType", "recordedAt");
ALTER TABLE "AssetMeterReading" ADD CONSTRAINT "AssetMeterReading_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMeterReading" ADD CONSTRAINT "AssetMeterReading_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PartsInventoryItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(19,2),
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartsInventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartsInventoryItem_projectId_idx" ON "PartsInventoryItem"("projectId");
ALTER TABLE "PartsInventoryItem" ADD CONSTRAINT "PartsInventoryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenanceSchedule" ADD COLUMN "meterType" "AssetMeterType";
ALTER TABLE "MaintenanceSchedule" ADD COLUMN "meterThreshold" DECIMAL(19,4);
