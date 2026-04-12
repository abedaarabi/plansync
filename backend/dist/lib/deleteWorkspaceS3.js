import { prisma } from "./prisma.js";
import { deleteObject } from "./s3.js";
/**
 * Best-effort removal of all S3 objects for a workspace before `prisma.workspace.delete`.
 * DB rows that reference these keys are removed by cascade when the workspace is deleted.
 */
export async function deleteAllWorkspaceS3Objects(env, workspaceId) {
    const keys = new Set();
    const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { logoS3Key: true },
    });
    if (ws?.logoS3Key)
        keys.add(ws.logoS3Key);
    const projects = await prisma.project.findMany({
        where: { workspaceId },
        select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);
    if (projectIds.length > 0) {
        const fileVersions = await prisma.fileVersion.findMany({
            where: { file: { projectId: { in: projectIds } } },
            select: { s3Key: true },
        });
        for (const row of fileVersions)
            keys.add(row.s3Key);
        const assetDocs = await prisma.assetDocument.findMany({
            where: { asset: { projectId: { in: projectIds } } },
            select: { s3Key: true },
        });
        for (const row of assetDocs)
            keys.add(row.s3Key);
        const rfiAttachments = await prisma.rfiAttachment.findMany({
            where: { rfi: { projectId: { in: projectIds } } },
            select: { s3Key: true },
        });
        for (const row of rfiAttachments)
            keys.add(row.s3Key);
    }
    const proposalPdfs = await prisma.proposal.findMany({
        where: { workspaceId },
        select: { pdfS3Key: true },
    });
    for (const row of proposalPdfs) {
        if (row.pdfS3Key)
            keys.add(row.pdfS3Key);
    }
    for (const key of keys) {
        const del = await deleteObject(env, key);
        if (!del.ok && del.error !== "S3 not configured") {
            console.warn(`[deleteWorkspaceS3] deleteObject failed for ${key}:`, del.error);
        }
    }
}
