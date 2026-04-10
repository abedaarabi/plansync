import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectWithAuth } from "../../lib/permissions.js";
function requirePro(workspace) {
    if (!isWorkspacePro(workspace)) {
        return { error: "Pro subscription required", status: 402 };
    }
    return null;
}
/** Parse `YYYY-MM-DD`; noon UTC avoids TZ edge shifts. */
function dateFromYmd(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
}
function ymdFromDate(d) {
    const x = new Date(d);
    const y = x.getUTCFullYear();
    const m = String(x.getUTCMonth() + 1).padStart(2, "0");
    const day = String(x.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
const taskInSchema = z.object({
    id: z.string().min(1).max(80),
    title: z.string().min(1).max(500),
    parentId: z.string().nullable(),
    sortOrder: z.number().int(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isMilestone: z.boolean().optional(),
    progressPercent: z.number().int().min(0).max(100).optional(),
    status: z.enum(["not_started", "in_progress", "delayed", "completed"]).optional(),
    takeoffLineIds: z.array(z.string().min(1).max(80)).max(200).optional(),
});
function normalizeStatus(status) {
    if (status === "in_progress")
        return "in_progress";
    if (status === "delayed")
        return "delayed";
    if (status === "completed")
        return "completed";
    return "not_started";
}
function validateForest(tasks) {
    const ids = new Set(tasks.map((t) => t.id));
    const byId = new Map(tasks.map((t) => [t.id, t]));
    for (const t of tasks) {
        if (t.parentId && !ids.has(t.parentId)) {
            return { error: "parentId must reference another task in the same save" };
        }
        const s = dateFromYmd(t.startDate).getTime();
        const e = dateFromYmd(t.endDate).getTime();
        if (e < s)
            return { error: "endDate must be on or after startDate" };
    }
    for (const start of tasks) {
        const seen = new Set();
        let cur = start.id;
        for (let i = 0; i <= tasks.length; i++) {
            if (seen.has(cur))
                return { error: "Schedule parent links form a cycle" };
            seen.add(cur);
            const node = byId.get(cur);
            if (!node?.parentId || !ids.has(node.parentId))
                break;
            cur = node.parentId;
        }
    }
    return { ok: true };
}
/** Parents before children for FK inserts. */
function orderForUpsert(tasks) {
    const ids = new Set(tasks.map((t) => t.id));
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const visiting = new Set();
    const visited = new Set();
    const out = [];
    function visit(id) {
        if (visited.has(id))
            return;
        const t = byId.get(id);
        if (!t)
            return;
        if (visiting.has(id))
            return;
        visiting.add(id);
        if (t.parentId && ids.has(t.parentId))
            visit(t.parentId);
        visiting.delete(id);
        visited.add(id);
        out.push(t);
    }
    for (const t of tasks)
        visit(t.id);
    return out;
}
function rowJson(row) {
    return {
        id: row.id,
        title: row.title,
        parentId: row.parentId,
        sortOrder: row.sortOrder,
        startDate: ymdFromDate(row.startDate),
        endDate: ymdFromDate(row.endDate),
        isMilestone: row.isMilestone,
        progressPercent: row.progressPercent,
        status: normalizeStatus(row.status),
        takeoffLineIds: (row.takeoffLinks ?? []).map((l) => l.takeoffLineId),
        updatedAt: row.updatedAt.toISOString(),
    };
}
export function registerScheduleRoutes(r, needUser) {
    r.get("/projects/:projectId/schedule", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const userId = c.get("user").id;
        const auth = await loadProjectWithAuth(projectId, userId);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.uiMode !== "internal") {
            return c.json({ error: "Forbidden" }, 403);
        }
        if (!ctx.settings.modules.schedule) {
            return c.json([]);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.scheduleTask.findMany({
            where: { projectId },
            include: { takeoffLinks: { select: { takeoffLineId: true } } },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        return c.json(rows.map(rowJson));
    });
    r.put("/projects/:projectId/schedule", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const userId = c.get("user").id;
        const auth = await loadProjectWithAuth(projectId, userId);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.uiMode !== "internal") {
            return c.json({ error: "Forbidden" }, 403);
        }
        if (!ctx.settings.modules.schedule) {
            return c.json({ error: "Schedule module is disabled for this project" }, 400);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const parsed = z
            .object({ tasks: z.array(taskInSchema).max(5000) })
            .safeParse(await c.req.json());
        if (!parsed.success)
            return c.json({ error: parsed.error.flatten() }, 400);
        const tasks = parsed.data.tasks;
        const idList = tasks.map((t) => t.id);
        if (new Set(idList).size !== idList.length) {
            return c.json({ error: "Duplicate task ids in request" }, 400);
        }
        const forest = validateForest(tasks);
        if ("error" in forest)
            return c.json({ error: forest.error }, 400);
        const allTakeoffIds = [...new Set(tasks.flatMap((t) => [...new Set(t.takeoffLineIds ?? [])]))];
        if (allTakeoffIds.length > 0) {
            const found = await prisma.takeoffLine.findMany({
                where: { projectId, id: { in: allTakeoffIds } },
                select: { id: true },
            });
            if (found.length !== allTakeoffIds.length) {
                return c.json({ error: "One or more takeoff lines are missing or belong to another project" }, 400);
            }
        }
        const incomingIds = tasks.map((t) => t.id);
        const ordered = orderForUpsert(tasks);
        const foreignIds = await prisma.scheduleTask.findMany({
            where: { id: { in: incomingIds }, NOT: { projectId } },
            select: { id: true },
        });
        if (foreignIds.length > 0) {
            return c.json({ error: "One or more task ids belong to another project" }, 400);
        }
        await prisma.$transaction(async (tx) => {
            await tx.scheduleTask.deleteMany({
                where: { projectId, id: { notIn: incomingIds } },
            });
            for (const t of ordered) {
                const startDate = dateFromYmd(t.startDate);
                const endDate = dateFromYmd(t.endDate);
                await tx.scheduleTask.upsert({
                    where: { id: t.id },
                    create: {
                        id: t.id,
                        projectId,
                        title: t.title,
                        parentId: t.parentId,
                        sortOrder: t.sortOrder,
                        startDate,
                        endDate,
                        isMilestone: t.isMilestone ?? false,
                        progressPercent: t.progressPercent ?? 0,
                        status: t.status ?? "not_started",
                    },
                    update: {
                        title: t.title,
                        parentId: t.parentId,
                        sortOrder: t.sortOrder,
                        startDate,
                        endDate,
                        isMilestone: t.isMilestone ?? false,
                        progressPercent: t.progressPercent ?? 0,
                        status: t.status ?? "not_started",
                    },
                });
                const linkIds = [...new Set(t.takeoffLineIds ?? [])];
                await tx.scheduleTaskTakeoffLine.deleteMany({ where: { scheduleTaskId: t.id } });
                if (linkIds.length > 0) {
                    await tx.scheduleTaskTakeoffLine.createMany({
                        data: linkIds.map((takeoffLineId) => ({
                            scheduleTaskId: t.id,
                            takeoffLineId,
                        })),
                    });
                }
            }
        });
        const rows = await prisma.scheduleTask.findMany({
            where: { projectId },
            include: { takeoffLinks: { select: { takeoffLineId: true } } },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        return c.json(rows.map(rowJson));
    });
}
