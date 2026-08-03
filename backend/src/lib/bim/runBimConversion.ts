import { prisma } from "../prisma.js";
import type { Env } from "../env.js";
import { gzipSync } from "node:zlib";
import { getObjectStream, putObjectBuffer } from "../s3.js";
import { webStreamToBuffer } from "./streamUtils.js";
import { buildQuantityIndexPhased } from "./quantityIndexBuilder.js";
import { bimFragmentsKey, bimQuantityIndexKey } from "./s3Keys.js";
import type { BimLoqReport } from "./types.js";
import { notifyBimJobEvent } from "./bimJobNotify.js";
import { persistElementVersionDiff } from "./elementVersionDiff.js";
import { findPriorFileVersionId, tryAliasIdenticalIfcVersion } from "./ifcVersionAlias.js";
import { registerMonolithicGeometryTile } from "./geometryManifest.js";
import { hashBufferSha256 } from "./metadataHash.js";
import { assertIfcBytesIntact } from "./ifcBytes.js";

type JobPhase = "summary" | "full" | "diff" | "fragments";

async function uploadQuantityIndex(env: Env, indexKey: string, index: object): Promise<void> {
  const indexJson = Buffer.from(JSON.stringify(index), "utf8");
  const indexPayload = gzipSync(indexJson);
  const put = await putObjectBuffer(env, indexKey, indexPayload, "application/json", "gzip");
  if (!put.ok) throw new Error(put.error);
}

async function updateJobProgress(
  jobRunId: string | undefined,
  progress: number,
  phase: JobPhase,
): Promise<void> {
  if (!jobRunId) return;
  await prisma.jobRun
    .update({
      where: { id: jobRunId },
      data: { resultJson: { progress, phase } },
    })
    .catch(() => undefined);
}

function notifyCtx(
  env: Env,
  fv: {
    id: string;
    version: number;
    file: { id: string; name: string; project: { id: string; workspaceId: string; name: string } };
  },
  userId: string | null,
  jobStartedAt: Date | null,
) {
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
export async function processBimConversion(
  env: Env,
  fileVersionId: string,
  jobRunId?: string,
): Promise<void> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: { file: { include: { project: { include: { workspace: true } } } } },
  });
  if (!fv) throw new Error("File version not found");

  if (fv.bimConversionStatus === "ready" && fv.quantityIndexS3Key) {
    return;
  }
  if (
    fv.bimConversionStatus === "running" &&
    fv.bimConversionJobRunId &&
    jobRunId &&
    fv.bimConversionJobRunId !== jobRunId
  ) {
    return;
  }

  const { workspaceId, id: projectId, name: projectName } = fv.file.project;
  const { id: fileId } = fv.file;
  const skipSummary = Boolean(fv.quantityIndexS3Key) && fv.bimConversionStatus !== "ready";

  const jobStartedAt =
    jobRunId != null
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

  let notifyUserId: string | null = null;
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
    if (!obj.ok) throw new Error(obj.error);
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
      const loq = updated?.bimLoqReport as BimLoqReport | null;
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
            bimLoqReport: summary.loq as object,
            bimConversionStatus: "summary_ready",
          },
        });
        if (!levelsNotified) {
          levelsNotified = true;
          if (fv.file.buildingId) {
            const { syncBuildingLevelsFromIfc } =
              await import("../locations/buildingLevelsFromIfc.js");
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
        if (!jobRunId) return;
        const pct = Math.min(100, Math.floor(fraction * 100));
        if (pct <= lastProgressPct) return;
        lastProgressPct = pct;
        void updateJobProgress(jobRunId, pct, phase);
      },
    });

    await uploadQuantityIndex(env, indexKey, index);

    const loqReport: BimLoqReport = index.loq;

    await persistElementVersionDiff({
      env,
      workspaceId,
      fileId,
      fileVersionId,
      priorFileVersionId,
      elements: index.elements,
    });

    void updateJobProgress(jobRunId, 95, "diff");

    await prisma.fileVersion.update({
      where: { id: fileVersionId },
      data: {
        quantityIndexS3Key: indexKey,
        bimLoqReport: loqReport as object,
        bimConversionStatus: "ready",
      },
    });

    if (!levelsNotified && fv.file.buildingId) {
      const { syncBuildingLevelsFromIfc } = await import("../locations/buildingLevelsFromIfc.js");
      await syncBuildingLevelsFromIfc(env, fileVersionId).catch((err) => {
        console.error("[locations] sync building levels failed (final)", fileVersionId, err);
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
            quantityIndexS3Key: indexKey,
            elementCount: index.elements.length,
            loq: loqReport,
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
  } catch (err) {
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

/** Stores client-uploaded Fragments buffer on S3. */
export async function storeFragmentsBuffer(
  env: Env,
  fileVersionId: string,
  buffer: Buffer,
): Promise<string> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: { file: { include: { project: true } } },
  });
  if (!fv) throw new Error("File version not found");

  const { workspaceId, id: projectId } = fv.file.project;
  const key = bimFragmentsKey(workspaceId, projectId, fv.fileId, fileVersionId);
  const put = await putObjectBuffer(env, key, buffer, "application/octet-stream");
  if (!put.ok) throw new Error(put.error);

  const priorFileVersionId = await findPriorFileVersionId(fv.fileId, fv.version);

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

  return key;
}
