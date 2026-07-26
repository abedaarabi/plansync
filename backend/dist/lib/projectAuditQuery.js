import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
/**
 * Activity rows for a project:
 * - Rows with `projectId` set (preferred).
 * - Legacy rows with `projectId` null but entity/metadata still tied to this project
 *   (files, folders, issues, RFIs, punch, field reports, etc.).
 */
function projectAuditScopeSql(workspaceId, projectId) {
    return Prisma.sql `
    a."workspaceId" = ${workspaceId}
    AND (
      a."projectId" = ${projectId}
      OR (
        a."projectId" IS NULL
        AND (
          (
            a.type::text IN ('FILE_VERSION_ADDED', 'FILE_OPENED')
            AND (a.metadata->>'fileId') IN (
              SELECT f.id FROM "File" f WHERE f."projectId" = ${projectId}
            )
          )
          OR (
            a.type::text IN ('FOLDER_CREATED', 'FOLDER_DELETED', 'FOLDER_MOVED')
            AND a."entityId" IN (SELECT id FROM "Folder" WHERE "projectId" = ${projectId})
          )
          OR (a.type::text = 'PROJECT_CREATED' AND a."entityId" = ${projectId})
          OR (
            a.type::text = 'FILE_MOVED'
            AND a."entityId" IN (SELECT id FROM "File" WHERE "projectId" = ${projectId})
          )
          OR (
            a.type::text IN ('ISSUE_CREATED', 'ISSUE_UPDATED')
            AND a."entityId" IN (SELECT id FROM "Issue" WHERE "projectId" = ${projectId})
          )
          OR (a.type::text = 'ISSUE_DELETED' AND a."projectId" = ${projectId})
          OR (
            a.type::text IN (
              'RFI_CREATED',
              'RFI_UPDATED',
              'RFI_DELETED',
              'RFI_SENT_FOR_REVIEW',
              'RFI_RESPONSE_SUBMITTED',
              'RFI_CLOSED',
              'RFI_ATTACHMENT_ADDED',
              'RFI_ATTACHMENT_REMOVED',
              'RFI_MESSAGE_POSTED'
            )
            AND a."entityId" IN (SELECT id FROM "Rfi" WHERE "projectId" = ${projectId})
          )
          OR (
            a.type::text IN ('PUNCH_CREATED', 'PUNCH_UPDATED')
            AND a."entityId" IN (SELECT id FROM "PunchItem" WHERE "projectId" = ${projectId})
          )
          OR (
            a.type::text IN ('FIELD_REPORT_CREATED', 'FIELD_REPORT_UPDATED', 'FIELD_REPORT_EMAILED')
            AND a."entityId" IN (SELECT id FROM "FieldReport" WHERE "projectId" = ${projectId})
          )
          OR (a.type::text = 'PROJECT_UPDATED' AND a."entityId" = ${projectId})
        )
      )
    )
  `;
}
export async function countProjectAuditLogs(opts) {
    const { workspaceId, projectId } = opts;
    const rows = await prisma.$queryRaw `
    SELECT COUNT(*)::bigint AS count
    FROM "ActivityLog" a
    WHERE ${projectAuditScopeSql(workspaceId, projectId)}
  `;
    return Number(rows[0]?.count ?? 0);
}
export async function fetchProjectAuditLogs(opts) {
    const { workspaceId, projectId, limit, offset = 0 } = opts;
    const take = Math.min(5000, Math.max(1, limit));
    const skip = Math.max(0, offset);
    const rows = await prisma.$queryRaw `
    SELECT a.id
    FROM "ActivityLog" a
    WHERE ${projectAuditScopeSql(workspaceId, projectId)}
    ORDER BY a."createdAt" DESC
    LIMIT ${take}
    OFFSET ${skip}
  `;
    const ids = rows.map((r) => r.id);
    if (ids.length === 0)
        return [];
    const logs = await prisma.activityLog.findMany({
        where: { id: { in: ids } },
        include: {
            actor: { select: { id: true, name: true, email: true, image: true } },
        },
    });
    const order = new Map(ids.map((id, i) => [id, i]));
    logs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return logs;
}
export async function fetchProjectAuditActors(opts) {
    const { workspaceId, projectId } = opts;
    const [actors, noActorRows] = await Promise.all([
        prisma.$queryRaw `
      SELECT DISTINCT u.id, u.name, u.email
      FROM "ActivityLog" a
      INNER JOIN "User" u ON u.id = a."actorUserId"
      WHERE ${projectAuditScopeSql(workspaceId, projectId)}
      ORDER BY u.name ASC
    `,
        prisma.$queryRaw `
      SELECT EXISTS (
        SELECT 1
        FROM "ActivityLog" a
        WHERE ${projectAuditScopeSql(workspaceId, projectId)}
        AND a."actorUserId" IS NULL
      ) AS exists
    `,
    ]);
    return {
        actors,
        hasNoActor: Boolean(noActorRows[0]?.exists),
    };
}
