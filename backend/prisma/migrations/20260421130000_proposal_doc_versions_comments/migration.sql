-- CreateTable: ProposalDocumentVersion
CREATE TABLE "ProposalDocumentVersion" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "contentJson" JSONB NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProposalComment
CREATE TABLE "ProposalComment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProposalDocumentVersion_proposalId_versionNumber_key" ON "ProposalDocumentVersion"("proposalId", "versionNumber");

-- CreateIndex
CREATE INDEX "ProposalDocumentVersion_proposalId_createdAt_idx" ON "ProposalDocumentVersion"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "ProposalComment_proposalId_createdAt_idx" ON "ProposalComment"("proposalId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProposalDocumentVersion" ADD CONSTRAINT "ProposalDocumentVersion_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalDocumentVersion" ADD CONSTRAINT "ProposalDocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalComment" ADD CONSTRAINT "ProposalComment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalComment" ADD CONSTRAINT "ProposalComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
