import { createHmac } from "node:crypto";
import { prisma } from "./prisma.js";
export async function logActivity(workspaceId, type, opts = {}) {
    const row = await prisma.activityLog.create({
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
    if (opts.projectId) {
        void dispatchProjectWebhooks({
            id: row.id,
            workspaceId,
            projectId: opts.projectId,
            type,
            actorUserId: opts.actorUserId ?? null,
            entityType: opts.entityType ?? null,
            entityId: opts.entityId ?? null,
            metadata: opts.metadata ?? null,
            createdAt: row.createdAt.toISOString(),
        });
    }
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
async function dispatchProjectWebhooks(payload) {
    const hooks = await prisma.projectWebhook.findMany({
        where: {
            projectId: payload.projectId,
            isActive: true,
            OR: [{ events: { isEmpty: true } }, { events: { has: payload.type } }],
        },
        select: { id: true, url: true, secret: true },
    });
    if (hooks.length === 0)
        return;
    const body = JSON.stringify({
        eventId: payload.id,
        type: payload.type,
        createdAt: payload.createdAt,
        workspaceId: payload.workspaceId,
        projectId: payload.projectId,
        actorUserId: payload.actorUserId,
        entityType: payload.entityType,
        entityId: payload.entityId,
        metadata: payload.metadata,
    });
    await Promise.all(hooks.map(async (hook) => {
        const sig = createHmac("sha256", hook.secret).update(body).digest("hex");
        try {
            const res = await fetch(hook.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-PlanSync-Signature": `sha256=${sig}`,
                    "X-PlanSync-Event": String(payload.type),
                    "X-PlanSync-Event-Id": payload.id,
                },
                body,
            });
            if (!res.ok) {
                await prisma.projectWebhook.update({
                    where: { id: hook.id },
                    data: {
                        lastErrorAt: new Date(),
                        lastErrorMessage: `HTTP ${res.status}`,
                    },
                });
                return;
            }
            await prisma.projectWebhook.update({
                where: { id: hook.id },
                data: {
                    lastSuccessAt: new Date(),
                    lastErrorAt: null,
                    lastErrorMessage: null,
                },
            });
        }
        catch (e) {
            await prisma.projectWebhook.update({
                where: { id: hook.id },
                data: {
                    lastErrorAt: new Date(),
                    lastErrorMessage: e instanceof Error ? e.message.slice(0, 400) : "Webhook request failed",
                },
            });
        }
    }));
}
