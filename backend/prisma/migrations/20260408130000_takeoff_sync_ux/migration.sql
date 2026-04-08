-- Takeoff UX + sync redesign foundations

ALTER TABLE "TakeoffLine"
  ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'zone',
  ADD COLUMN "sourceFileVersionAtCreate" INTEGER;

CREATE TABLE "TakeoffViewPreset" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "configJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TakeoffViewPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TakeoffSyncRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "addedCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "removedCount" INTEGER NOT NULL DEFAULT 0,
  "sourceFileVersionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "summaryJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TakeoffSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TakeoffSnapshot" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TakeoffSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TakeoffViewPreset_projectId_userId_name_key"
  ON "TakeoffViewPreset"("projectId", "userId", "name");
CREATE INDEX "TakeoffViewPreset_workspaceId_idx" ON "TakeoffViewPreset"("workspaceId");
CREATE INDEX "TakeoffViewPreset_projectId_userId_idx"
  ON "TakeoffViewPreset"("projectId", "userId");
CREATE INDEX "TakeoffSyncRun_workspaceId_idx" ON "TakeoffSyncRun"("workspaceId");
CREATE INDEX "TakeoffSyncRun_projectId_createdAt_idx"
  ON "TakeoffSyncRun"("projectId", "createdAt");
CREATE INDEX "TakeoffSnapshot_workspaceId_idx" ON "TakeoffSnapshot"("workspaceId");
CREATE INDEX "TakeoffSnapshot_projectId_createdAt_idx"
  ON "TakeoffSnapshot"("projectId", "createdAt");

ALTER TABLE "TakeoffViewPreset"
  ADD CONSTRAINT "TakeoffViewPreset_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakeoffViewPreset"
  ADD CONSTRAINT "TakeoffViewPreset_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakeoffViewPreset"
  ADD CONSTRAINT "TakeoffViewPreset_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TakeoffSyncRun"
  ADD CONSTRAINT "TakeoffSyncRun_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakeoffSyncRun"
  ADD CONSTRAINT "TakeoffSyncRun_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakeoffSyncRun"
  ADD CONSTRAINT "TakeoffSyncRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TakeoffSnapshot"
  ADD CONSTRAINT "TakeoffSnapshot_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakeoffSnapshot"
  ADD CONSTRAINT "TakeoffSnapshot_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakeoffSnapshot"
  ADD CONSTRAINT "TakeoffSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
