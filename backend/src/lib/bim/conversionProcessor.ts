import { existsSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { prisma } from "../prisma.js";
import type { Env } from "../env.js";

export { processBimConversion, storeFragmentsBuffer } from "./runBimConversion.js";

/** Runs IFC index build in a worker thread so web-ifc does not block the API event loop. */
function startBimConversionWorker(fileVersionId: string, jobRunId: string): void {
  const jsEntry = new URL("./bimConversionWorker.js", import.meta.url);
  const entry = existsSync(fileURLToPath(jsEntry))
    ? jsEntry
    : new URL("./bimConversionWorker.ts", import.meta.url);
  const worker = new Worker(entry, {
    workerData: { fileVersionId, jobRunId },
  });
  worker.on("message", (msg: { ok: boolean; error?: string }) => {
    if (!msg.ok) {
      console.error("[bim.convert] failed", fileVersionId, msg.error ?? "unknown error");
    }
  });
  worker.on("error", (err) => {
    console.error("[bim.convert] worker error", fileVersionId, err);
  });
}

/** Enqueue conversion as async in-process job (returns JobRun id). */
export async function enqueueBimConversion(
  env: Env,
  fileVersionId: string,
  userId: string | null,
): Promise<string> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: { file: { include: { project: true } } },
  });
  if (!fv) throw new Error("File version not found");

  if (fv.bimConversionStatus === "running") {
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
