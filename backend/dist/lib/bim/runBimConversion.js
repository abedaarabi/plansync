import { prisma } from "../prisma.js";
import { gzipSync } from "node:zlib";
import { getObjectStream, putObjectBuffer } from "../s3.js";
import { webStreamToBuffer } from "./streamUtils.js";
import { buildQuantityIndexPhased } from "./quantityIndexBuilder.js";
import { bimFragmentsKey, bimQuantityIndexKey } from "./s3Keys.js";
import { createUserNotifications } from "../userNotifications.js";
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
/** Runs IFC → quantity index conversion for a file version. */
// fallow-ignore-next-line complexity
export async function processBimConversion(env, fileVersionId, jobRunId) {
    const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: { include: { workspace: true } } } } },
    });
    if (!fv)
        throw new Error("File version not found");
    const { workspaceId, id: projectId } = fv.file.project;
    const { id: fileId, name: fileName } = fv.file;
    const skipSummary = Boolean(fv.quantityIndexS3Key) && fv.bimConversionStatus !== "ready";
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
            data: { status: "RUNNING", startedAt: new Date() },
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
    try {
        const obj = await getObjectStream(env, fv.s3Key);
        if (!obj.ok)
            throw new Error(obj.error);
        const buf = await webStreamToBuffer(obj.stream);
        const ifcBytes = new Uint8Array(buf);
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
        await prisma.fileVersion.update({
            where: { id: fileVersionId },
            data: {
                quantityIndexS3Key: indexKey,
                bimLoqReport: loqReport,
                bimConversionStatus: "ready",
            },
        });
        if (jobRunId) {
            await prisma.jobRun.update({
                where: { id: jobRunId },
                data: {
                    status: "SUCCEEDED",
                    finishedAt: new Date(),
                    resultJson: {
                        progress: 100,
                        phase: "full",
                        quantityIndexS3Key: indexKey,
                        elementCount: index.elements.length,
                        loq: loqReport,
                    },
                },
            });
        }
        if (notifyUserId) {
            const q = new URLSearchParams({
                projectId,
                fileId,
                fileVersionId,
                name: fileName,
            });
            void createUserNotifications({
                workspaceId,
                projectId,
                recipientUserIds: [notifyUserId],
                kind: "bim.index_ready",
                title: "Model analysis complete",
                body: `${fileName} — quantity index and analytics are ready.`,
                href: `/bim-viewer?${q.toString()}`,
                actorUserId: notifyUserId,
            }).catch((e) => console.error("[bim.index_ready-notify]", e));
        }
    }
    catch (err) {
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
                    errorJson: { message: err instanceof Error ? err.message : String(err) },
                },
            });
        }
        throw err;
    }
}
/** Stores client-uploaded Fragments buffer on S3. */
export async function storeFragmentsBuffer(env, fileVersionId, buffer) {
    const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: true } } },
    });
    if (!fv)
        throw new Error("File version not found");
    const key = bimFragmentsKey(fv.file.project.workspaceId, fv.file.projectId, fv.fileId, fileVersionId);
    const put = await putObjectBuffer(env, key, buffer, "application/octet-stream");
    if (!put.ok)
        throw new Error(put.error);
    await prisma.fileVersion.update({
        where: { id: fileVersionId },
        data: { fragmentsS3Key: key },
    });
    return key;
}
