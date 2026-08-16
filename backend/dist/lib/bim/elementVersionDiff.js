import { prisma } from "../prisma.js";
import { putObjectBuffer } from "../s3.js";
import { bimMetadataKey } from "./s3Keys.js";
import { hashElementMetadata } from "./metadataHash.js";
function searchableAttrs(entry) {
    const out = [];
    const push = (key, value) => {
        const v = value?.trim();
        if (!v)
            return;
        out.push({ key, value: v.slice(0, 512) });
    };
    push("ifc_type", entry.ifcType);
    push("name", entry.name);
    push("level", entry.level);
    push("material", entry.material);
    push("discipline", entry.discipline);
    if (entry.quantities.area != null)
        push("area", String(entry.quantities.area));
    if (entry.quantities.volume != null)
        push("volume", String(entry.quantities.volume));
    if (entry.quantities.length != null)
        push("length", String(entry.quantities.length));
    return out;
}
async function ensureMetadataOnS3(env, workspaceId, hash, entry) {
    const key = bimMetadataKey(workspaceId, hash);
    const existing = await prisma.bimElementVersion.findFirst({
        where: { metadataHash: hash },
        select: { metadataS3Key: true },
    });
    if (existing)
        return existing.metadataS3Key;
    const payload = Buffer.from(JSON.stringify({
        guid: entry.guid,
        ifcType: entry.ifcType,
        name: entry.name,
        level: entry.level,
        material: entry.material,
        discipline: entry.discipline,
        surfaceColor: entry.surfaceColor ?? null,
        quantities: entry.quantities,
        quantitySource: entry.quantitySource,
        lodFlags: entry.lodFlags,
    }), "utf8");
    const put = await putObjectBuffer(env, key, payload, "application/json");
    if (!put.ok)
        throw new Error(put.error);
    return key;
}
async function loadPriorGuidHashes(fileId, priorFileVersionId) {
    const rows = await prisma.bimElementVersion.findMany({
        where: {
            fileVersionId: priorFileVersionId,
            changeType: { not: "DELETED" },
            element: { fileId },
        },
        select: {
            metadataHash: true,
            metadataS3Key: true,
            elementId: true,
            element: { select: { ifcGuid: true } },
        },
    });
    const map = new Map();
    for (const row of rows) {
        map.set(row.element.ifcGuid, {
            hash: row.metadataHash,
            s3Key: row.metadataS3Key,
            elementId: row.elementId,
        });
    }
    return map;
}
/** Diff elements against prior version; write only new/changed metadata to S3. */
export async function persistElementVersionDiff(opts) {
    const stats = { added: 0, unchanged: 0, modified: 0, deleted: 0 };
    const priorMap = opts.priorFileVersionId
        ? await loadPriorGuidHashes(opts.fileId, opts.priorFileVersionId)
        : new Map();
    const newGuids = new Set();
    for (const entry of opts.elements) {
        newGuids.add(entry.guid);
        const hash = hashElementMetadata(entry);
        const prior = priorMap.get(entry.guid);
        let changeType;
        let metadataS3Key;
        if (!prior) {
            changeType = "ADDED";
            metadataS3Key = await ensureMetadataOnS3(opts.env, opts.workspaceId, hash, entry);
            stats.added += 1;
        }
        else if (prior.hash === hash) {
            changeType = "UNCHANGED";
            metadataS3Key = prior.s3Key;
            stats.unchanged += 1;
        }
        else {
            changeType = "MODIFIED";
            metadataS3Key = await ensureMetadataOnS3(opts.env, opts.workspaceId, hash, entry);
            stats.modified += 1;
        }
        const element = await prisma.bimElement.upsert({
            where: { fileId_ifcGuid: { fileId: opts.fileId, ifcGuid: entry.guid } },
            create: {
                fileId: opts.fileId,
                ifcGuid: entry.guid,
                ifcType: entry.ifcType,
                name: entry.name,
            },
            update: {
                ifcType: entry.ifcType,
                name: entry.name,
            },
        });
        await prisma.bimElementVersion.upsert({
            where: {
                elementId_fileVersionId: { elementId: element.id, fileVersionId: opts.fileVersionId },
            },
            create: {
                elementId: element.id,
                fileVersionId: opts.fileVersionId,
                metadataS3Key,
                metadataHash: hash,
                changeType,
            },
            update: {
                metadataS3Key,
                metadataHash: hash,
                changeType,
            },
        });
        await prisma.bimElementAttribute.deleteMany({
            where: { elementId: element.id, fileVersionId: opts.fileVersionId },
        });
        const attrs = searchableAttrs(entry);
        const uniqueAttrs = [...new Map(attrs.map((a) => [a.key, a])).values()];
        if (uniqueAttrs.length > 0) {
            await prisma.bimElementAttribute.createMany({
                data: uniqueAttrs.map((a) => ({
                    elementId: element.id,
                    fileVersionId: opts.fileVersionId,
                    key: a.key,
                    value: a.value,
                })),
                skipDuplicates: true,
            });
        }
    }
    if (opts.priorFileVersionId) {
        for (const [guid, prior] of priorMap) {
            if (newGuids.has(guid))
                continue;
            await prisma.bimElementVersion.upsert({
                where: {
                    elementId_fileVersionId: {
                        elementId: prior.elementId,
                        fileVersionId: opts.fileVersionId,
                    },
                },
                create: {
                    elementId: prior.elementId,
                    fileVersionId: opts.fileVersionId,
                    metadataS3Key: prior.s3Key,
                    metadataHash: prior.hash,
                    changeType: "DELETED",
                },
                update: { changeType: "DELETED" },
            });
            stats.deleted += 1;
        }
    }
    return stats;
}
/** Copy element version pointers from an aliased prior version (identical IFC bytes). */
export async function cloneElementVersionsFromPrior(priorFileVersionId, newFileVersionId) {
    const priorRows = await prisma.bimElementVersion.findMany({
        where: { fileVersionId: priorFileVersionId, changeType: { not: "DELETED" } },
    });
    for (const row of priorRows) {
        await prisma.bimElementVersion.upsert({
            where: {
                elementId_fileVersionId: {
                    elementId: row.elementId,
                    fileVersionId: newFileVersionId,
                },
            },
            create: {
                elementId: row.elementId,
                fileVersionId: newFileVersionId,
                metadataS3Key: row.metadataS3Key,
                metadataHash: row.metadataHash,
                changeType: "UNCHANGED",
            },
            update: {
                metadataS3Key: row.metadataS3Key,
                metadataHash: row.metadataHash,
                changeType: "UNCHANGED",
            },
        });
        const attrs = await prisma.bimElementAttribute.findMany({
            where: { elementId: row.elementId, fileVersionId: priorFileVersionId },
        });
        await prisma.bimElementAttribute.deleteMany({
            where: { elementId: row.elementId, fileVersionId: newFileVersionId },
        });
        if (attrs.length > 0) {
            await prisma.bimElementAttribute.createMany({
                data: attrs.map((a) => ({
                    elementId: a.elementId,
                    fileVersionId: newFileVersionId,
                    key: a.key,
                    value: a.value,
                })),
            });
        }
    }
}
