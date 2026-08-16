import { prisma } from "../prisma.js";
import { putObjectBuffer } from "../s3.js";
import { bimFragmentsKey, bimGeometryManifestKey, bimGeometryTileKey } from "./s3Keys.js";
import { hashBufferSha256 } from "./metadataHash.js";
const DEFAULT_BOUNDS = [0, 0, 0, 0, 0, 0];
async function upsertGeometryTileBlob(opts) {
    let reused = false;
    if (opts.priorFileVersionId) {
        const priorTile = await prisma.bimVersionTile.findFirst({
            where: {
                fileVersionId: opts.priorFileVersionId,
                contentHash: opts.contentHash,
            },
        });
        if (priorTile) {
            await prisma.bimGeometryTile.update({
                where: { contentHash: opts.contentHash },
                data: { refCount: { increment: 1 } },
            });
            reused = true;
        }
    }
    if (reused)
        return;
    const existing = await prisma.bimGeometryTile.findUnique({
        where: { contentHash: opts.contentHash },
    });
    if (existing) {
        await prisma.bimGeometryTile.update({
            where: { contentHash: opts.contentHash },
            data: { refCount: { increment: 1 } },
        });
        return;
    }
    const tileKey = bimGeometryTileKey(opts.workspaceId, opts.contentHash);
    const put = await putObjectBuffer(opts.env, tileKey, opts.buffer, "application/octet-stream");
    if (!put.ok)
        throw new Error(put.error);
    await prisma.bimGeometryTile.create({
        data: {
            contentHash: opts.contentHash,
            s3Key: tileKey,
            byteLength: BigInt(opts.buffer.byteLength),
            bounds: opts.bounds,
            refCount: 1,
        },
    });
}
/** Register one or more geometry tiles and write the version manifest. */
export async function registerGeometryTiles(opts) {
    if (opts.tiles.length === 0)
        throw new Error("No geometry tiles to register");
    const manifestTiles = [];
    let unionBounds = null;
    for (const tile of opts.tiles) {
        const contentHash = hashBufferSha256(tile.buffer);
        const bounds = tile.bounds ?? DEFAULT_BOUNDS;
        await upsertGeometryTileBlob({
            env: opts.env,
            workspaceId: opts.workspaceId,
            contentHash,
            buffer: tile.buffer,
            bounds,
            priorFileVersionId: opts.priorFileVersionId,
        });
        manifestTiles.push({
            id: tile.id,
            bounds,
            contentHash,
            byteLength: tile.buffer.byteLength,
            guidCount: tile.guidCount ?? 0,
        });
        await prisma.bimVersionTile.upsert({
            where: {
                fileVersionId_tileId: { fileVersionId: opts.fileVersionId, tileId: tile.id },
            },
            create: {
                fileVersionId: opts.fileVersionId,
                tileId: tile.id,
                contentHash,
            },
            update: { contentHash },
        });
        if (!unionBounds) {
            unionBounds = [...bounds];
        }
        else {
            unionBounds = [
                Math.min(unionBounds[0], bounds[0]),
                Math.min(unionBounds[1], bounds[1]),
                Math.min(unionBounds[2], bounds[2]),
                Math.max(unionBounds[3], bounds[3]),
                Math.max(unionBounds[4], bounds[4]),
                Math.max(unionBounds[5], bounds[5]),
            ];
        }
    }
    const manifestKey = bimGeometryManifestKey(opts.workspaceId, opts.projectId, opts.fileId, opts.fileVersionId);
    const manifest = {
        schemaVersion: 1,
        fileVersionId: opts.fileVersionId,
        monolithic: opts.monolithic,
        bounds: opts.monolithic ? DEFAULT_BOUNDS : (unionBounds ?? DEFAULT_BOUNDS),
        tiles: manifestTiles,
    };
    const manifestPut = await putObjectBuffer(opts.env, manifestKey, Buffer.from(JSON.stringify(manifest), "utf8"), "application/json");
    if (!manifestPut.ok)
        throw new Error(manifestPut.error);
    await prisma.fileVersion.update({
        where: { id: opts.fileVersionId },
        data: {
            fragmentsS3Key: bimFragmentsKey(opts.workspaceId, opts.projectId, opts.fileId, opts.fileVersionId),
            geometryManifestS3Key: manifestKey,
        },
    });
    return manifestKey;
}
/** Register monolithic fragments as a single tile (Phase 2 migrates to spatial partition). */
export async function registerMonolithicGeometryTile(opts) {
    return registerGeometryTiles({
        env: opts.env,
        workspaceId: opts.workspaceId,
        projectId: opts.projectId,
        fileId: opts.fileId,
        fileVersionId: opts.fileVersionId,
        monolithic: true,
        priorFileVersionId: opts.priorFileVersionId,
        tiles: [
            {
                id: "0_0_0",
                buffer: opts.fragmentsBuffer,
                bounds: DEFAULT_BOUNDS,
                guidCount: 0,
            },
        ],
    });
}
