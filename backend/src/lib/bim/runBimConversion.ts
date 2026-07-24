import { prisma } from "../prisma.js";
import type { Env } from "../env.js";
import { getObjectStream, putObjectBuffer } from "../s3.js";
import { buildQuantityIndexFromIfc } from "./quantityIndexBuilder.js";
import { bimFragmentsKey, bimQuantityIndexKey } from "./s3Keys.js";
import type { BimLoqReport } from "./types.js";

async function webStreamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/** Runs IFC → quantity index conversion for a file version. */
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

  const { workspaceId, id: projectId } = fv.file.project;
  const { id: fileId } = fv.file;

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

  try {
    const obj = await getObjectStream(env, fv.s3Key);
    if (!obj.ok) throw new Error(obj.error);
    const buf = await webStreamToBuffer(obj.stream);
    const ifcBytes = new Uint8Array(buf);

    const index = await buildQuantityIndexFromIfc(ifcBytes, fileVersionId);
    const indexJson = Buffer.from(JSON.stringify(index), "utf8");
    const indexKey = bimQuantityIndexKey(workspaceId, projectId, fileId, fileVersionId);
    const put = await putObjectBuffer(env, indexKey, indexJson, "application/json");
    if (!put.ok) throw new Error(put.error);

    const loqReport: BimLoqReport = index.loq;

    await prisma.fileVersion.update({
      where: { id: fileVersionId },
      data: {
        quantityIndexS3Key: indexKey,
        bimLoqReport: loqReport as object,
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
            quantityIndexS3Key: indexKey,
            elementCount: index.elements.length,
            loq: loqReport,
          },
        },
      });
    }
  } catch (err) {
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

  const key = bimFragmentsKey(
    fv.file.project.workspaceId,
    fv.file.projectId,
    fv.fileId,
    fileVersionId,
  );
  const put = await putObjectBuffer(env, key, buffer, "application/octet-stream");
  if (!put.ok) throw new Error(put.error);
  await prisma.fileVersion.update({
    where: { id: fileVersionId },
    data: { fragmentsS3Key: key },
  });
  return key;
}
