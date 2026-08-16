import { computeTransformFromCalibration, } from "../../shared/drawingCoordBridge.js";
import { prisma } from "../prisma.js";
async function loadPdfAssetForLevel(levelId, fileAssetId, projectId) {
    const level = await prisma.bimModelLevel.findFirst({
        where: { id: levelId, projectId },
    });
    if (!level)
        throw new Error("Level not found");
    const file = await prisma.file.findFirst({
        where: { id: fileAssetId, projectId, buildingAssetType: "PDF" },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!file)
        throw new Error("PDF asset not found");
    const pdfFv = file.versions[0];
    if (!pdfFv)
        throw new Error("PDF version not found");
    if (level.buildingId && file.buildingId && file.buildingId !== level.buildingId) {
        throw new Error("PDF belongs to a different building");
    }
    return { level, file, pdfFv };
}
/** Simple PDF→level assign (no IFC, no calibration). Whole file, pageIndex 0. */
export async function assignDrawingToLevel(params) {
    const { level, file, pdfFv } = await loadPdfAssetForLevel(params.levelId, params.fileAssetId, params.projectId);
    const alreadyOnLevel = await prisma.drawingLevelMap.findFirst({
        where: { pdfFileId: file.id, bimModelLevelId: level.id },
    });
    if (alreadyOnLevel)
        throw new Error("Drawing already assigned to this level");
    if (level.buildingId) {
        const buildingLevelIds = await prisma.bimModelLevel.findMany({
            where: { buildingId: level.buildingId },
            select: { id: true },
        });
        const ids = buildingLevelIds.map((l) => l.id);
        const elsewhere = await prisma.drawingLevelMap.findFirst({
            where: {
                pdfFileId: file.id,
                bimModelLevelId: { in: ids },
            },
            select: { id: true, bimModelLevelId: true },
        });
        if (elsewhere)
            throw new Error("Drawing is already assigned to another level in this building");
    }
    else {
        const elsewhere = await prisma.drawingLevelMap.findFirst({
            where: { pdfFileId: file.id, projectId: params.projectId },
            select: { id: true },
        });
        if (elsewhere)
            throw new Error("Drawing is already assigned to a level");
    }
    return prisma.drawingLevelMap.create({
        data: {
            projectId: params.projectId,
            ifcFileVersionId: null,
            bimModelLevelId: level.id,
            pdfFileId: file.id,
            pdfFileVersionId: pdfFv.id,
            pageIndex: 0,
        },
    });
}
export async function createLevelMapping(params) {
    const { level, file, pdfFv } = await loadPdfAssetForLevel(params.levelId, params.fileAssetId, params.projectId);
    const existing = await prisma.drawingLevelMap.findFirst({
        where: { pdfFileId: file.id, bimModelLevelId: level.id },
    });
    if (existing)
        throw new Error("Drawing already mapped to this level");
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
            calibrationJson: params.calibration,
            coordAlignedAt: new Date(),
            coordAlignedById: params.userId,
        },
    });
}
export async function updateLevelMapping(mappingId, userId, calibration) {
    const transform = computeTransformFromCalibration(calibration);
    return prisma.drawingLevelMap.update({
        where: { id: mappingId },
        data: {
            offsetX: transform.offsetX,
            offsetY: transform.offsetY,
            scale: transform.scale,
            rotationDeg: transform.rotationDeg,
            calibrationJson: calibration,
            coordAlignedAt: new Date(),
            coordAlignedById: userId,
        },
    });
}
export async function deleteLevelMapping(mappingId) {
    await prisma.drawingLevelMap.delete({ where: { id: mappingId } });
}
