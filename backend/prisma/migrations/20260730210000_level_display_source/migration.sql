-- CreateEnum
CREATE TYPE "LevelDisplaySource" AS ENUM ('IFC_CUT', 'DRAWING');

-- AlterTable
ALTER TABLE "BimModelLevel" ADD COLUMN     "displaySource" "LevelDisplaySource" NOT NULL DEFAULT 'IFC_CUT';
