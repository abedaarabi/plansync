import { randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";
/** Root folder uses ""; otherwise equals `folderId` (matches `@@unique([projectId, name, folderKey])`). */
export function folderKeyFromFolderId(folderId) {
    return folderId ?? "";
}
export function buildUploadObjectKey(workspaceId, projectId, fileId, uploadId) {
    return `ws/${workspaceId}/p/${projectId}/${fileId}/${uploadId}/blob.pdf`;
}
export function s3KeyMatchesFileUpload(s3Key, workspaceId, projectId, fileId) {
    const prefix = `ws/${workspaceId}/p/${projectId}/${fileId}/`;
    return s3Key.startsWith(prefix) && s3Key.endsWith("/blob.pdf");
}
export async function upsertFileForUpload(params) {
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
export function newUploadId() {
    return randomUUID();
}
const SAFE_NAME_RE = /[^a-zA-Z0-9._-]/g;
export function sanitizeAttachmentFileName(name) {
    const t = name.trim().replace(SAFE_NAME_RE, "_");
    return t.length > 0 ? t.slice(0, 200) : "file";
}
export function buildRfiAttachmentKey(workspaceId, projectId, rfiId, uploadId, fileName) {
    const safe = sanitizeAttachmentFileName(fileName);
    return `ws/${workspaceId}/p/${projectId}/rfi/${rfiId}/${uploadId}/${safe}`;
}
export function s3KeyMatchesRfiAttachment(s3Key, workspaceId, projectId, rfiId) {
    const prefix = `ws/${workspaceId}/p/${projectId}/rfi/${rfiId}/`;
    return s3Key.startsWith(prefix);
}
