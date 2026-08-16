import { prisma } from "../prisma.js";
import { gzipSync } from "node:zlib";
import { getObjectStream, putObjectBuffer } from "../s3.js";
import { webStreamToBuffer } from "./streamUtils.js";
import { buildQuantityIndexPhased } from "./quantityIndexBuilder.js";
import { bimFragmentsKey, bimQuantityIndexKey } from "./s3Keys.js";
import { notifyBimJobEvent } from "./bimJobNotify.js";
import { persistElementVersionDiff } from "./elementVersionDiff.js";
import { findPriorFileVersionId, tryAliasIdenticalIfcVersion } from "./ifcVersionAlias.js";
import { registerGeometryTiles, registerMonolithicGeometryTile } from "./geometryManifest.js";
import { hashBufferSha256 } from "./metadataHash.js";
import { assertIfcBytesIntact } from "./ifcBytes.js";
import { convertIfcToFragmentsWithTiles } from "./fragmentsConvert.js";
async function uploadQuantityIndex(env, indexKey, index) {
    const indexJson = Buffer.from(JSON.stringify(index), "utf8");
    const indexPayload = gzipSync(indexJson);
    const put = await putObjectBuffer(env, indexKey, indexPayload, "application/json", "gzip");
    if (!put.ok)
        throw new Error(put.error);
}
async function updateJobProgress(jobRunId, progress, phase) {
    if (!jobRunId)
        return;
    await prisma.jobRun
        .update({
        where: { id: jobRunId },
        data: { resultJson: { progress, phase } },
    })
        .catch(() => undefined);
}
function notifyCtx(env, fv, userId, jobStartedAt) {
    return {
        env,
        workspaceId: fv.file.project.workspaceId,
        projectId: fv.file.project.id,
        projectName: fv.file.project.name,
        fileId: fv.file.id,
        fileVersionId: fv.id,
        fileName: fv.file.name,
        versionNumber: fv.version,
        userId,
        jobStartedAt,
    };
}
/** Runs IFC → quantity index conversion for a file version. */
// fallow-ignore-next-line complexity
export async function processBimConversion(env, fileVersionId, jobRunId) {
    const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: { include: { workspace: true } } } } },
    });
    if (!fv)
        throw new Error("File version not found");
    if (fv.bimConversionStatus === "ready" && fv.quantityIndexS3Key && fv.fragmentsS3Key) {
        return;
    }
    // Index ready but geometry missing — only run fragments phase.
    if (fv.bimConversionStatus === "ready" && fv.quantityIndexS3Key && !fv.fragmentsS3Key) {
        try {
            const obj = await getObjectStream(env, fv.s3Key);
            if (!obj.ok)
                throw new Error(obj.error);
            const buf = await webStreamToBuffer(obj.stream);
            const ifcBytes = new Uint8Array(buf);
            assertIfcBytesIntact(ifcBytes, fv.file.name);
            const priorFileVersionId = await findPriorFileVersionId(fv.fileId, fv.version);
            void updateJobProgress(jobRunId, 90, "fragments");
            const converted = await convertIfcToFragmentsWithTiles(ifcBytes, (fraction) => {
                void updateJobProgress(jobRunId, Math.min(99, 90 + Math.floor(fraction * 9)), "fragments");
            });
            await storeConvertedFragments(env, {
                fileVersionId,
                workspaceId: fv.file.project.workspaceId,
                projectId: fv.file.project.id,
                fileId: fv.file.id,
                monolithic: converted.monolithic,
                tiles: converted.tiles,
                priorFileVersionId,
            });
            if (jobRunId) {
                await prisma.jobRun.update({
                    where: { id: jobRunId },
                    data: {
                        status: "SUCCEEDED",
                        finishedAt: new Date(),
                        resultJson: { progress: 100, phase: "fragments", fragmentsReady: true },
                    },
                });
            }
            let notifyUserId = null;
            if (jobRunId) {
                const job = await prisma.jobRun.findUnique({
                    where: { id: jobRunId },
                    select: { createdById: true },
                });
                notifyUserId = job?.createdById ?? null;
            }
            if (notifyUserId) {
                await notifyBimJobEvent("bim.geometry_ready", {
                    ...notifyCtx(env, fv, notifyUserId, new Date()),
                });
            }
        }
        catch (fragErr) {
            console.error("[bim.convert] fragments-only pass failed", fileVersionId, fragErr);
        }
        return;
    }
    if (fv.bimConversionStatus === "running" &&
        fv.bimConversionJobRunId &&
        jobRunId &&
        fv.bimConversionJobRunId !== jobRunId) {
        return;
    }
    const { workspaceId, id: projectId, name: projectName } = fv.file.project;
    const { id: fileId } = fv.file;
    const skipSummary = Boolean(fv.quantityIndexS3Key) && fv.bimConversionStatus !== "ready";
    const jobStartedAt = jobRunId != null
        ? ((await prisma.jobRun.findUnique({ where: { id: jobRunId }, select: { startedAt: true } }))
            ?.startedAt ?? new Date())
        : new Date();
    await prisma.fileVersion.update({
        where: { id: fileVersionId },
        data: {
            bimConversionStatus: "running",
            bimConversionJobRunId: jobRunId ?? null,
        },
    });
    if (jobRunId) {
        await prisma.jobRun.update({
            where: { id: jobRunId },
            data: { status: "RUNNING", startedAt: jobStartedAt },
        });
    }
    let notifyUserId = null;
    if (jobRunId) {
        const job = await prisma.jobRun.findUnique({
            where: { id: jobRunId },
            select: { createdById: true },
        });
        notifyUserId = job?.createdById ?? null;
    }
    const indexKey = bimQuantityIndexKey(workspaceId, projectId, fileId, fileVersionId);
    const priorFileVersionId = await findPriorFileVersionId(fileId, fv.version);
    try {
        const obj = await getObjectStream(env, fv.s3Key);
        if (!obj.ok)
            throw new Error(obj.error);
        const buf = await webStreamToBuffer(obj.stream);
        const ifcBytes = new Uint8Array(buf);
        assertIfcBytesIntact(ifcBytes, fv.file.name);
        if (!fv.sha256) {
            await prisma.fileVersion.update({
                where: { id: fileVersionId },
                data: { sha256: hashBufferSha256(buf) },
            });
        }
        const alias = await tryAliasIdenticalIfcVersion({
            env,
            fileVersionId,
            fileId,
            version: fv.version,
            sha256: fv.sha256,
            ifcBytes,
        });
        if (alias.aliased) {
            const updated = await prisma.fileVersion.findUnique({
                where: { id: fileVersionId },
                select: { bimLoqReport: true },
            });
            if (fv.file.buildingId) {
                const { syncBuildingLevelsFromIfc } = await import("../locations/buildingLevelsFromIfc.js");
                await syncBuildingLevelsFromIfc(env, fileVersionId).catch((err) => {
                    console.error("[locations] sync building levels failed (alias)", fileVersionId, err);
                });
            }
            if (jobRunId) {
                await prisma.jobRun.update({
                    where: { id: jobRunId },
                    data: {
                        status: "SUCCEEDED",
                        finishedAt: new Date(),
                        resultJson: {
                            progress: 100,
                            phase: "full",
                            aliasedFrom: alias.priorFileVersionId,
                        },
                    },
                });
            }
            const loq = updated?.bimLoqReport;
            if (notifyUserId) {
                await notifyBimJobEvent("bim.index_ready", {
                    ...notifyCtx(env, fv, notifyUserId, jobStartedAt),
                    loq,
                    elementCount: 0,
                });
            }
            return;
        }
        let levelsNotified = false;
        let lastProgressPct = -1;
        const index = await buildQuantityIndexPhased(ifcBytes, fileVersionId, {
            skipSummary,
            onSummaryReady: async (summary) => {
                await uploadQuantityIndex(env, indexKey, summary);
                await prisma.fileVersion.update({
                    where: { id: fileVersionId },
                    data: {
                        quantityIndexS3Key: indexKey,
                        bimLoqReport: summary.loq,
                        bimConversionStatus: "summary_ready",
                    },
                });
                if (!levelsNotified) {
                    levelsNotified = true;
                    if (fv.file.buildingId) {
                        const { syncBuildingLevelsFromIfc } = await import("../locations/buildingLevelsFromIfc.js");
                        await syncBuildingLevelsFromIfc(env, fileVersionId).catch((err) => {
                            console.error("[locations] sync building levels failed", fileVersionId, err);
                        });
                    }
                    if (notifyUserId) {
                        await notifyBimJobEvent("bim.levels_ready", {
                            ...notifyCtx(env, fv, notifyUserId, jobStartedAt),
                            loq: summary.loq,
                            elementCount: summary.elements.length,
                        });
                    }
                }
            },
            onProgress: (fraction, phase) => {
                if (!jobRunId)
                    return;
                const pct = Math.min(100, Math.floor(fraction * 100));
                if (pct <= lastProgressPct)
                    return;
                lastProgressPct = pct;
                void updateJobProgress(jobRunId, pct, phase);
            },
        });
        await uploadQuantityIndex(env, indexKey, index);
        const loqReport = index.loq;
        await persistElementVersionDiff({
            env,
            workspaceId,
            fileId,
            fileVersionId,
            priorFileVersionId,
            elements: index.elements,
        });
        void updateJobProgress(jobRunId, 88, "diff");
        await prisma.fileVersion.update({
            where: { id: fileVersionId },
            data: {
                quantityIndexS3Key: indexKey,
                bimLoqReport: loqReport,
                bimConversionStatus: "ready",
            },
        });
        if (!levelsNotified && fv.file.buildingId) {
            const { syncBuildingLevelsFromIfc } = await import("../locations/buildingLevelsFromIfc.js");
            await syncBuildingLevelsFromIfc(env, fileVersionId).catch((err) => {
                console.error("[locations] sync building levels failed (final)", fileVersionId, err);
            });
        }
        let fragmentsReady = Boolean(fv.fragmentsS3Key);
        if (!fragmentsReady) {
            try {
                void updateJobProgress(jobRunId, 90, "fragments");
                const converted = await convertIfcToFragmentsWithTiles(ifcBytes, (fraction, phase) => {
                    const pct = Math.min(99, 90 + Math.floor(fraction * 9));
                    void updateJobProgress(jobRunId, pct, phase === "tiles" ? "fragments" : "fragments");
                });
                await storeConvertedFragments(env, {
                    fileVersionId,
                    workspaceId,
                    projectId,
                    fileId,
                    monolithic: converted.monolithic,
                    tiles: converted.tiles,
                    priorFileVersionId,
                });
                fragmentsReady = true;
                if (notifyUserId) {
                    await notifyBimJobEvent("bim.geometry_ready", {
                        ...notifyCtx(env, fv, notifyUserId, jobStartedAt),
                    });
                }
            }
            catch (fragErr) {
                console.error("[bim.convert] server fragments failed", fileVersionId, fragErr);
                void updateJobProgress(jobRunId, 99, "full");
            }
        }
        if (jobRunId) {
            await prisma.jobRun.update({
                where: { id: jobRunId },
                data: {
                    status: "SUCCEEDED",
                    finishedAt: new Date(),
                    resultJson: {
                        progress: 100,
                        phase: fragmentsReady ? "fragments" : "full",
                        quantityIndexS3Key: indexKey,
                        elementCount: index.elements.length,
                        loq: loqReport,
                        fragmentsReady,
                    },
                },
            });
        }
        if (notifyUserId) {
            await notifyBimJobEvent("bim.index_ready", {
                ...notifyCtx(env, fv, notifyUserId, jobStartedAt),
                loq: loqReport,
                elementCount: index.elements.length,
            });
        }
        void projectName;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.fileVersion.update({
            where: { id: fileVersionId },
            data: { bimConversionStatus: "failed" },
        });
        if (jobRunId) {
            await prisma.jobRun.update({
                where: { id: jobRunId },
                data: {
                    status: "FAILED",
                    finishedAt: new Date(),
                    errorJson: { message },
                },
            });
        }
        if (notifyUserId) {
            await notifyBimJobEvent("bim.conversion_failed", {
                ...notifyCtx(env, fv, notifyUserId, jobStartedAt),
                errorMessage: message,
            });
        }
        throw err;
    }
}
async function storeConvertedFragments(env, opts) {
    const key = bimFragmentsKey(opts.workspaceId, opts.projectId, opts.fileId, opts.fileVersionId);
    const put = await putObjectBuffer(env, key, opts.monolithic, "application/octet-stream");
    if (!put.ok)
        throw new Error(put.error);
    const multi = opts.tiles.length > 1;
    await registerGeometryTiles({
        env,
        workspaceId: opts.workspaceId,
        projectId: opts.projectId,
        fileId: opts.fileId,
        fileVersionId: opts.fileVersionId,
        monolithic: !multi,
        priorFileVersionId: opts.priorFileVersionId,
        tiles: multi
            ? opts.tiles
            : [
                {
                    id: "0_0_0",
                    buffer: opts.monolithic,
                    bounds: [0, 0, 0, 0, 0, 0],
                    guidCount: 0,
                },
            ],
    });
    await prisma.fileVersion.update({
        where: { id: opts.fileVersionId },
        data: { fragmentsS3Key: key },
    });
    return key;
}
/** Stores client-uploaded Fragments buffer on S3. */
export async function storeFragmentsBuffer(env, fileVersionId, buffer) {
    const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: true } } },
    });
    if (!fv)
        throw new Error("File version not found");
    const { workspaceId, id: projectId } = fv.file.project;
    const key = bimFragmentsKey(workspaceId, projectId, fv.fileId, fileVersionId);
    const put = await putObjectBuffer(env, key, buffer, "application/octet-stream");
    if (!put.ok)
        throw new Error(put.error);
    const priorFileVersionId = await findPriorFileVersionId(fv.fileId, fv.version);
    const firstFragmentsUpload = !fv.fragmentsS3Key;
    await registerMonolithicGeometryTile({
        env,
        workspaceId,
        projectId,
        fileId: fv.fileId,
        fileVersionId,
        fragmentsBuffer: buffer,
        priorFileVersionId,
    });
    await prisma.fileVersion.update({
        where: { id: fileVersionId },
        data: { fragmentsS3Key: key },
    });
    // Viewer sessions may re-upload fragments; notify only the first time.
    if (firstFragmentsUpload) {
        const job = fv.bimConversionJobRunId
            ? await prisma.jobRun.findUnique({
                where: { id: fv.bimConversionJobRunId },
                select: { createdById: true, startedAt: true },
            })
            : null;
        if (job?.createdById) {
            await notifyBimJobEvent("bim.geometry_ready", {
                env,
                workspaceId,
                projectId,
                projectName: fv.file.project.name,
                fileId: fv.fileId,
                fileVersionId,
                fileName: fv.file.name,
                versionNumber: fv.version,
                userId: job.createdById,
                jobStartedAt: job.startedAt,
            });
        }
    }
    return key;
}
