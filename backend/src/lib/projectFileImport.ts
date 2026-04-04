import { ActivityType } from "@prisma/client";
import type { Env } from "./env.js";
import { prisma } from "./prisma.js";
import { putObjectBuffer } from "./s3.js";
import { buildUploadObjectKey, newUploadId, upsertFileForUpload } from "./fileUpload.js";
import { resolvedMimeType } from "./mime.js";
import { logActivitySafe } from "./activity.js";
import { maybeSendStorageAlerts } from "./storageAlerts.js";
import { loadProjectForMember } from "./projectAccess.js";
import { isWorkspacePro } from "./subscription.js";
import { fileVersionJson } from "./json.js";

function requirePro(workspace: { subscriptionStatus: string | null }) {
  if (!isWorkspacePro(workspace)) {
    return { error: "Pro subscription required", status: 402 as const };
  }
  return null;
}

function isAllowedImportMime(mime: string, fileName: string): boolean {
  const m = mime.toLowerCase();
  if (m === "application/pdf" || m.includes("pdf")) return true;
  if (m.startsWith("image/")) return true;
  const ext = fileName.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? "";
  return ["pdf", "png", "jpg", "jpeg", "webp", "gif", "tif", "tiff"].includes(ext);
}

export type CommitProjectFileImportResult =
  | {
      ok: true;
      file: Awaited<ReturnType<typeof prisma.file.findUniqueOrThrow>>;
      fileVersionJson: ReturnType<typeof fileVersionJson>;
    }
  | { ok: false; error: string; status: number };

/**
 * Upload bytes to S3 and create a new file version (same rules as POST /files/upload).
 */
export async function commitProjectFileImportFromBuffer(params: {
  env: Env;
  userId: string;
  workspaceId: string;
  projectId: string;
  folderId?: string;
  fileName: string;
  buffer: Buffer;
  contentTypeHint?: string;
}): Promise<CommitProjectFileImportResult> {
  const { env, userId, workspaceId, projectId, folderId, fileName, buffer, contentTypeHint } =
    params;
  const sizeBytes = BigInt(buffer.length);
  if (sizeBytes > env.MAX_DIRECT_UPLOAD_BYTES) {
    return { ok: false, error: "File too large for import", status: 413 };
  }
  if (sizeBytes === 0n) {
    return { ok: false, error: "Empty file", status: 400 };
  }

  const access = await loadProjectForMember(projectId, userId);
  if ("error" in access) return { ok: false, error: access.error, status: access.status };
  if (access.project.workspaceId !== workspaceId) {
    return { ok: false, error: "Forbidden", status: 403 };
  }
  const gate = requirePro(access.project.workspace);
  if (gate) return { ok: false, error: gate.error, status: gate.status };

  const ws = access.project.workspace;
  const contentType = resolvedMimeType(contentTypeHint, fileName);
  if (!isAllowedImportMime(contentType, fileName)) {
    return {
      ok: false,
      error: "Only PDF and image files can be imported from cloud storage.",
      status: 400,
    };
  }

  const newUsed = ws.storageUsedBytes + sizeBytes;
  if (newUsed > ws.storageQuotaBytes) {
    return { ok: false, error: "Storage quota exceeded", status: 400 };
  }

  const file = await upsertFileForUpload({
    projectId,
    folderId,
    name: fileName,
  });
  const uploadId = newUploadId();
  const key = buildUploadObjectKey(workspaceId, projectId, file.id, uploadId);

  const put = await putObjectBuffer(env, key, buffer, contentType);
  if (!put.ok) {
    if (put.error === "S3 not configured") {
      return { ok: false, error: "S3 not configured — set AWS_* and S3_BUCKET", status: 503 };
    }
    return { ok: false, error: put.error, status: 502 };
  }

  const beforeUsed = ws.storageUsedBytes;
  const { fv, updatedWs } = await prisma.$transaction(async (tx) => {
    const agg = await tx.fileVersion.aggregate({
      where: { fileId: file.id },
      _max: { version: true },
    });
    const nextVersion = (agg._max.version ?? 0) + 1;
    const fv = await tx.fileVersion.create({
      data: {
        fileId: file.id,
        version: nextVersion,
        s3Key: key,
        sizeBytes,
        uploadedById: userId,
      },
    });
    await tx.file.update({
      where: { id: file.id },
      data: { mimeType: contentType },
    });
    const updatedWs = await tx.workspace.update({
      where: { id: workspaceId },
      data: { storageUsedBytes: { increment: sizeBytes } },
    });
    return { fv, updatedWs };
  });

  const fileRow = await prisma.file.findUniqueOrThrow({ where: { id: file.id } });

  await logActivitySafe(workspaceId, ActivityType.FILE_VERSION_ADDED, {
    actorUserId: userId,
    entityId: fv.id,
    projectId,
    metadata: { fileId: file.id, fileName: file.name, version: fv.version, source: "cloud_import" },
  });

  await maybeSendStorageAlerts(
    env,
    updatedWs.id,
    beforeUsed,
    updatedWs.storageUsedBytes,
    updatedWs.storageQuotaBytes,
  );

  return { ok: true, file: fileRow, fileVersionJson: fileVersionJson(fv) };
}
