-- CreateTable
CREATE TABLE "ScheduleTaskLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'e2s',
    "lagDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScheduleTaskLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleTaskLink_projectId_idx" ON "ScheduleTaskLink"("projectId");

-- CreateIndex
CREATE INDEX "ScheduleTaskLink_sourceId_idx" ON "ScheduleTaskLink"("sourceId");

-- CreateIndex
CREATE INDEX "ScheduleTaskLink_targetId_idx" ON "ScheduleTaskLink"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleTaskLink_sourceId_targetId_key" ON "ScheduleTaskLink"("sourceId", "targetId");

-- AddForeignKey
ALTER TABLE "ScheduleTaskLink" ADD CONSTRAINT "ScheduleTaskLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTaskLink" ADD CONSTRAINT "ScheduleTaskLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ScheduleTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTaskLink" ADD CONSTRAINT "ScheduleTaskLink_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ScheduleTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
