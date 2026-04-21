-- AlterTable
ALTER TABLE "PunchItem"
ADD COLUMN "fileId" TEXT,
ADD COLUMN "fileVersionId" TEXT,
ADD COLUMN "pageNumber" INTEGER;

-- CreateTable
CREATE TABLE "PunchAssigneeLink" (
    "id" TEXT NOT NULL,
    "punchItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PunchAssigneeLink_pkey" PRIMARY KEY ("id")
);

-- Backfill legacy single assignee into multi-assignee links
INSERT INTO "PunchAssigneeLink" ("id", "punchItemId", "userId", "createdAt")
SELECT
  ('pal_' || md5(random()::text || clock_timestamp()::text)),
  p."id",
  p."assigneeId",
  CURRENT_TIMESTAMP
FROM "PunchItem" p
WHERE p."assigneeId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "PunchItem_fileId_idx" ON "PunchItem"("fileId");
CREATE INDEX "PunchItem_fileVersionId_idx" ON "PunchItem"("fileVersionId");
CREATE INDEX "PunchAssigneeLink_userId_idx" ON "PunchAssigneeLink"("userId");
CREATE INDEX "PunchAssigneeLink_punchItemId_idx" ON "PunchAssigneeLink"("punchItemId");
CREATE UNIQUE INDEX "PunchAssigneeLink_punchItemId_userId_key" ON "PunchAssigneeLink"("punchItemId", "userId");

-- AddForeignKey
ALTER TABLE "PunchItem" ADD CONSTRAINT "PunchItem_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PunchItem" ADD CONSTRAINT "PunchItem_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "FileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PunchAssigneeLink" ADD CONSTRAINT "PunchAssigneeLink_punchItemId_fkey" FOREIGN KEY ("punchItemId") REFERENCES "PunchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PunchAssigneeLink" ADD CONSTRAINT "PunchAssigneeLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
