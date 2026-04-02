-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'RFI_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'RFI_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'PUNCH_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'PUNCH_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'FIELD_REPORT_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'FIELD_REPORT_UPDATED';

-- CreateEnum
CREATE TYPE "RfiStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PunchPriority" AS ENUM ('P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "PunchStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'READY_FOR_GC', 'CLOSED');

-- AlterTable Issue: add projectId (denormalized from File)
ALTER TABLE "Issue" ADD COLUMN "projectId" TEXT;

UPDATE "Issue" SET "projectId" = (SELECT f."projectId" FROM "File" f WHERE f."id" = "Issue"."fileId");

ALTER TABLE "Issue" ALTER COLUMN "projectId" SET NOT NULL;

ALTER TABLE "Issue" ADD CONSTRAINT "Issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Issue_projectId_idx" ON "Issue"("projectId");

-- CreateTable Rfi
CREATE TABLE "Rfi" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RfiStatus" NOT NULL DEFAULT 'OPEN',
    "fromDiscipline" TEXT,
    "dueDate" TIMESTAMP(3),
    "risk" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rfi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Rfi_projectId_idx" ON "Rfi"("projectId");

ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable PunchItem
CREATE TABLE "PunchItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "priority" "PunchPriority" NOT NULL DEFAULT 'P2',
    "status" "PunchStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PunchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PunchItem_projectId_idx" ON "PunchItem"("projectId");

ALTER TABLE "PunchItem" ADD CONSTRAINT "PunchItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable FieldReport
CREATE TABLE "FieldReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "weather" TEXT,
    "authorLabel" TEXT,
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FieldReport_projectId_idx" ON "FieldReport"("projectId");

ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
