import { randomBytes } from "node:crypto";
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
const linkTypeSchema = z.enum(["e2s", "s2s", "e2e", "s2e"]);
const linkInSchema = z.object({
    id: z.string().min(1).max(80),
    sourceId: z.string().min(1).max(80),
    targetId: z.string().min(1).max(80),
    type: linkTypeSchema.default("e2s"),
    lagDays: z.number().int().min(-3650).max(3650).default(0),
});
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
function newTemplateTaskId(seed) {
    return `sched_${seed}_${randomBytes(4).toString("hex")}`;
}
function newTemplateLinkId(seed) {
    return `schedlink_${seed}_${randomBytes(4).toString("hex")}`;
}
function buildDatacenterCommissioningLinks(tasks) {
    const bySuffix = new Map();
    for (const t of tasks) {
        const m = /^sched_(dc_[a-z]+)_/.exec(t.id);
        if (m)
            bySuffix.set(m[1], t.id);
    }
    const chain = [
        ["dc_design", "dc_readiness"],
        ["dc_readiness", "dc_ist"],
        ["dc_ist", "dc_oat"],
        ["dc_oat", "dc_handover"],
    ];
    return chain.flatMap(([from, to]) => {
        const sourceId = bySuffix.get(from);
        const targetId = bySuffix.get(to);
        if (!sourceId || !targetId)
            return [];
        return [
            {
                id: newTemplateLinkId(`${from}_${to}`),
                sourceId,
                targetId,
                type: "e2s",
                lagDays: 0,
            },
        ];
    });
}
function buildDatacenterCommissioningTemplate(anchorDate, baseSortOrder) {
    const d0 = snapToUtcDate(anchorDate);
    const rootId = newTemplateTaskId("dc_root");
    const designFreezeId = newTemplateTaskId("dc_design");
    const readinessId = newTemplateTaskId("dc_readiness");
    const istId = newTemplateTaskId("dc_ist");
    const oatId = newTemplateTaskId("dc_oat");
    const handoverId = newTemplateTaskId("dc_handover");
    return [
        {
            id: rootId,
            title: "Datacenter commissioning",
            parentId: null,
            sortOrder: baseSortOrder,
            startDate: ymdFromDate(d0),
            endDate: ymdFromDate(addDays(d0, 35)),
            isMilestone: false,
            progressPercent: 0,
            status: "not_started",
            takeoffLineIds: [],
        },
        {
            id: designFreezeId,
            title: "Design and MOP freeze",
            parentId: rootId,
            sortOrder: baseSortOrder + 1,
            startDate: ymdFromDate(d0),
            endDate: ymdFromDate(addDays(d0, 4)),
            isMilestone: false,
            progressPercent: 0,
            status: "not_started",
            takeoffLineIds: [],
        },
        {
            id: readinessId,
            title: "Power and cooling readiness validation",
            parentId: rootId,
            sortOrder: baseSortOrder + 2,
            startDate: ymdFromDate(addDays(d0, 5)),
            endDate: ymdFromDate(addDays(d0, 13)),
            isMilestone: false,
            progressPercent: 0,
            status: "not_started",
            takeoffLineIds: [],
        },
        {
            id: istId,
            title: "Integrated systems testing (IST)",
            parentId: rootId,
            sortOrder: baseSortOrder + 3,
            startDate: ymdFromDate(addDays(d0, 14)),
            endDate: ymdFromDate(addDays(d0, 22)),
            isMilestone: false,
            progressPercent: 0,
            status: "not_started",
            takeoffLineIds: [],
        },
        {
            id: oatId,
            title: "Operational acceptance and failover drill",
            parentId: rootId,
            sortOrder: baseSortOrder + 4,
            startDate: ymdFromDate(addDays(d0, 23)),
            endDate: ymdFromDate(addDays(d0, 31)),
            isMilestone: false,
            progressPercent: 0,
            status: "not_started",
            takeoffLineIds: [],
        },
        {
            id: handoverId,
            title: "Commissioning sign-off and handover",
            parentId: rootId,
            sortOrder: baseSortOrder + 5,
            startDate: ymdFromDate(addDays(d0, 35)),
            endDate: ymdFromDate(addDays(d0, 35)),
            isMilestone: true,
            progressPercent: 0,
            status: "not_started",
            takeoffLineIds: [],
        },
    ];
}
function snapToUtcDate(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
}
function addDays(base, days) {
    const x = new Date(base);
    x.setUTCDate(x.getUTCDate() + days);
    return x;
}
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
function validateLinks(tasks, links) {
    const ids = new Set(tasks.map((t) => t.id));
    const linkIds = new Set();
    for (const link of links) {
        if (link.sourceId === link.targetId) {
            return { error: "A task cannot depend on itself" };
        }
        if (!ids.has(link.sourceId) || !ids.has(link.targetId)) {
            return { error: "Dependency endpoints must reference tasks in the same save" };
        }
        if (linkIds.has(link.id)) {
            return { error: "Duplicate dependency ids in request" };
        }
        linkIds.add(link.id);
    }
    const pairKeys = new Set();
    for (const link of links) {
        const key = `${link.sourceId}->${link.targetId}`;
        if (pairKeys.has(key)) {
            return { error: "Duplicate dependency between the same tasks" };
        }
        pairKeys.add(key);
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
function linkJson(row) {
    return {
        id: row.id,
        sourceId: row.sourceId,
        targetId: row.targetId,
        type: row.type,
        lagDays: row.lagDays,
    };
}
async function loadSchedulePayload(projectId) {
    const [rows, links] = await Promise.all([
        prisma.scheduleTask.findMany({
            where: { projectId },
            include: { takeoffLinks: { select: { takeoffLineId: true } } },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        }),
        prisma.scheduleTaskLink.findMany({
            where: { projectId },
            orderBy: [{ id: "asc" }],
        }),
    ]);
    return {
        tasks: rows.map(rowJson),
        links: links.map(linkJson),
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
            return c.json({ tasks: [], links: [] });
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        return c.json(await loadSchedulePayload(projectId));
    });
    r.post("/projects/:projectId/schedule/templates/datacenter-commissioning", needUser, async (c) => {
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
        const body = z
            .object({
            mode: z.enum(["replace", "append"]).default("append"),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        let baseSortOrder = 0;
        if (body.data.mode === "append") {
            const tail = await prisma.scheduleTask.findFirst({
                where: { projectId },
                orderBy: [{ sortOrder: "desc" }, { id: "desc" }],
                select: { sortOrder: true },
            });
            baseSortOrder = (tail?.sortOrder ?? -1) + 1;
        }
        const tasks = buildDatacenterCommissioningTemplate(new Date(), baseSortOrder);
        const links = buildDatacenterCommissioningLinks(tasks);
        return c.json({ mode: body.data.mode, tasks, links });
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
            .object({
            tasks: z.array(taskInSchema).max(5000),
            links: z.array(linkInSchema).max(10000).default([]),
        })
            .safeParse(await c.req.json());
        if (!parsed.success)
            return c.json({ error: parsed.error.flatten() }, 400);
        const tasks = parsed.data.tasks;
        const links = parsed.data.links;
        const idList = tasks.map((t) => t.id);
        if (new Set(idList).size !== idList.length) {
            return c.json({ error: "Duplicate task ids in request" }, 400);
        }
        const forest = validateForest(tasks);
        if ("error" in forest)
            return c.json({ error: forest.error }, 400);
        const linkForest = validateLinks(tasks, links);
        if ("error" in linkForest)
            return c.json({ error: linkForest.error }, 400);
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
        const incomingLinkIds = links.map((l) => l.id);
        const ordered = orderForUpsert(tasks);
        const foreignIds = await prisma.scheduleTask.findMany({
            where: { id: { in: incomingIds }, NOT: { projectId } },
            select: { id: true },
        });
        if (foreignIds.length > 0) {
            return c.json({ error: "One or more task ids belong to another project" }, 400);
        }
        await prisma.$transaction(async (tx) => {
            await tx.scheduleTaskLink.deleteMany({
                where: { projectId, id: { notIn: incomingLinkIds } },
            });
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
            for (const link of links) {
                await tx.scheduleTaskLink.upsert({
                    where: { id: link.id },
                    create: {
                        id: link.id,
                        projectId,
                        sourceId: link.sourceId,
                        targetId: link.targetId,
                        type: link.type,
                        lagDays: link.lagDays,
                    },
                    update: {
                        sourceId: link.sourceId,
                        targetId: link.targetId,
                        type: link.type,
                        lagDays: link.lagDays,
                    },
                });
            }
        });
        return c.json(await loadSchedulePayload(projectId));
    });
}
