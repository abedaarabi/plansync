-- CreateTable
CREATE TABLE "OccupantSubmitRateLimit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "portalTokenHash" TEXT NOT NULL,
    "clientIpHash" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OccupantSubmitRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OccupantSubmitRateLimit_workspaceId_portalTokenHash_clientIpHash_windowStart_key" ON "OccupantSubmitRateLimit"("workspaceId", "portalTokenHash", "clientIpHash", "windowStart");

-- CreateIndex
CREATE INDEX "OccupantSubmitRateLimit_workspaceId_windowStart_idx" ON "OccupantSubmitRateLimit"("workspaceId", "windowStart");

-- AddForeignKey
ALTER TABLE "OccupantSubmitRateLimit" ADD CONSTRAINT "OccupantSubmitRateLimit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
