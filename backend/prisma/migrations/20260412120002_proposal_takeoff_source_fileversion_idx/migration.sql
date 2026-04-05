-- CreateIndex (IF NOT EXISTS: index may already exist on DBs that drifted from schema)
CREATE INDEX IF NOT EXISTS "ProposalTakeoffSource_fileVersionId_idx" ON "ProposalTakeoffSource"("fileVersionId");
