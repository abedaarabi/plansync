-- CreateTable
CREATE TABLE "ScheduleTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleTask_projectId_idx" ON "ScheduleTask"("projectId");

-- CreateIndex
CREATE INDEX "ScheduleTask_parentId_idx" ON "ScheduleTask"("parentId");

-- AddForeignKey
ALTER TABLE "ScheduleTask" ADD CONSTRAINT "ScheduleTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTask" ADD CONSTRAINT "ScheduleTask_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ScheduleTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
