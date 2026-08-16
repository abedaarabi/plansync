import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { prisma } from "../prisma.js";
export { processBimConversion, storeFragmentsBuffer } from "./runBimConversion.js";
function attachWorkerHandlers(worker, fileVersionId) {
    worker.on("message", (msg) => {
        if (!msg.ok) {
            console.error("[bim.convert] failed", fileVersionId, msg.error ?? "unknown error");
        }
    });
    worker.on("error", (err) => {
        console.error("[bim.convert] worker error", fileVersionId, err);
    });
}
function workerEntryCandidates() {
    return [
        fileURLToPath(new URL("./bimConversionWorker.js", import.meta.url)),
        fileURLToPath(new URL("../../../dist/lib/bim/bimConversionWorker.js", import.meta.url)),
    ];
}
/** Spawn a detached tsx child so IFC parsing never blocks the API event loop. */
function spawnConversionChild(fileVersionId, jobRunId) {
    const runner = fileURLToPath(new URL("./bimConversionRunner.ts", import.meta.url));
    const child = spawn(process.execPath, ["--import", "tsx", runner, fileVersionId, jobRunId], {
        detached: true,
        stdio: "ignore",
        env: process.env,
    });
    child.unref();
    child.on("error", (err) => {
        console.error("[bim.convert] child spawn failed", fileVersionId, err);
    });
}
/**
 * Runs IFC index build off the API event loop (worker thread or detached child process).
 * Never run conversion on the main thread — it blocks all HTTP handlers in dev.
 */
function startBimConversionWorker(fileVersionId, jobRunId) {
    const workerData = { fileVersionId, jobRunId };
    for (const entry of workerEntryCandidates()) {
        if (!existsSync(entry))
            continue;
        attachWorkerHandlers(new Worker(entry, { workerData }), fileVersionId);
        return;
    }
    spawnConversionChild(fileVersionId, jobRunId);
}
const recentlyRecovered = new Map();
const RECOVER_COOLDOWN_MS = 60_000;
/** Re-kick conversions stuck in QUEUED (e.g. worker failed to start). */
export function recoverStuckBimConversions(fileVersionIds) {
    void (async () => {
        const now = Date.now();
        for (const fileVersionId of fileVersionIds) {
            const last = recentlyRecovered.get(fileVersionId) ?? 0;
            if (now - last < RECOVER_COOLDOWN_MS)
                continue;
            const fv = await prisma.fileVersion.findUnique({
                where: { id: fileVersionId },
                select: { bimConversionStatus: true },
            });
            if (!fv || fv.bimConversionStatus === "running" || fv.bimConversionStatus === "ready") {
                continue;
            }
            const running = await prisma.jobRun.findFirst({
                where: {
                    kind: "bim.convert",
                    status: "RUNNING",
                    payloadJson: { path: ["fileVersionId"], equals: fileVersionId },
                },
                select: { id: true },
            });
            if (running)
                continue;
            const job = await prisma.jobRun.findFirst({
                where: {
                    kind: "bim.convert",
                    status: "QUEUED",
                    payloadJson: { path: ["fileVersionId"], equals: fileVersionId },
                    createdAt: { lt: new Date(now - 15_000) },
                },
                orderBy: { createdAt: "desc" },
                select: { id: true },
            });
            if (!job)
                continue;
            recentlyRecovered.set(fileVersionId, now);
            startBimConversionWorker(fileVersionId, job.id);
        }
    })();
}
/** Enqueue conversion as async background job (returns JobRun id). */
export async function enqueueBimConversion(_env, fileVersionId, userId) {
    const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: true } } },
    });
    if (!fv)
        throw new Error("File version not found");
    if (fv.bimConversionStatus === "ready" && fv.quantityIndexS3Key && fv.fragmentsS3Key) {
        return fv.bimConversionJobRunId ?? fileVersionId;
    }
    const activeJob = await prisma.jobRun.findFirst({
        where: {
            kind: "bim.convert",
            status: { in: ["QUEUED", "RUNNING"] },
            payloadJson: { path: ["fileVersionId"], equals: fileVersionId },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true },
    });
    if (activeJob) {
        await prisma.fileVersion.update({
            where: { id: fileVersionId },
            data: { bimConversionJobRunId: activeJob.id },
        });
        if (activeJob.status === "QUEUED") {
            startBimConversionWorker(fileVersionId, activeJob.id);
        }
        return activeJob.id;
    }
    await prisma.fileVersion.update({
        where: { id: fileVersionId },
        data: { bimConversionStatus: "pending" },
    });
    const job = await prisma.jobRun.create({
        data: {
            workspaceId: fv.file.project.workspaceId,
            projectId: fv.file.projectId,
            kind: "bim.convert",
            status: "QUEUED",
            createdById: userId,
            payloadJson: { fileVersionId },
        },
    });
    await prisma.fileVersion.update({
        where: { id: fileVersionId },
        data: { bimConversionJobRunId: job.id },
    });
    startBimConversionWorker(fileVersionId, job.id);
    return job.id;
}
