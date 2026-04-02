import { randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";

/** Root folder uses ""; otherwise equals `folderId` (matches `@@unique([projectId, name, folderKey])`). */
export function folderKeyFromFolderId(folderId: string | undefined | null): string {
  return folderId ?? "";
}

export function buildUploadObjectKey(
  workspaceId: string,
  projectId: string,
  fileId: string,
  uploadId: string,
): string {
  return `ws/${workspaceId}/p/${projectId}/${fileId}/${uploadId}/blob.pdf`;
}

export function s3KeyMatchesFileUpload(
  s3Key: string,
  workspaceId: string,
  projectId: string,
  fileId: string,
): boolean {
  const prefix = `ws/${workspaceId}/p/${projectId}/${fileId}/`;
  return s3Key.startsWith(prefix) && s3Key.endsWith("/blob.pdf");
}

export async function upsertFileForUpload(params: {
  projectId: string;
  folderId: string | undefined;
  name: string;
}) {
  const folderKey = folderKeyFromFolderId(params.folderId);
  return prisma.file.upsert({
    where: {
      projectId_name_folderKey: {
        projectId: params.projectId,
        name: params.name,
        folderKey,
      },
    },
    create: {
      projectId: params.projectId,
      folderId: params.folderId ?? null,
      folderKey,
      name: params.name,
    },
    update: { updatedAt: new Date() },
  });
}

export function newUploadId(): string {
  return randomUUID();
}
