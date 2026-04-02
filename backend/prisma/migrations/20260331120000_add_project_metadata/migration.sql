-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "projectNumber" TEXT,
ADD COLUMN     "localBudget" DECIMAL(19,2),
ADD COLUMN     "projectSize" TEXT,
ADD COLUMN     "projectType" TEXT,
ADD COLUMN     "location" TEXT;
