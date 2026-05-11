-- CreateTable
CREATE TABLE "ProjectApiKey" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Integration key',
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectApiKey_keyHash_key" ON "ProjectApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ProjectApiKey_projectId_revokedAt_idx" ON "ProjectApiKey"("projectId", "revokedAt");

-- CreateIndex
CREATE INDEX "ProjectApiKey_createdById_idx" ON "ProjectApiKey"("createdById");

-- AddForeignKey
ALTER TABLE "ProjectApiKey" ADD CONSTRAINT "ProjectApiKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectApiKey" ADD CONSTRAINT "ProjectApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
