import { prisma } from "../prisma.js";
import { deleteFileFromS3AndDb } from "../deleteProjectAssets.js";
import { deleteObject } from "../s3.js";
import { buildingFolderKey } from "./locationsAccess.js";
/** Remove a building and its levels/mappings; hard-delete building-folder uploads, unlink other files. */
export async function cascadeDeleteBuilding(env, buildingId, workspaceId) {
    const building = await prisma.building.findUnique({
        where: { id: buildingId },
        select: { imageS3Key: true, imageSizeBytes: true },
    });
    const folderKey = buildingFolderKey(buildingId);
    const files = await prisma.file.findMany({
        where: { buildingId },
        select: { id: true, folderKey: true },
    });
    let bytesFreed = 0n;
    for (const file of files) {
        if (file.folderKey === folderKey) {
            const result = await deleteFileFromS3AndDb(env, file.id);
            if (result.ok)
                bytesFreed += result.bytesFreed;
        }
        else {
            await prisma.file.update({
                where: { id: file.id },
                data: {
                    buildingId: null,
                    buildingAssetType: null,
                    buildingDiscipline: null,
                },
            });
        }
    }
    if (building?.imageS3Key) {
        const imgDel = await deleteObject(env, building.imageS3Key);
        if (!imgDel.ok && imgDel.error !== "S3 not configured") {
            console.warn(`[building cascade] deleteObject ${building.imageS3Key}:`, imgDel.error);
        }
        bytesFreed += building.imageSizeBytes ?? 0n;
    }
    // Levels + drawing maps cascade via Prisma relations.
    await prisma.building.delete({ where: { id: buildingId } });
    if (bytesFreed > 0n) {
        await prisma.workspace.update({
            where: { id: workspaceId },
            data: { storageUsedBytes: { decrement: bytesFreed } },
        });
    }
    return { bytesFreed };
}
/** Remove a location and every building under it (cascade). */
export async function cascadeDeleteLocation(env, locationId, workspaceId) {
    const buildings = await prisma.building.findMany({
        where: { locationId },
        select: { id: true },
    });
    let bytesFreed = 0n;
    for (const building of buildings) {
        const result = await cascadeDeleteBuilding(env, building.id, workspaceId);
        bytesFreed += result.bytesFreed;
    }
    await prisma.location.delete({ where: { id: locationId } });
    return { bytesFreed };
}
