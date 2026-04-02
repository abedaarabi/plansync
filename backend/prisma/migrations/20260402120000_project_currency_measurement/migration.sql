-- CreateEnum
CREATE TYPE "ProjectMeasurementSystem" AS ENUM ('METRIC', 'IMPERIAL');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Project" ADD COLUMN "measurementSystem" "ProjectMeasurementSystem" NOT NULL DEFAULT 'METRIC';
