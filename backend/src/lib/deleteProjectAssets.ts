import type { Env } from "./env.js";
import { prisma } from "./prisma.js";
import { deleteObject } from "./s3.js";

/** Issue / punch reference photo JSON arrays — collect S3 keys and recorded byte sizes. */
function storageBytesAndKeysFromPhotoJsonArray(v: unknown): { keys: string[]; bytes: bigint } {
  const keys: string[] = [];
  let bytes = 0n;
  if (!Array.isArray(v)) return { keys, bytes };
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const s3Key = typeof o.s3Key === "string" && o.s3Key.trim() ? o.s3Key.trim() : "";
    if (!s3Key) continue;
    keys.push(s3Key);
    if (typeof o.sizeBytes === "number" && Number.isFinite(o.sizeBytes) && o.sizeBytes >= 0) {
      bytes += BigInt(Math.min(Math.floor(o.sizeBytes), 80 * 1024 * 1024));
    }
  }
  return { keys, bytes };
}

export async function deleteFileFromS3AndDb(
  env: Env,
  fileId: string,
): Promise<{ ok: true; bytesFreed: bigint } | { ok: false; error: string }> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { versions: true },
  });
  if (!file) return { ok: false, error: "Not found" };
  let bytesFreed = 0n;
  for (const v of file.versions) {
    bytesFreed += v.sizeBytes;
    const del = await deleteObject(env, v.s3Key);
    if (!del.ok && del.error !== "S3 not configured") {
      console.warn(`deleteObject failed for ${v.s3Key}:`, del.error);
    }
  }
  await prisma.file.delete({ where: { id: fileId } });
  return { ok: true, bytesFreed };
}

/**
 * Deletes one revision. If it is the only remaining revision, removes the whole `File` (same as full delete).
 */
export async function deleteFileVersionFromS3AndDb(
  env: Env,
  fileId: string,
  version: number,
): Promise<
  { ok: true; bytesFreed: bigint; removedWholeFile: boolean } | { ok: false; error: string }
> {
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: "Invalid version" };
  }
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { versions: true },
  });
  if (!file) return { ok: false, error: "Not found" };
  const target = file.versions.find((v) => v.version === version);
  if (!target) return { ok: false, error: "Version not found" };

  if (file.versions.length <= 1) {
    const r = await deleteFileFromS3AndDb(env, fileId);
    if (!r.ok) return r;
    return { ok: true, bytesFreed: r.bytesFreed, removedWholeFile: true };
  }

  const del = await deleteObject(env, target.s3Key);
  if (!del.ok && del.error !== "S3 not configured") {
    console.warn(`deleteObject failed for ${target.s3Key}:`, del.error);
  }
  await prisma.fileVersion.delete({
    where: { fileId_version: { fileId, version } },
  });
  return { ok: true, bytesFreed: target.sizeBytes, removedWholeFile: false };
}

export async function deleteFolderTreeFromDbAndS3(
  env: Env,
  folderId: string,
): Promise<{ ok: true; bytesFreed: bigint } | { ok: false; error: string }> {
  const children = await prisma.folder.findMany({ where: { parentId: folderId } });
  let total = 0n;
  for (const ch of children) {
    const r = await deleteFolderTreeFromDbAndS3(env, ch.id);
    if (!r.ok) return r;
    total += r.bytesFreed;
  }
  const files = await prisma.file.findMany({
    where: { folderId },
    include: { versions: true },
  });
  for (const f of files) {
    const r = await deleteFileFromS3AndDb(env, f.id);
    if (!r.ok) return r;
    total += r.bytesFreed;
  }
  await prisma.folder.delete({ where: { id: folderId } });
  return { ok: true, bytesFreed: total };
}

/**
 * Removes all S3 objects tied to the project, then deletes the `Project` row (DB cascades).
 * Workspace `storageUsedBytes` is decremented by the returned `bytesFreed` (capped to current usage).
 */
export async function deleteProjectAndAssets(
  env: Env,
  projectId: string,
): Promise<
  | { ok: true; workspaceId: string; projectName: string; bytesFreed: bigint }
  | { ok: false; error: string }
> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, workspaceId: true },
  });
  if (!project) return { ok: false, error: "Not found" };

  const keys = new Set<string>();
  let bytes = 0n;

  const versions = await prisma.fileVersion.findMany({
    where: { file: { projectId } },
    select: { s3Key: true, sizeBytes: true },
  });
  for (const v of versions) {
    keys.add(v.s3Key);
    bytes += v.sizeBytes;
  }

  const rfiAtt = await prisma.rfiAttachment.findMany({
    where: { rfi: { projectId } },
    select: { s3Key: true, sizeBytes: true },
  });
  for (const r of rfiAtt) {
    keys.add(r.s3Key);
    bytes += r.sizeBytes;
  }

  const assetDocs = await prisma.assetDocument.findMany({
    where: { asset: { projectId } },
    select: { s3Key: true, sizeBytes: true },
  });
  for (const d of assetDocs) {
    keys.add(d.s3Key);
    bytes += d.sizeBytes;
  }

  const proposals = await prisma.proposal.findMany({
    where: { projectId },
    select: { pdfS3Key: true },
  });
  for (const p of proposals) {
    if (p.pdfS3Key?.trim()) keys.add(p.pdfS3Key.trim());
  }

  const issues = await prisma.issue.findMany({
    where: { projectId },
    select: { referencePhotos: true },
  });
  for (const row of issues) {
    const { keys: k, bytes: b } = storageBytesAndKeysFromPhotoJsonArray(row.referencePhotos);
    for (const x of k) keys.add(x);
    bytes += b;
  }

  const punches = await prisma.punchItem.findMany({
    where: { projectId },
    select: { referencePhotos: true },
  });
  for (const row of punches) {
    const { keys: k, bytes: b } = storageBytesAndKeysFromPhotoJsonArray(row.referencePhotos);
    for (const x of k) keys.add(x);
    bytes += b;
  }

  for (const key of keys) {
    const del = await deleteObject(env, key);
    if (!del.ok && del.error !== "S3 not configured") {
      console.warn(`[deleteProjectAndAssets] deleteObject failed for ${key}:`, del.error);
    }
  }

  await prisma.project.delete({ where: { id: projectId } });

  return {
    ok: true,
    workspaceId: project.workspaceId,
    projectName: project.name,
    bytesFreed: bytes,
  };
}
