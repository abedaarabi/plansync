-- AlterTable
ALTER TABLE "Rfi" ADD COLUMN "answerMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Rfi_answerMessageId_key" ON "Rfi"("answerMessageId");

-- AddForeignKey
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_answerMessageId_fkey" FOREIGN KEY ("answerMessageId") REFERENCES "RfiMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
