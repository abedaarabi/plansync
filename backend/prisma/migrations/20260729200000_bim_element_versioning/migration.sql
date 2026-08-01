-- CreateEnum
CREATE TYPE "BimElementChangeType" AS ENUM ('ADDED', 'UNCHANGED', 'MODIFIED', 'DELETED');

-- AlterTable
ALTER TABLE "FileVersion" ADD COLUMN "geometryManifestS3Key" TEXT;

-- CreateTable
CREATE TABLE "BimElement" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "ifcGuid" TEXT NOT NULL,
    "ifcType" TEXT,
    "name" TEXT,

    CONSTRAINT "BimElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BimElementVersion" (
    "elementId" TEXT NOT NULL,
    "fileVersionId" TEXT NOT NULL,
    "metadataS3Key" TEXT NOT NULL,
    "metadataHash" TEXT NOT NULL,
    "changeType" "BimElementChangeType" NOT NULL DEFAULT 'UNCHANGED',

    CONSTRAINT "BimElementVersion_pkey" PRIMARY KEY ("elementId","fileVersionId")
);

-- CreateTable
CREATE TABLE "BimElementAttribute" (
    "elementId" TEXT NOT NULL,
    "fileVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "BimElementAttribute_pkey" PRIMARY KEY ("elementId","fileVersionId","key")
);

-- CreateTable
CREATE TABLE "BimGeometryTile" (
    "contentHash" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "byteLength" BIGINT NOT NULL,
    "bounds" JSONB NOT NULL,
    "refCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BimGeometryTile_pkey" PRIMARY KEY ("contentHash")
);

-- CreateTable
CREATE TABLE "BimVersionTile" (
    "fileVersionId" TEXT NOT NULL,
    "tileId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,

    CONSTRAINT "BimVersionTile_pkey" PRIMARY KEY ("fileVersionId","tileId")
);

-- CreateIndex
CREATE INDEX "BimElement_fileId_idx" ON "BimElement"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "BimElement_fileId_ifcGuid_key" ON "BimElement"("fileId", "ifcGuid");

-- CreateIndex
CREATE INDEX "BimElementVersion_fileVersionId_changeType_idx" ON "BimElementVersion"("fileVersionId", "changeType");

-- CreateIndex
CREATE INDEX "BimElementAttribute_key_value_idx" ON "BimElementAttribute"("key", "value");

-- CreateIndex
CREATE INDEX "BimVersionTile_fileVersionId_idx" ON "BimVersionTile"("fileVersionId");

-- AddForeignKey
ALTER TABLE "BimElement" ADD CONSTRAINT "BimElement_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimElementVersion" ADD CONSTRAINT "BimElementVersion_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "BimElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimElementVersion" ADD CONSTRAINT "BimElementVersion_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "FileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimElementAttribute" ADD CONSTRAINT "BimElementAttribute_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "BimElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimElementAttribute" ADD CONSTRAINT "BimElementAttribute_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "FileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimVersionTile" ADD CONSTRAINT "BimVersionTile_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "FileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BimVersionTile" ADD CONSTRAINT "BimVersionTile_contentHash_fkey" FOREIGN KEY ("contentHash") REFERENCES "BimGeometryTile"("contentHash") ON DELETE RESTRICT ON UPDATE CASCADE;
