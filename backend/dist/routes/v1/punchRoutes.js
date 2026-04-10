import { PunchPriority, PunchStatus, ActivityType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectForMember, assertUserAssignableToProject } from "../../lib/projectAccess.js";
import { logActivity, logActivitySafe } from "../../lib/activity.js";
function requirePro(workspace) {
    if (!isWorkspacePro(workspace)) {
        return { error: "Pro subscription required", status: 402 };
    }
    return null;
}
function dateFromYmd(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
}
const punchInclude = {
    assignee: { select: { id: true, name: true, email: true, image: true } },
};
function punchJson(row) {
    return {
        ...row,
        dueDate: row.dueDate ? row.dueDate.toISOString() : null,
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
export function registerPunchRoutes(r, needUser) {
    r.get("/projects/:projectId/punch", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const list = await prisma.punchItem.findMany({
            where: { projectId },
            include: punchInclude,
            orderBy: { updatedAt: "desc" },
        });
        return c.json(list.map(punchJson));
    });
    r.post("/projects/:projectId/punch", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            title: z.string().min(1).max(200).optional(),
            location: z.string().min(1).max(500),
            trade: z.string().min(1).max(120),
            priority: z.nativeEnum(PunchPriority).optional(),
            status: z.nativeEnum(PunchStatus).optional(),
            assigneeId: z.string().min(1).nullable().optional(),
            dueDateYmd: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .nullable()
                .optional(),
            notes: z.string().max(5000).optional(),
            templateId: z.string().min(1).nullable().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const assigneeId = body.data.assigneeId === undefined
            ? undefined
            : body.data.assigneeId === null
                ? null
                : body.data.assigneeId;
        if (assigneeId) {
            const check = await assertUserAssignableToProject(assigneeId, projectId, res.project.workspaceId);
            if ("error" in check)
                return c.json({ error: check.error }, check.status);
        }
        const row = await prisma.punchItem.create({
            data: {
                projectId,
                title: body.data.title?.trim() || "Punch item",
                location: body.data.location,
                trade: body.data.trade,
                priority: body.data.priority ?? PunchPriority.P2,
                status: body.data.status ?? PunchStatus.OPEN,
                notes: body.data.notes,
                assigneeId,
                dueDate: body.data.dueDateYmd ? dateFromYmd(body.data.dueDateYmd) : null,
                templateId: body.data.templateId === undefined
                    ? undefined
                    : body.data.templateId === null
                        ? null
                        : body.data.templateId,
            },
            include: punchInclude,
        });
        await logActivity(res.project.workspaceId, ActivityType.PUNCH_CREATED, {
            actorUserId: c.get("user").id,
            entityId: row.id,
            projectId,
            metadata: { location: row.location, trade: row.trade },
        });
        return c.json(punchJson(row));
    });
    r.patch("/projects/:projectId/punch/:punchId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const punchId = c.req.param("punchId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.punchItem.findFirst({ where: { id: punchId, projectId } });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            title: z.string().min(1).max(200).optional(),
            location: z.string().min(1).max(500).optional(),
            trade: z.string().min(1).max(120).optional(),
            priority: z.nativeEnum(PunchPriority).optional(),
            status: z.nativeEnum(PunchStatus).optional(),
            assigneeId: z.string().min(1).nullable().optional(),
            dueDateYmd: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .nullable()
                .optional(),
            notes: z.string().max(5000).nullable().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        if (body.data.assigneeId) {
            const check = await assertUserAssignableToProject(body.data.assigneeId, projectId, res.project.workspaceId);
            if ("error" in check)
                return c.json({ error: check.error }, check.status);
        }
        const nextStatus = body.data.status;
        const row = await prisma.punchItem.update({
            where: { id: punchId },
            data: {
                ...body.data,
                dueDate: body.data.dueDateYmd === undefined
                    ? undefined
                    : body.data.dueDateYmd === null
                        ? null
                        : dateFromYmd(body.data.dueDateYmd),
                completedAt: nextStatus === undefined
                    ? undefined
                    : nextStatus === PunchStatus.CLOSED
                        ? new Date()
                        : null,
            },
            include: punchInclude,
        });
        await logActivity(res.project.workspaceId, ActivityType.PUNCH_UPDATED, {
            actorUserId: c.get("user").id,
            entityId: row.id,
            projectId,
            metadata: { location: row.location, trade: row.trade, status: row.status },
        });
        return c.json(punchJson(row));
    });
    r.post("/projects/:projectId/punch/bulk", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            ids: z.array(z.string().min(1)).min(1).max(500),
            assigneeId: z.string().min(1).nullable().optional(),
            status: z.nativeEnum(PunchStatus).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        if (body.data.assigneeId) {
            const check = await assertUserAssignableToProject(body.data.assigneeId, projectId, res.project.workspaceId);
            if ("error" in check)
                return c.json({ error: check.error }, check.status);
        }
        const update = {};
        if (body.data.assigneeId !== undefined)
            update.assigneeId = body.data.assigneeId;
        if (body.data.status) {
            update.status = body.data.status;
            update.completedAt = body.data.status === PunchStatus.CLOSED ? new Date() : null;
        }
        await prisma.punchItem.updateMany({
            where: { projectId, id: { in: body.data.ids } },
            data: update,
        });
        await logActivitySafe(res.project.workspaceId, ActivityType.PUNCH_UPDATED, {
            actorUserId: c.get("user").id,
            projectId,
            metadata: { bulk: true, count: body.data.ids.length, status: body.data.status ?? null },
        });
        return c.json({ ok: true });
    });
    r.delete("/projects/:projectId/punch/:punchId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const punchId = c.req.param("punchId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.punchItem.findFirst({ where: { id: punchId, projectId } });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        await logActivitySafe(res.project.workspaceId, ActivityType.PUNCH_DELETED, {
            actorUserId: c.get("user").id,
            entityId: existing.id,
            projectId,
            metadata: { location: existing.location, trade: existing.trade },
        });
        await prisma.punchItem.delete({ where: { id: punchId } });
        return c.json({ ok: true });
    });
    r.get("/projects/:projectId/punch/export.csv", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.punchItem.findMany({
            where: { projectId },
            include: punchInclude,
            orderBy: { updatedAt: "desc" },
        });
        const escape = (v) => `"${v.replaceAll(`"`, `""`)}"`;
        const csv = [
            "id,title,location,trade,priority,status,assignee,dueDate,notes,updatedAt",
            ...rows.map((row) => [
                row.id,
                row.title,
                row.location,
                row.trade,
                row.priority,
                row.status,
                row.assignee?.name ?? "",
                row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "",
                row.notes ?? "",
                row.updatedAt.toISOString(),
            ]
                .map((v) => escape(String(v)))
                .join(",")),
        ].join("\n");
        c.header("Content-Type", "text/csv; charset=utf-8");
        c.header("Content-Disposition", `attachment; filename="punch-${projectId}.csv"`);
        return c.body(csv);
    });
    r.get("/projects/:projectId/punch/templates", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const rows = await prisma.punchTemplate.findMany({
            where: {
                workspaceId: res.project.workspaceId,
                isArchived: false,
                OR: [{ projectId }, { projectId: null }],
            },
            orderBy: [{ projectId: "desc" }, { updatedAt: "desc" }],
        });
        return c.json(rows.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        })));
    });
    r.post("/projects/:projectId/punch/templates", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            name: z.string().min(1).max(180),
            description: z.string().max(1000).optional(),
            scope: z.enum(["WORKSPACE", "PROJECT"]).default("PROJECT"),
            items: z
                .array(z.object({
                title: z.string().min(1).max(200),
                location: z.string().min(1).max(500),
                trade: z.string().min(1).max(120),
                priority: z.nativeEnum(PunchPriority).optional(),
                notes: z.string().max(5000).optional(),
            }))
                .min(1)
                .max(500),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const row = await prisma.punchTemplate.create({
            data: {
                workspaceId: res.project.workspaceId,
                projectId: body.data.scope === "PROJECT" ? projectId : null,
                name: body.data.name,
                description: body.data.description,
                createdById: c.get("user").id,
                itemsJson: body.data.items,
            },
        });
        return c.json({
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        });
    });
    r.post("/projects/:projectId/punch/templates/:templateId/apply", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const templateId = c.req.param("templateId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const template = await prisma.punchTemplate.findFirst({
            where: {
                id: templateId,
                workspaceId: res.project.workspaceId,
                OR: [{ projectId }, { projectId: null }],
            },
        });
        if (!template)
            return c.json({ error: "Template not found" }, 404);
        const itemsRaw = Array.isArray(template.itemsJson) ? template.itemsJson : [];
        const items = itemsRaw;
        if (items.length === 0)
            return c.json({ error: "Template has no items" }, 400);
        await prisma.punchItem.createMany({
            data: items.map((it) => ({
                projectId,
                templateId: template.id,
                title: it.title?.trim() || "Punch item",
                location: it.location?.trim() || "TBD",
                trade: it.trade?.trim() || "General",
                priority: it.priority ?? PunchPriority.P2,
                status: PunchStatus.OPEN,
                notes: it.notes?.trim() || null,
            })),
        });
        await logActivitySafe(res.project.workspaceId, ActivityType.PUNCH_CREATED, {
            actorUserId: c.get("user").id,
            projectId,
            metadata: { templateId: template.id, templateName: template.name, count: items.length },
        });
        return c.json({ ok: true, created: items.length });
    });
}
