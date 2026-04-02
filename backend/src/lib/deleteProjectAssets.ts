import type { Env } from "./env.js";
import { prisma } from "./prisma.js";
import { deleteObject } from "./s3.js";

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
