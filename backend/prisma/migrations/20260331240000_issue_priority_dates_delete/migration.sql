-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "dueDate" TIMESTAMP(3),
ADD COLUMN "location" TEXT;

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'ISSUE_DELETED';
