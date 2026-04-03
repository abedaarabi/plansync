-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'RFI_MESSAGE_POSTED';

-- CreateTable
CREATE TABLE "RfiMessage" (
    "id" TEXT NOT NULL,
    "rfiId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RfiMessage_rfiId_idx" ON "RfiMessage"("rfiId");

-- AddForeignKey
ALTER TABLE "RfiMessage" ADD CONSTRAINT "RfiMessage_rfiId_fkey" FOREIGN KEY ("rfiId") REFERENCES "Rfi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfiMessage" ADD CONSTRAINT "RfiMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
