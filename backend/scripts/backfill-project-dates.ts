import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
dotenv.config({ path: resolve(process.cwd(), "../.env") });

const prisma = new PrismaClient();

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const projects = await prisma.project.findMany({
    where: {
      OR: [{ startDate: null }, { endDate: null }],
    },
    select: { id: true, startDate: true, endDate: true },
  });

  if (projects.length === 0) {
    console.log("No projects need date backfill.");
    return;
  }

  const now = new Date();
  let updatedCount = 0;

  for (const project of projects) {
    const startDate =
      project.startDate ?? new Date(now.getTime() - randomInt(30, 540) * 24 * 60 * 60 * 1000);
    const endDate =
      project.endDate ?? new Date(startDate.getTime() + randomInt(30, 540) * 24 * 60 * 60 * 1000);

    await prisma.project.update({
      where: { id: project.id },
      data: { startDate, endDate },
    });
    updatedCount += 1;
  }

  console.log(`Backfilled dates for ${updatedCount} project(s).`);
}

main()
  .catch((error) => {
    console.error("Failed to backfill project dates:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
