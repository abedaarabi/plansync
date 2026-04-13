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

const SAFE_NAME_RE = /[^a-zA-Z0-9._-]/g;

export function sanitizeAttachmentFileName(name: string): string {
  const t = name.trim().replace(SAFE_NAME_RE, "_");
  return t.length > 0 ? t.slice(0, 200) : "file";
}

export function buildRfiAttachmentKey(
  workspaceId: string,
  projectId: string,
  rfiId: string,
  uploadId: string,
  fileName: string,
): string {
  const safe = sanitizeAttachmentFileName(fileName);
  return `ws/${workspaceId}/p/${projectId}/rfi/${rfiId}/${uploadId}/${safe}`;
}

export function s3KeyMatchesRfiAttachment(
  s3Key: string,
  workspaceId: string,
  projectId: string,
  rfiId: string,
): boolean {
  const prefix = `ws/${workspaceId}/p/${projectId}/rfi/${rfiId}/`;
  return s3Key.startsWith(prefix);
}

export function buildAssetDocumentKey(
  workspaceId: string,
  projectId: string,
  assetId: string,
  uploadId: string,
  fileName: string,
): string {
  const safe = sanitizeAttachmentFileName(fileName);
  return `ws/${workspaceId}/p/${projectId}/asset/${assetId}/${uploadId}/${safe}`;
}

export function s3KeyMatchesAssetDocument(
  s3Key: string,
  workspaceId: string,
  projectId: string,
  assetId: string,
): boolean {
  const prefix = `ws/${workspaceId}/p/${projectId}/asset/${assetId}/`;
  return s3Key.startsWith(prefix);
}

/** Project-scoped issue reference images (not tied to issue id so carry-forward can reuse keys). */
export function buildIssueReferencePhotoKey(
  workspaceId: string,
  projectId: string,
  uploadId: string,
  fileName: string,
): string {
  const safe = sanitizeAttachmentFileName(fileName);
  return `ws/${workspaceId}/p/${projectId}/issue-photos/${uploadId}/${safe}`;
}

export function s3KeyMatchesIssueReferencePhoto(
  s3Key: string,
  workspaceId: string,
  projectId: string,
): boolean {
  const prefix = `ws/${workspaceId}/p/${projectId}/issue-photos/`;
  return s3Key.startsWith(prefix);
}
