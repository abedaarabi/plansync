-- Backfill: portal / occupant submissions previously stored as WORK_ORDER with reporter set
UPDATE "Issue"
SET "issueKind" = 'OCCUPANT'
WHERE "issueKind" = 'WORK_ORDER'
  AND ("reporterEmail" IS NOT NULL OR "reporterName" IS NOT NULL);
