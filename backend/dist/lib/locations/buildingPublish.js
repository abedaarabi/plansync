import { prisma } from "../prisma.js";
/** Mark building mappings as dirty after level/mapping edits (no-op if no building). */
export async function markBuildingMappingsDirty(buildingId) {
    if (!buildingId)
        return;
    await prisma.building.update({
        where: { id: buildingId },
        data: { mappingsDirty: true },
    });
}
export async function markBuildingMappingsDirtyByLevelId(levelId) {
    const level = await prisma.bimModelLevel.findUnique({
        where: { id: levelId },
        select: { buildingId: true },
    });
    await markBuildingMappingsDirty(level?.buildingId);
}
export async function markBuildingMappingsDirtyByMappingId(mappingId) {
    const map = await prisma.drawingLevelMap.findUnique({
        where: { id: mappingId },
        select: { bimModelLevel: { select: { buildingId: true } } },
    });
    await markBuildingMappingsDirty(map?.bimModelLevel.buildingId);
}
export function deriveBuildingPublishStatus(input) {
    if (!input.ifcReady || input.levelCount === 0)
        return "setup";
    if (!input.mappingsPublishedAt)
        return "setup";
    if (input.mappingsDirty)
        return "needs_update";
    return "ready";
}
