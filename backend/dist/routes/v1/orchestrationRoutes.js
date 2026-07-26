import { z } from "zod";
import { OrchestrationApprovalStatus, OrchestrationRunStatus, } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { loadProjectWithAuth } from "../../lib/permissions.js";
function canManage(ctx) {
    if (ctx.workspaceMember.isExternal)
        return false;
    const role = ctx.workspaceMember.role;
    return role === "SUPER_ADMIN" || role === "ADMIN";
}
function canRead(ctx) {
    return !ctx.workspaceMember.isExternal;
}
export function registerOrchestrationRoutes(r, needUser) {
    r.get("/projects/:projectId/job-runs", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (!canRead(access.ctx))
            return c.json({ error: "Forbidden" }, 403);
        const rows = await prisma.jobRun.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        return c.json(rows.map((row) => ({
            id: row.id,
            kind: row.kind,
            status: row.status,
            correlationId: row.correlationId,
            startedAt: row.startedAt?.toISOString() ?? null,
            finishedAt: row.finishedAt?.toISOString() ?? null,
            payloadJson: row.payloadJson,
            resultJson: row.resultJson,
            errorJson: row.errorJson,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        })));
    });
    r.post("/projects/:projectId/job-runs", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (!canManage(access.ctx))
            return c.json({ error: "Admin or Super Admin only" }, 403);
        const body = z
            .object({
            kind: z.string().min(1).max(120),
            status: z.nativeEnum(OrchestrationRunStatus).optional(),
            correlationId: z.string().max(120).nullable().optional(),
            payloadJson: z.unknown().optional(),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const created = await prisma.jobRun.create({
            data: {
                workspaceId: access.ctx.project.workspaceId,
                projectId,
                kind: body.data.kind.trim(),
                status: body.data.status ?? "QUEUED",
                correlationId: body.data.correlationId?.trim() || null,
                payloadJson: (body.data.payloadJson ?? null),
                createdById: c.get("user").id,
            },
        });
        return c.json({
            id: created.id,
            kind: created.kind,
            status: created.status,
            correlationId: created.correlationId,
            startedAt: created.startedAt?.toISOString() ?? null,
            finishedAt: created.finishedAt?.toISOString() ?? null,
            payloadJson: created.payloadJson,
            resultJson: created.resultJson,
            errorJson: created.errorJson,
            createdAt: created.createdAt.toISOString(),
            updatedAt: created.updatedAt.toISOString(),
        });
    });
    r.patch("/projects/:projectId/job-runs/:runId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const runId = c.req.param("runId");
        const access = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (!canManage(access.ctx))
            return c.json({ error: "Admin or Super Admin only" }, 403);
        const body = z
            .object({
            status: z.nativeEnum(OrchestrationRunStatus).optional(),
            startedAt: z.string().datetime().nullable().optional(),
            finishedAt: z.string().datetime().nullable().optional(),
            resultJson: z.unknown().optional(),
            errorJson: z.unknown().optional(),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const row = await prisma.jobRun.findFirst({
            where: { id: runId, projectId },
            select: { id: true },
        });
        if (!row)
            return c.json({ error: "Run not found" }, 404);
        const updated = await prisma.jobRun.update({
            where: { id: runId },
            data: {
                ...(body.data.status !== undefined ? { status: body.data.status } : {}),
                ...(body.data.startedAt !== undefined
                    ? { startedAt: body.data.startedAt ? new Date(body.data.startedAt) : null }
                    : {}),
                ...(body.data.finishedAt !== undefined
                    ? { finishedAt: body.data.finishedAt ? new Date(body.data.finishedAt) : null }
                    : {}),
                ...(body.data.resultJson !== undefined
                    ? { resultJson: body.data.resultJson }
                    : {}),
                ...(body.data.errorJson !== undefined
                    ? { errorJson: body.data.errorJson }
                    : {}),
            },
        });
        return c.json({
            id: updated.id,
            kind: updated.kind,
            status: updated.status,
            correlationId: updated.correlationId,
            startedAt: updated.startedAt?.toISOString() ?? null,
            finishedAt: updated.finishedAt?.toISOString() ?? null,
            payloadJson: updated.payloadJson,
            resultJson: updated.resultJson,
            errorJson: updated.errorJson,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        });
    });
    r.get("/projects/:projectId/orchestration/environments", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (!canRead(access.ctx))
            return c.json({ error: "Forbidden" }, 403);
        const rows = await prisma.orchestrationEnvironment.findMany({
            where: { projectId },
            orderBy: [{ isProduction: "desc" }, { name: "asc" }],
        });
        return c.json(rows.map((row) => ({
            id: row.id,
            name: row.name,
            region: row.region,
            availabilityZone: row.availabilityZone,
            isProduction: row.isProduction,
        })));
    });
    r.post("/projects/:projectId/orchestration/environments", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (!canManage(access.ctx))
            return c.json({ error: "Admin or Super Admin only" }, 403);
        const body = z
            .object({
            name: z.string().min(1).max(120),
            region: z.string().min(1).max(80),
            availabilityZone: z.string().max(80).nullable().optional(),
            isProduction: z.boolean().optional(),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const created = await prisma.orchestrationEnvironment.create({
            data: {
                projectId,
                name: body.data.name.trim(),
                region: body.data.region.trim(),
                availabilityZone: body.data.availabilityZone?.trim() || null,
                isProduction: body.data.isProduction ?? false,
            },
        });
        return c.json(created);
    });
    r.get("/projects/:projectId/orchestration/workflows", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (!canRead(access.ctx))
            return c.json({ error: "Forbidden" }, 403);
        const rows = await prisma.orchestrationWorkflow.findMany({
            where: { projectId },
            include: { steps: { orderBy: { sortOrder: "asc" } }, environment: true },
            orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        });
        return c.json(rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            isActive: row.isActive,
            environment: row.environment
                ? {
                    id: row.environment.id,
                    name: row.environment.name,
                    region: row.environment.region,
                }
                : null,
            steps: row.steps.map((s) => ({
                id: s.id,
                name: s.name,
                stepType: s.stepType,
                sortOrder: s.sortOrder,
                timeoutSeconds: s.timeoutSeconds,
            })),
        })));
    });
    r.post("/projects/:projectId/orchestration/workflows", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (!canManage(access.ctx))
            return c.json({ error: "Admin or Super Admin only" }, 403);
        const body = z
            .object({
            name: z.string().min(1).max(180),
            description: z.string().max(1000).nullable().optional(),
            environmentId: z.string().nullable().optional(),
            steps: z
                .array(z.object({
                name: z.string().min(1).max(180),
                stepType: z.string().min(1).max(80),
                sortOrder: z.number().int().min(0).optional(),
                timeoutSeconds: z.number().int().min(1).max(36000).nullable().optional(),
            }))
                .min(1)
                .max(200),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        if (body.data.environmentId) {
            const envRow = await prisma.orchestrationEnvironment.findFirst({
                where: { id: body.data.environmentId, projectId },
                select: { id: true },
            });
            if (!envRow)
                return c.json({ error: "Environment not found" }, 400);
        }
        const created = await prisma.orchestrationWorkflow.create({
            data: {
                projectId,
                name: body.data.name.trim(),
                description: body.data.description?.trim() || null,
                environmentId: body.data.environmentId ?? null,
                createdById: c.get("user").id,
                steps: {
                    create: body.data.steps.map((step, idx) => ({
                        name: step.name.trim(),
                        stepType: step.stepType.trim(),
                        sortOrder: step.sortOrder ?? idx,
                        timeoutSeconds: step.timeoutSeconds ?? null,
                    })),
                },
            },
            include: { steps: { orderBy: { sortOrder: "asc" } }, environment: true },
        });
        return c.json({
            id: created.id,
            name: created.name,
            description: created.description,
            isActive: created.isActive,
            environment: created.environment
                ? {
                    id: created.environment.id,
                    name: created.environment.name,
                    region: created.environment.region,
                }
                : null,
            steps: created.steps.map((s) => ({
                id: s.id,
                name: s.name,
                stepType: s.stepType,
                sortOrder: s.sortOrder,
                timeoutSeconds: s.timeoutSeconds,
            })),
        });
    });
    r.get("/projects/:projectId/orchestration/runs", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (!canRead(access.ctx))
            return c.json({ error: "Forbidden" }, 403);
        const rows = await prisma.orchestrationRun.findMany({
            where: { projectId },
            include: {
                workflow: { select: { id: true, name: true } },
                environment: { select: { id: true, name: true, region: true } },
                approvals: { orderBy: { requestedAt: "asc" } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        return c.json(rows.map((row) => ({
            id: row.id,
            workflow: row.workflow,
            environment: row.environment,
            status: row.status,
            startedAt: row.startedAt?.toISOString() ?? null,
            finishedAt: row.finishedAt?.toISOString() ?? null,
            changeWindowStart: row.changeWindowStart?.toISOString() ?? null,
            changeWindowEnd: row.changeWindowEnd?.toISOString() ?? null,
            approvals: row.approvals.map((a) => ({
                id: a.id,
                status: a.status,
                note: a.note,
                requestedAt: a.requestedAt.toISOString(),
                respondedAt: a.respondedAt?.toISOString() ?? null,
            })),
            createdAt: row.createdAt.toISOString(),
        })));
    });
    r.post("/projects/:projectId/orchestration/workflows/:workflowId/runs", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const workflowId = c.req.param("workflowId");
        const access = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (!canManage(access.ctx))
            return c.json({ error: "Admin or Super Admin only" }, 403);
        const body = z
            .object({
            environmentId: z.string().nullable().optional(),
            changeWindowStart: z.string().datetime().nullable().optional(),
            changeWindowEnd: z.string().datetime().nullable().optional(),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const workflow = await prisma.orchestrationWorkflow.findFirst({
            where: { id: workflowId, projectId },
            include: { steps: { orderBy: { sortOrder: "asc" } } },
        });
        if (!workflow)
            return c.json({ error: "Workflow not found" }, 404);
        const run = await prisma.orchestrationRun.create({
            data: {
                projectId,
                workflowId,
                environmentId: body.data.environmentId ?? workflow.environmentId ?? null,
                requestedById: c.get("user").id,
                status: "QUEUED",
                changeWindowStart: body.data.changeWindowStart
                    ? new Date(body.data.changeWindowStart)
                    : null,
                changeWindowEnd: body.data.changeWindowEnd ? new Date(body.data.changeWindowEnd) : null,
                stepRuns: {
                    create: workflow.steps.map((step) => ({
                        workflowStepId: step.id,
                        status: "QUEUED",
                    })),
                },
            },
        });
        return c.json({
            id: run.id,
            status: run.status,
            createdAt: run.createdAt.toISOString(),
        });
    });
    r.post("/projects/:projectId/orchestration/runs/:runId/approvals", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const runId = c.req.param("runId");
        const access = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (!canManage(access.ctx))
            return c.json({ error: "Admin or Super Admin only" }, 403);
        const body = z
            .object({
            status: z.nativeEnum(OrchestrationApprovalStatus),
            note: z.string().max(2000).nullable().optional(),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const run = await prisma.orchestrationRun.findFirst({
            where: { id: runId, projectId },
            select: { id: true },
        });
        if (!run)
            return c.json({ error: "Run not found" }, 404);
        const created = await prisma.orchestrationApproval.create({
            data: {
                runId,
                approverId: c.get("user").id,
                status: body.data.status,
                note: body.data.note?.trim() || null,
                respondedAt: body.data.status === "PENDING" ? null : new Date(),
            },
        });
        return c.json({
            id: created.id,
            status: created.status,
            note: created.note,
            requestedAt: created.requestedAt.toISOString(),
            respondedAt: created.respondedAt?.toISOString() ?? null,
        });
    });
}
