-- Add status to schedule tasks with strict allowed values.
ALTER TABLE "ScheduleTask"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'not_started';

ALTER TABLE "ScheduleTask"
ADD CONSTRAINT "ScheduleTask_status_check"
CHECK ("status" IN ('not_started', 'in_progress', 'delayed', 'completed'));
