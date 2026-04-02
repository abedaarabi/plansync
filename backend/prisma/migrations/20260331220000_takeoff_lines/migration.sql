-- CreateTable
CREATE TABLE "TakeoffLine" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileVersionId" TEXT NOT NULL,
    "materialId" TEXT,
    "label" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ea',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TakeoffLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TakeoffLine_workspaceId_idx" ON "TakeoffLine"("workspaceId");

-- CreateIndex
CREATE INDEX "TakeoffLine_projectId_idx" ON "TakeoffLine"("projectId");

-- CreateIndex
CREATE INDEX "TakeoffLine_fileId_idx" ON "TakeoffLine"("fileId");

-- CreateIndex
CREATE INDEX "TakeoffLine_fileVersionId_idx" ON "TakeoffLine"("fileVersionId");

-- AddForeignKey
ALTER TABLE "TakeoffLine" ADD CONSTRAINT "TakeoffLine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffLine" ADD CONSTRAINT "TakeoffLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffLine" ADD CONSTRAINT "TakeoffLine_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffLine" ADD CONSTRAINT "TakeoffLine_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "FileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffLine" ADD CONSTRAINT "TakeoffLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
