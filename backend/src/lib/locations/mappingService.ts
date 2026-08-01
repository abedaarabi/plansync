import type { Prisma } from "@prisma/client";
import {
  computeTransformFromCalibration,
  type CalibrationInput,
} from "../../shared/calibrationTransform.js";
import { prisma } from "../prisma.js";

export type { CalibrationInput } from "../../shared/calibrationTransform.js";

export async function createLevelMapping(params: {
  levelId: string;
  fileAssetId: string;
  userId: string;
  calibration: CalibrationInput;
  ifcFileVersionId: string;
  projectId: string;
  pageIndex?: number;
}) {
  const level = await prisma.bimModelLevel.findFirst({
    where: { id: params.levelId, projectId: params.projectId },
  });
  if (!level) throw new Error("Level not found");

  const file = await prisma.file.findFirst({
    where: { id: params.fileAssetId, projectId: params.projectId, buildingAssetType: "PDF" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!file) throw new Error("PDF asset not found");
  const pdfFv = file.versions[0];
  if (!pdfFv) throw new Error("PDF version not found");

  const existing = await prisma.drawingLevelMap.findFirst({
    where: { pdfFileId: file.id, bimModelLevelId: level.id },
  });
  if (existing) throw new Error("Drawing already mapped to this level");

  const transform = computeTransformFromCalibration(params.calibration);
  const pageIndex = params.pageIndex ?? params.calibration.pageIndex ?? 0;

  return prisma.drawingLevelMap.create({
    data: {
      projectId: params.projectId,
      ifcFileVersionId: params.ifcFileVersionId,
      bimModelLevelId: level.id,
      pdfFileId: file.id,
      pdfFileVersionId: pdfFv.id,
      pageIndex,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      scale: transform.scale,
      rotationDeg: transform.rotationDeg,
      calibrationJson: params.calibration as unknown as Prisma.InputJsonValue,
      coordAlignedAt: new Date(),
      coordAlignedById: params.userId,
    },
  });
}

export async function updateLevelMapping(
  mappingId: string,
  userId: string,
  calibration: CalibrationInput,
) {
  const transform = computeTransformFromCalibration(calibration);
  return prisma.drawingLevelMap.update({
    where: { id: mappingId },
    data: {
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      scale: transform.scale,
      rotationDeg: transform.rotationDeg,
      calibrationJson: calibration as unknown as Prisma.InputJsonValue,
      coordAlignedAt: new Date(),
      coordAlignedById: userId,
    },
  });
}

export async function deleteLevelMapping(mappingId: string): Promise<void> {
  await prisma.drawingLevelMap.delete({ where: { id: mappingId } });
}
