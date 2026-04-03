-- CreateTable
CREATE TABLE "ProposalTakeoffSource" (
    "proposalId" TEXT NOT NULL,
    "fileVersionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProposalTakeoffSource_pkey" PRIMARY KEY ("proposalId","fileVersionId")
);

-- Backfill from legacy single FK
INSERT INTO "ProposalTakeoffSource" ("proposalId", "fileVersionId", "sortOrder")
SELECT "id", "sourceFileVersionId", 0
FROM "Proposal"
WHERE "sourceFileVersionId" IS NOT NULL;

-- Drop old FK and column
ALTER TABLE "Proposal" DROP CONSTRAINT IF EXISTS "Proposal_sourceFileVersionId_fkey";
ALTER TABLE "Proposal" DROP COLUMN IF EXISTS "sourceFileVersionId";

-- Add new FKs
ALTER TABLE "ProposalTakeoffSource" ADD CONSTRAINT "ProposalTakeoffSource_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalTakeoffSource" ADD CONSTRAINT "ProposalTakeoffSource_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "FileVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
