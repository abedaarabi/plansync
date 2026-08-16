import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { prisma } from "../prisma.js";
import type { Env } from "../env.js";

export { processBimConversion, storeFragmentsBuffer } from "./runBimConversion.js";

function attachWorkerHandlers(worker: Worker, fileVersionId: string): void {
  worker.on("message", (msg: { ok: boolean; error?: string }) => {
    if (!msg.ok) {
      console.error("[bim.convert] failed", fileVersionId, msg.error ?? "unknown error");
    }
  });
  worker.on("error", (err) => {
    console.error("[bim.convert] worker error", fileVersionId, err);
  });
}

function workerEntryCandidates(): string[] {
  // Prefer the worker next to this module (src when running via tsx, dist in production).
  // Never fall back from a /src/ API process onto a stale /dist/ worker — that silently
  // ships old index builders (e.g. missing typeName) after source changes.
  const sibling = fileURLToPath(new URL("./bimConversionWorker.js", import.meta.url));
  if (sibling.includes("/src/") || sibling.includes("\\src\\")) {
    return [sibling];
  }
  return [
    sibling,
    fileURLToPath(new URL("../../../dist/lib/bim/bimConversionWorker.js", import.meta.url)),
  ];
}

/** Spawn a detached tsx child so IFC parsing never blocks the API event loop. */
function spawnConversionChild(fileVersionId: string, jobRunId: string): void {
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
function startBimConversionWorker(fileVersionId: string, jobRunId: string): void {
  const workerData = { fileVersionId, jobRunId };
  for (const entry of workerEntryCandidates()) {
    if (!existsSync(entry)) continue;
    attachWorkerHandlers(new Worker(entry, { workerData }), fileVersionId);
    return;
  }

  spawnConversionChild(fileVersionId, jobRunId);
}

const recentlyRecovered = new Map<string, number>();
const RECOVER_COOLDOWN_MS = 60_000;

/** Re-kick conversions stuck in QUEUED (e.g. worker failed to start). */
export function recoverStuckBimConversions(fileVersionIds: string[]): void {
  void (async () => {
    const now = Date.now();
    for (const fileVersionId of fileVersionIds) {
      const last = recentlyRecovered.get(fileVersionId) ?? 0;
      if (now - last < RECOVER_COOLDOWN_MS) continue;

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
      if (running) continue;

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
      if (!job) continue;

      recentlyRecovered.set(fileVersionId, now);
      startBimConversionWorker(fileVersionId, job.id);
    }
  })();
}

/** Enqueue conversion as async background job (returns JobRun id). */
export async function enqueueBimConversion(
  _env: Env,
  fileVersionId: string,
  userId: string | null,
  opts?: { force?: boolean },
): Promise<string> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: { file: { include: { project: true } } },
  });
  if (!fv) throw new Error("File version not found");

  if (
    !opts?.force &&
    fv.bimConversionStatus === "ready" &&
    fv.quantityIndexS3Key &&
    fv.fragmentsS3Key
  ) {
    return fv.bimConversionJobRunId ?? fileVersionId;
  }

  if (opts?.force) {
    // Keep fragments; clear index so processBimConversion rebuilds typeName metadata.
    await prisma.fileVersion.update({
      where: { id: fileVersionId },
      data: {
        bimConversionStatus: "pending",
        quantityIndexS3Key: null,
      },
    });
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

  if (activeJob && !opts?.force) {
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
      payloadJson: { fileVersionId, force: Boolean(opts?.force) },
    },
  });

  await prisma.fileVersion.update({
    where: { id: fileVersionId },
    data: { bimConversionJobRunId: job.id },
  });

  startBimConversionWorker(fileVersionId, job.id);

  return job.id;
}
