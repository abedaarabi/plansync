-- CreateTable
CREATE TABLE "ScheduleTaskTakeoffLine" (
    "scheduleTaskId" TEXT NOT NULL,
    "takeoffLineId" TEXT NOT NULL,

    CONSTRAINT "ScheduleTaskTakeoffLine_pkey" PRIMARY KEY ("scheduleTaskId","takeoffLineId")
);

-- CreateIndex
CREATE INDEX "ScheduleTaskTakeoffLine_takeoffLineId_idx" ON "ScheduleTaskTakeoffLine"("takeoffLineId");

-- AddForeignKey
ALTER TABLE "ScheduleTaskTakeoffLine" ADD CONSTRAINT "ScheduleTaskTakeoffLine_scheduleTaskId_fkey" FOREIGN KEY ("scheduleTaskId") REFERENCES "ScheduleTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTaskTakeoffLine" ADD CONSTRAINT "ScheduleTaskTakeoffLine_takeoffLineId_fkey" FOREIGN KEY ("takeoffLineId") REFERENCES "TakeoffLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
