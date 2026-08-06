-- CreateTable
CREATE TABLE "OmWorkOrderAgingDigest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "digestDate" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmWorkOrderAgingDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OmWorkOrderAgingDigest_workspaceId_digestDate_key" ON "OmWorkOrderAgingDigest"("workspaceId", "digestDate");

-- CreateIndex
CREATE INDEX "OmWorkOrderAgingDigest_digestDate_idx" ON "OmWorkOrderAgingDigest"("digestDate");

-- AddForeignKey
ALTER TABLE "OmWorkOrderAgingDigest" ADD CONSTRAINT "OmWorkOrderAgingDigest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
