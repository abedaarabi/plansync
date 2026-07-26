import { existsSync } from "node:fs";
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
/**
 * Runs IFC index build off the API event loop when a compiled worker exists.
 * In tsx/dev, Node's type-stripping can load `.ts` but not resolve `.js` → `.ts`,
 * so we either run via `tsx/cli` or fall back in-process.
 */
function startBimConversionWorker(fileVersionId, jobRunId) {
    const workerData = { fileVersionId, jobRunId };
    const jsEntry = new URL("./bimConversionWorker.js", import.meta.url);
    if (existsSync(fileURLToPath(jsEntry))) {
        attachWorkerHandlers(new Worker(jsEntry, { workerData }), fileVersionId);
        return;
    }
    const tsPath = fileURLToPath(new URL("./bimConversionWorker.ts", import.meta.url));
    try {
        const tsxCli = new URL(import.meta.resolve("tsx/cli"));
        attachWorkerHandlers(new Worker(tsxCli, {
            argv: [tsPath],
            workerData,
        }), fileVersionId);
        return;
    }
    catch {
        /* fall through — in-process */
    }
    void (async () => {
        try {
            const { loadEnv } = await import("../env.js");
            const { processBimConversion } = await import("./runBimConversion.js");
            await processBimConversion(loadEnv(), fileVersionId, jobRunId);
        }
        catch (err) {
            console.error("[bim.convert] failed", fileVersionId, err instanceof Error ? err.message : err);
        }
    })();
}
/** Enqueue conversion as async in-process job (returns JobRun id). */
export async function enqueueBimConversion(env, fileVersionId, userId) {
    const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: true } } },
    });
    if (!fv)
        throw new Error("File version not found");
    if (fv.bimConversionStatus === "running") {
        return fv.bimConversionJobRunId ?? fileVersionId;
    }
    if (fv.bimConversionStatus === "ready" && fv.quantityIndexS3Key) {
        return fv.bimConversionJobRunId ?? fileVersionId;
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
    startBimConversionWorker(fileVersionId, job.id);
    return job.id;
}
