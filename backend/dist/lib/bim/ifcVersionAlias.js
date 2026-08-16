import { prisma } from "../prisma.js";
import { hashBufferSha256 } from "./metadataHash.js";
import { cloneElementVersionsFromPrior } from "./elementVersionDiff.js";
/** If IFC bytes match a prior ready version, alias artifacts and skip reprocessing. */
export async function tryAliasIdenticalIfcVersion(opts) {
    const hash = opts.sha256?.trim() || hashBufferSha256(Buffer.from(opts.ifcBytes));
    if (!opts.sha256) {
        await prisma.fileVersion.update({
            where: { id: opts.fileVersionId },
            data: { sha256: hash },
        });
    }
    const prior = await prisma.fileVersion.findFirst({
        where: {
            fileId: opts.fileId,
            version: { lt: opts.version },
            sha256: hash,
            bimConversionStatus: "ready",
            quantityIndexS3Key: { not: null },
        },
        orderBy: { version: "desc" },
    });
    if (!prior?.quantityIndexS3Key)
        return { aliased: false };
    await prisma.fileVersion.update({
        where: { id: opts.fileVersionId },
        data: {
            quantityIndexS3Key: prior.quantityIndexS3Key,
            fragmentsS3Key: prior.fragmentsS3Key,
            geometryManifestS3Key: prior.geometryManifestS3Key,
            bimLoqReport: prior.bimLoqReport ?? undefined,
            bimConversionStatus: "ready",
        },
    });
    await cloneElementVersionsFromPrior(prior.id, opts.fileVersionId);
    if (prior.geometryManifestS3Key) {
        const tiles = await prisma.bimVersionTile.findMany({
            where: { fileVersionId: prior.id },
        });
        for (const tile of tiles) {
            await prisma.bimVersionTile.upsert({
                where: {
                    fileVersionId_tileId: {
                        fileVersionId: opts.fileVersionId,
                        tileId: tile.tileId,
                    },
                },
                create: {
                    fileVersionId: opts.fileVersionId,
                    tileId: tile.tileId,
                    contentHash: tile.contentHash,
                },
                update: { contentHash: tile.contentHash },
            });
            await prisma.bimGeometryTile.update({
                where: { contentHash: tile.contentHash },
                data: { refCount: { increment: 1 } },
            });
        }
    }
    void opts.env;
    return { aliased: true, priorFileVersionId: prior.id };
}
export async function findPriorFileVersionId(fileId, version) {
    const prior = await prisma.fileVersion.findFirst({
        where: { fileId, version: { lt: version } },
        orderBy: { version: "desc" },
        select: { id: true },
    });
    return prior?.id ?? null;
}
