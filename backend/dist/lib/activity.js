import { prisma } from "./prisma.js";
export async function logActivity(workspaceId, type, opts = {}) {
    await prisma.activityLog.create({
        data: {
            workspaceId,
            type,
            projectId: opts.projectId ?? null,
            actorUserId: opts.actorUserId ?? null,
            entityType: opts.entityType,
            entityId: opts.entityId,
            metadata: opts.metadata ?? undefined,
        },
    });
}
/** Same as logActivity but never throws (e.g. new enum values before `migrate deploy`). */
export async function logActivitySafe(workspaceId, type, opts = {}) {
    try {
        await logActivity(workspaceId, type, opts);
    }
    catch (e) {
        console.warn(`[activity] skipped type=${String(type)} (apply migrations if ActivityType is missing this value):`, e instanceof Error ? e.message : e);
    }
}
