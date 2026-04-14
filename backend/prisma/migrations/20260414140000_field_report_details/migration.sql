-- Field report workflow + structured JSON body
ALTER TABLE "FieldReport" ADD COLUMN "reportKind" TEXT NOT NULL DEFAULT 'DAILY';
ALTER TABLE "FieldReport" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "FieldReport" ADD COLUMN "totalWorkers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FieldReport" ADD COLUMN "details" JSONB;

-- Treat legacy logs as submitted + daily so they stay read-only in the new UI
UPDATE "FieldReport" SET "status" = 'SUBMITTED', "reportKind" = 'DAILY';
