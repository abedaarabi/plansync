-- CreateEnum
CREATE TYPE "BimClashType" AS ENUM ('HARD', 'CLEARANCE', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "BimClashStatus" AS ENUM ('NEW', 'ACTIVE', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "BimClashTest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "setAJson" JSONB NOT NULL,
    "setBJson" JSONB NOT NULL,
    "clearanceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "clearanceMm" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "lastRunAt" TIMESTAMP(3),
    "lastRunById" TEXT,
    "lastRunStats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BimClashTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BimClash" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileVersionAId" TEXT NOT NULL,
    "fileVersionBId" TEXT NOT NULL,
    "elementAId" TEXT NOT NULL,
    "elementBId" TEXT NOT NULL,
    "guidA" TEXT NOT NULL,
    "guidB" TEXT NOT NULL,
    "clashType" "BimClashType" NOT NULL,
    "distanceMm" DOUBLE PRECISION NOT NULL,
    "pointJson" JSONB NOT NULL,
    "contactCount" INTEGER NOT NULL DEFAULT 1,
    "status" "BimClashStatus" NOT NULL DEFAULT 'NEW',
    "statusChangedAt" TIMESTAMP(3),
    "statusDistanceMm" DOUBLE PRECISION,
    "assigneeId" TEXT,
    "groupId" TEXT,
    "elementMissingSinceId" TEXT,
    "issueId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BimClash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BimClashComment" (
    "id" TEXT NOT NULL,
    "clashId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BimClashComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BimClashTest_projectId_idx" ON "BimClashTest"("projectId");

-- CreateIndex
CREATE INDEX "BimClash_projectId_status_idx" ON "BimClash"("projectId", "status");

-- CreateIndex
CREATE INDEX "BimClash_testId_idx" ON "BimClash"("testId");

-- CreateIndex
CREATE INDEX "BimClash_groupId_idx" ON "BimClash"("groupId");

-- CreateIndex
CREATE INDEX "BimClash_assigneeId_idx" ON "BimClash"("assigneeId");

-- CreateIndex
CREATE INDEX "BimClash_issueId_idx" ON "BimClash"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "BimClash_testId_elementAId_elementBId_key" ON "BimClash"("testId", "elementAId", "elementBId");

-- CreateIndex
CREATE INDEX "BimClashComment_clashId_idx" ON "BimClashComment"("clashId");

-- AddForeignKey
ALTER TABLE "BimClashTest" ADD CONSTRAINT "BimClashTest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClashTest" ADD CONSTRAINT "BimClashTest_lastRunById_fkey" FOREIGN KEY ("lastRunById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClash" ADD CONSTRAINT "BimClash_testId_fkey" FOREIGN KEY ("testId") REFERENCES "BimClashTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClash" ADD CONSTRAINT "BimClash_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClash" ADD CONSTRAINT "BimClash_fileVersionAId_fkey" FOREIGN KEY ("fileVersionAId") REFERENCES "FileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClash" ADD CONSTRAINT "BimClash_fileVersionBId_fkey" FOREIGN KEY ("fileVersionBId") REFERENCES "FileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClash" ADD CONSTRAINT "BimClash_elementAId_fkey" FOREIGN KEY ("elementAId") REFERENCES "BimElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClash" ADD CONSTRAINT "BimClash_elementBId_fkey" FOREIGN KEY ("elementBId") REFERENCES "BimElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClash" ADD CONSTRAINT "BimClash_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClash" ADD CONSTRAINT "BimClash_elementMissingSinceId_fkey" FOREIGN KEY ("elementMissingSinceId") REFERENCES "FileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClash" ADD CONSTRAINT "BimClash_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClashComment" ADD CONSTRAINT "BimClashComment_clashId_fkey" FOREIGN KEY ("clashId") REFERENCES "BimClash"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimClashComment" ADD CONSTRAINT "BimClashComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
