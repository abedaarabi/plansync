import { z } from "zod";
import { ActivityType, RfiPriority, RfiStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { assertUserAssignableToProject, isWorkspaceAdmin } from "../../lib/projectAccess.js";
import { canAccessRfisList, canCreateRfis, loadProjectWithAuth } from "../../lib/permissions.js";
import { logActivity, logActivitySafe } from "../../lib/activity.js";
import { deleteObject, presignGet, presignPut } from "../../lib/s3.js";
import { buildRfiAttachmentKey, newUploadId, s3KeyMatchesRfiAttachment, } from "../../lib/fileUpload.js";
import { buildRfiClosedEmailLines, buildRfiMessageEmailLines, buildRfiReopenedEmailLines, buildRfiOverdueEmailLines, buildRfiResponseEmailLines, buildRfiSentEmailLines, rfiDetailUrl, sendRfiNotificationEmail, } from "../../lib/rfiEmail.js";
import { createUserNotifications, rfiAssigneeUserIds, rfiParticipantUserIds, } from "../../lib/userNotifications.js";
import { isRfiRichTextEffectivelyEmpty, rfiRichTextPlainExcerpt, sanitizeRfiMessageHtml, } from "../../lib/sanitizeRfiRichText.js";
function requirePro(workspace) {
    if (!isWorkspacePro(workspace)) {
        return { error: "Pro subscription required", status: 402 };
    }
    return null;
}
const MAX_RFI_ATTACHMENT_BYTES = 25n * 1024n * 1024n;
const rfiInclude = {
    assignedTo: { select: { id: true, name: true, email: true } },
    assigneeLinks: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
    },
    creator: { select: { id: true, name: true, email: true } },
    issueLinks: {
        include: {
            issue: {
                select: {
                    id: true,
                    title: true,
                    fileId: true,
                    fileVersionId: true,
                    pageNumber: true,
                    sheetName: true,
                    sheetVersion: true,
                },
            },
        },
        orderBy: { createdAt: "asc" },
    },
    file: { select: { id: true, name: true } },
    fileVersion: { select: { id: true, version: true, fileId: true } },
    attachments: {
        orderBy: { createdAt: "asc" },
        include: { uploadedBy: { select: { id: true, name: true } } },
    },
    answerMessage: {
        include: { author: { select: { id: true, name: true, email: true, image: true } } },
    },
};
function rfiRowJson(row) {
    const assignees = row.assigneeLinks.map((l) => ({
        id: l.user.id,
        name: l.user.name,
        email: l.user.email,
    }));
    const primary = assignees[0] ?? row.assignedTo;
    return {
        id: row.id,
        projectId: row.projectId,
        rfiNumber: row.rfiNumber,
        title: row.title,
        description: row.description,
        officialResponse: row.officialResponse,
        answerMessageId: row.answerMessageId,
        answerMessage: row.answerMessage
            ? {
                id: row.answerMessage.id,
                body: row.answerMessage.body,
                createdAt: row.answerMessage.createdAt.toISOString(),
                author: row.answerMessage.author,
            }
            : null,
        status: row.status,
        fromDiscipline: row.fromDiscipline,
        assignees,
        assignedToUserId: primary?.id ?? row.assignedToUserId,
        assignedTo: primary,
        creatorId: row.creatorId,
        creator: row.creator,
        dueDate: row.dueDate?.toISOString() ?? null,
        priority: row.priority,
        risk: row.risk,
        issues: row.issueLinks.map((l) => ({
            id: l.issue.id,
            title: l.issue.title,
            fileId: l.issue.fileId,
            fileVersionId: l.issue.fileVersionId,
            pageNumber: l.issue.pageNumber,
            sheetName: l.issue.sheetName,
            sheetVersion: l.issue.sheetVersion,
        })),
        fileId: row.fileId,
        file: row.file,
        fileVersionId: row.fileVersionId,
        fileVersion: row.fileVersion,
        pageNumber: row.pageNumber,
        pinNormX: row.pinNormX,
        pinNormY: row.pinNormY,
        voidReason: row.voidReason,
        lastOverdueNotifiedAt: row.lastOverdueNotifiedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        attachments: row.attachments.map((a) => ({
            id: a.id,
            rfiId: a.rfiId,
            s3Key: a.s3Key,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes.toString(),
            uploadedById: a.uploadedById,
            uploadedBy: a.uploadedBy,
            createdAt: a.createdAt.toISOString(),
        })),
    };
}
function isRfiCreator(rfi, userId) {
    if (!rfi.creatorId)
        return true;
    return rfi.creatorId === userId;
}
function canRespond(rfi, userId, admin) {
    if (admin)
        return true;
    if (rfi.assignedToUserId === userId)
        return true;
    return (rfi.assigneeLinks ?? []).some((l) => l.userId === userId);
}
function rfiHasResponder(rfi) {
    return (rfi.assigneeLinks?.length ?? 0) > 0 || rfi.assignedToUserId != null;
}
function rfiAppHref(projectId, rfiId) {
    return `/projects/${projectId}/rfi/${rfiId}`;
}
/** Sheet/drawing fields only (issue references are stored in `RfiIssueLink`). */
async function resolveDrawingFields(projectId, workspaceId, primaryIssueId, fileId, fileVersionId, pageNumber, pinNormX, pinNormY) {
    if (primaryIssueId) {
        const issue = await prisma.issue.findFirst({
            where: { id: primaryIssueId, projectId, workspaceId },
        });
        if (!issue)
            return { error: "Issue not found in this project" };
        return {
            fileId: issue.fileId,
            fileVersionId: issue.fileVersionId,
            pageNumber: issue.pageNumber ?? pageNumber ?? null,
            pinNormX: pinNormX ?? null,
            pinNormY: pinNormY ?? null,
        };
    }
    if (fileVersionId) {
        const fv = await prisma.fileVersion.findFirst({
            where: { id: fileVersionId, file: { projectId } },
            include: { file: true },
        });
        if (!fv)
            return { error: "File version not found in this project" };
        if (fileId && fv.fileId !== fileId)
            return { error: "File version does not match file" };
        return {
            fileId: fv.fileId,
            fileVersionId: fv.id,
            pageNumber: pageNumber ?? null,
            pinNormX: pinNormX ?? null,
            pinNormY: pinNormY ?? null,
        };
    }
    if (fileId) {
        const file = await prisma.file.findFirst({ where: { id: fileId, projectId } });
        if (!file)
            return { error: "File not found in this project" };
        return {
            fileId: file.id,
            fileVersionId: null,
            pageNumber: pageNumber ?? null,
            pinNormX: pinNormX ?? null,
            pinNormY: pinNormY ?? null,
        };
    }
    return {
        fileId: null,
        fileVersionId: null,
        pageNumber: null,
        pinNormX: null,
        pinNormY: null,
    };
}
async function syncRfiIssueLinks(tx, rfiId, issueIds) {
    const unique = [...new Set(issueIds)];
    await tx.rfiIssueLink.deleteMany({ where: { rfiId } });
    if (unique.length > 0) {
        await tx.rfiIssueLink.createMany({
            data: unique.map((issueId) => ({ rfiId, issueId })),
        });
    }
}
async function syncRfiAssigneeLinks(tx, rfiId, userIds) {
    const unique = [...new Set(userIds)];
    await tx.rfiAssigneeLink.deleteMany({ where: { rfiId } });
    if (unique.length > 0) {
        await tx.rfiAssigneeLink.createMany({
            data: unique.map((userId) => ({ rfiId, userId })),
        });
    }
}
const optionalYmd = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional();
function dateFromYmd(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
}
export function registerRfiRoutes(r, needUser, env) {
    r.get("/projects/:projectId/rfis", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canAccessRfisList(ctx)) {
            return c.json([]);
        }
        const list = await prisma.rfi.findMany({
            where: { projectId },
            include: rfiInclude,
            orderBy: { updatedAt: "desc" },
        });
        return c.json(list.map(rfiRowJson));
    });
    r.get("/projects/:projectId/rfis/:rfiId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const rfiId = c.req.param("rfiId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canAccessRfisList(ctx)) {
            return c.json({ error: "Not found" }, 404);
        }
        const row = await prisma.rfi.findFirst({
            where: { id: rfiId, projectId },
            include: rfiInclude,
        });
        if (!row)
            return c.json({ error: "Not found" }, 404);
        return c.json(rfiRowJson(row));
    });
    r.get("/projects/:projectId/rfis/:rfiId/activity", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const rfiId = c.req.param("rfiId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canAccessRfisList(ctx)) {
            return c.json({ error: "Not found" }, 404);
        }
        const exists = await prisma.rfi.findFirst({
            where: { id: rfiId, projectId },
            select: { id: true },
        });
        if (!exists)
            return c.json({ error: "Not found" }, 404);
        const wsId = ctx.project.workspaceId;
        const types = [
            ActivityType.RFI_CREATED,
            ActivityType.RFI_UPDATED,
            ActivityType.RFI_DELETED,
            ActivityType.RFI_SENT_FOR_REVIEW,
            ActivityType.RFI_RESPONSE_SUBMITTED,
            ActivityType.RFI_CLOSED,
            ActivityType.RFI_ATTACHMENT_ADDED,
            ActivityType.RFI_ATTACHMENT_REMOVED,
            ActivityType.RFI_MESSAGE_POSTED,
        ];
        const logs = await prisma.activityLog.findMany({
            where: {
                workspaceId: wsId,
                entityId: rfiId,
                type: { in: types },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
            include: { actor: { select: { id: true, name: true, email: true, image: true } } },
        });
        return c.json(logs.map((l) => ({
            id: l.id,
            type: l.type,
            createdAt: l.createdAt.toISOString(),
            metadata: l.metadata,
            actor: l.actor,
        })));
    });
    r.get("/projects/:projectId/rfis/:rfiId/messages", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const rfiId = c.req.param("rfiId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canAccessRfisList(ctx)) {
            return c.json({ error: "Not found" }, 404);
        }
        const exists = await prisma.rfi.findFirst({
            where: { id: rfiId, projectId },
            select: { id: true },
        });
        if (!exists)
            return c.json({ error: "Not found" }, 404);
        const rows = await prisma.rfiMessage.findMany({
            where: { rfiId },
            orderBy: { createdAt: "asc" },
            take: 500,
            include: { author: { select: { id: true, name: true, email: true, image: true } } },
        });
        return c.json(rows.map((m) => ({
            id: m.id,
            rfiId: m.rfiId,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
            author: m.author,
        })));
    });
    r.post("/projects/:projectId/rfis/:rfiId/messages", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const rfiId = c.req.param("rfiId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canCreateRfis(ctx)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.rfi.findFirst({
            where: { id: rfiId, projectId },
            include: rfiInclude,
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z.object({ body: z.string().min(1).max(120_000) }).safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const userId = c.get("user").id;
        let sanitized;
        try {
            sanitized = sanitizeRfiMessageHtml(body.data.body);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : "Invalid message";
            return c.json({ error: msg }, 400);
        }
        if (isRfiRichTextEffectivelyEmpty(sanitized)) {
            return c.json({ error: "Message is empty" }, 400);
        }
        const excerpt = rfiRichTextPlainExcerpt(sanitized, 200);
        const emailExcerpt = rfiRichTextPlainExcerpt(sanitized, 500);
        const row = await prisma.$transaction(async (tx) => {
            const created = await tx.rfiMessage.create({
                data: { rfiId, authorId: userId, body: sanitized },
                include: { author: { select: { id: true, name: true, email: true, image: true } } },
            });
            await tx.rfi.update({
                where: { id: rfiId },
                data: { updatedAt: new Date() },
            });
            return created;
        });
        await logActivity(ctx.project.workspaceId, ActivityType.RFI_MESSAGE_POSTED, {
            actorUserId: userId,
            entityId: rfiId,
            projectId,
            metadata: {
                title: existing.title,
                rfiNumber: existing.rfiNumber,
                excerpt,
            },
        });
        const actorName = row.author?.name?.trim() || "Someone";
        const authorEmail = row.author?.email?.trim().toLowerCase() ?? null;
        const notifySet = new Set();
        const pushEmail = (e) => {
            const t = e?.trim().toLowerCase();
            if (t)
                notifySet.add(t);
        };
        pushEmail(existing.creator?.email);
        pushEmail(existing.assignedTo?.email);
        for (const l of existing.assigneeLinks)
            pushEmail(l.user.email);
        if (authorEmail)
            notifySet.delete(authorEmail);
        const to = [...notifySet];
        if (to.length > 0) {
            const url = rfiDetailUrl(env, projectId, rfiId);
            await sendRfiNotificationEmail({
                env,
                to,
                subject: `New message on RFI #${String(existing.rfiNumber).padStart(3, "0")} — ${existing.title}`,
                heading: "New RFI discussion message",
                lines: buildRfiMessageEmailLines({
                    rfiNumber: existing.rfiNumber,
                    title: existing.title,
                    authorName: actorName,
                    bodyExcerpt: emailExcerpt,
                }),
                actionUrl: url,
                actionLabel: "View RFI",
            });
        }
        await createUserNotifications({
            workspaceId: ctx.project.workspaceId,
            projectId,
            recipientUserIds: rfiParticipantUserIds(existing),
            excludeUserId: userId,
            kind: "RFI_MESSAGE",
            title: `New message on RFI #${String(existing.rfiNumber).padStart(3, "0")}`,
            body: excerpt,
            href: rfiAppHref(projectId, rfiId),
            actorUserId: userId,
        });
        return c.json({
            id: row.id,
            rfiId: row.rfiId,
            body: row.body,
            createdAt: row.createdAt.toISOString(),
            author: row.author,
        });
    });
    r.post("/projects/:projectId/rfis", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canCreateRfis(ctx)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            title: z.string().min(1).max(500),
            description: z.string().min(1).max(5000),
            fromDiscipline: z.string().max(120).optional(),
            assignedToUserId: z.string().optional(),
            /** Multiple responders; any listed user may submit the official response. */
            assigneeUserIds: z.array(z.string()).max(30).optional(),
            dueDate: optionalYmd,
            priority: z.nativeEnum(RfiPriority).optional(),
            risk: z.enum(["low", "med", "high"]).optional().nullable(),
            /** Referenced site issues (drawing defaults from first when no sheet specified). */
            issueIds: z.array(z.string()).max(50).optional(),
            fileId: z.string().optional(),
            fileVersionId: z.string().optional(),
            pageNumber: z.number().int().min(1).optional(),
            pinNormX: z.number().optional(),
            pinNormY: z.number().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const effectiveAssigneeIds = [
            ...new Set(body.data.assigneeUserIds?.length
                ? body.data.assigneeUserIds
                : body.data.assignedToUserId
                    ? [body.data.assignedToUserId]
                    : []),
        ];
        for (const uid of effectiveAssigneeIds) {
            const a = await assertUserAssignableToProject(uid, projectId, ctx.project.workspaceId);
            if (!("ok" in a))
                return c.json({ error: a.error }, a.status);
        }
        const issueIds = [...new Set(body.data.issueIds ?? [])];
        if (issueIds.length > 0) {
            const n = await prisma.issue.count({
                where: { id: { in: issueIds }, projectId, workspaceId: ctx.project.workspaceId },
            });
            if (n !== issueIds.length) {
                return c.json({ error: "One or more issues not found in this project" }, 400);
            }
        }
        const primaryIssueId = issueIds[0] ?? null;
        const draw = await resolveDrawingFields(projectId, ctx.project.workspaceId, primaryIssueId, body.data.fileId ?? null, body.data.fileVersionId ?? null, body.data.pageNumber ?? null, body.data.pinNormX ?? null, body.data.pinNormY ?? null);
        if ("error" in draw)
            return c.json({ error: draw.error }, 400);
        const userId = c.get("user").id;
        const row = await prisma.$transaction(async (tx) => {
            const agg = await tx.rfi.aggregate({
                where: { projectId },
                _max: { rfiNumber: true },
            });
            const nextNum = (agg._max.rfiNumber ?? 0) + 1;
            const created = await tx.rfi.create({
                data: {
                    projectId,
                    rfiNumber: nextNum,
                    title: body.data.title,
                    description: body.data.description,
                    fromDiscipline: body.data.fromDiscipline,
                    assignedToUserId: effectiveAssigneeIds[0] ?? null,
                    creatorId: userId,
                    dueDate: body.data.dueDate ? dateFromYmd(body.data.dueDate) : null,
                    priority: body.data.priority ?? RfiPriority.MEDIUM,
                    risk: body.data.risk ?? null,
                    fileId: draw.fileId,
                    fileVersionId: draw.fileVersionId,
                    pageNumber: draw.pageNumber,
                    pinNormX: draw.pinNormX,
                    pinNormY: draw.pinNormY,
                },
                include: rfiInclude,
            });
            await syncRfiAssigneeLinks(tx, created.id, effectiveAssigneeIds);
            await syncRfiIssueLinks(tx, created.id, issueIds);
            return tx.rfi.findUniqueOrThrow({ where: { id: created.id }, include: rfiInclude });
        });
        await logActivity(ctx.project.workspaceId, ActivityType.RFI_CREATED, {
            actorUserId: userId,
            entityId: row.id,
            projectId,
            metadata: { title: row.title, rfiNumber: row.rfiNumber },
        });
        const initialResponderIds = rfiAssigneeUserIds(row);
        if (initialResponderIds.length > 0) {
            await createUserNotifications({
                workspaceId: ctx.project.workspaceId,
                projectId,
                recipientUserIds: initialResponderIds,
                excludeUserId: userId,
                kind: "RFI_ASSIGNED",
                title: `You were named a responder on RFI #${String(row.rfiNumber).padStart(3, "0")}`,
                body: row.title,
                href: rfiAppHref(projectId, row.id),
                actorUserId: userId,
            });
        }
        return c.json(rfiRowJson(row));
    });
    r.patch("/projects/:projectId/rfis/:rfiId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const rfiId = c.req.param("rfiId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canCreateRfis(ctx)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.rfi.findFirst({
            where: { id: rfiId, projectId },
            include: rfiInclude,
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            title: z.string().min(1).max(500).optional(),
            description: z.string().max(5000).nullable().optional(),
            officialResponse: z.string().max(20000).nullable().optional(),
            /** Set when marking ANSWERED; send `null` alone to remove the recorded answer. */
            answerMessageId: z.union([z.string().min(1).max(128), z.null()]).optional(),
            status: z.nativeEnum(RfiStatus).optional(),
            fromDiscipline: z.string().max(120).nullable().optional(),
            assignedToUserId: z.string().nullable().optional(),
            assigneeUserIds: z.array(z.string()).max(30).optional(),
            dueDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
            priority: z.nativeEnum(RfiPriority).optional(),
            risk: z.enum(["low", "med", "high"]).nullable().optional(),
            issueIds: z.array(z.string()).max(50).optional(),
            fileId: z.string().nullable().optional(),
            fileVersionId: z.string().nullable().optional(),
            pageNumber: z.number().int().min(1).nullable().optional(),
            pinNormX: z.number().nullable().optional(),
            pinNormY: z.number().nullable().optional(),
            voidReason: z.string().max(2000).nullable().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const userId = c.get("user").id;
        const admin = await isWorkspaceAdmin(ctx.project.workspaceId, userId);
        const data = body.data;
        if (existing.status === RfiStatus.CLOSED) {
            const mayReopen = isRfiCreator(existing, userId) || admin || canRespond(existing, userId, false);
            if (data.status === RfiStatus.IN_REVIEW && mayReopen) {
                const provided = Object.entries(data).filter(([, v]) => v !== undefined);
                if (provided.length !== 1 || provided[0]?.[0] !== "status") {
                    return c.json({
                        error: 'To reopen a closed RFI, send only { "status": "IN_REVIEW" }',
                    }, 400);
                }
                const row = await prisma.rfi.update({
                    where: { id: rfiId },
                    data: { status: RfiStatus.IN_REVIEW },
                    include: rfiInclude,
                });
                await logActivity(ctx.project.workspaceId, ActivityType.RFI_UPDATED, {
                    actorUserId: userId,
                    entityId: row.id,
                    projectId,
                    metadata: { title: row.title, rfiNumber: row.rfiNumber, reopened: true },
                });
                const url = rfiDetailUrl(env, projectId, row.id);
                const actorName = c.get("user").name?.trim() || "Someone";
                const recipientEmails = [
                    ...new Set([row.creator?.email, ...row.assigneeLinks.map((l) => l.user.email)].filter((e) => !!e && e.trim().length > 0)),
                ];
                if (recipientEmails.length > 0) {
                    await sendRfiNotificationEmail({
                        env,
                        to: recipientEmails,
                        subject: `RFI #${String(row.rfiNumber).padStart(3, "0")} reopened — ${row.title}`,
                        heading: "RFI reopened",
                        lines: buildRfiReopenedEmailLines({
                            rfiNumber: row.rfiNumber,
                            title: row.title,
                            reopenedByName: actorName,
                        }),
                        actionUrl: url,
                        actionLabel: "Open RFI",
                    });
                }
                await createUserNotifications({
                    workspaceId: ctx.project.workspaceId,
                    projectId,
                    recipientUserIds: rfiParticipantUserIds(row),
                    kind: "RFI_REOPENED",
                    title: `RFI #${String(row.rfiNumber).padStart(3, "0")} reopened`,
                    body: row.title,
                    href: rfiAppHref(projectId, row.id),
                    actorUserId: userId,
                });
                return c.json(rfiRowJson(row));
            }
            return c.json({ error: "RFI is closed and read-only" }, 400);
        }
        if (data.answerMessageId === null) {
            const otherProvided = Object.entries(data).filter(([k, v]) => v !== undefined && k !== "answerMessageId");
            if (otherProvided.length > 0) {
                return c.json({ error: 'To remove the recorded answer, send only { "answerMessageId": null }' }, 400);
            }
            const hasRecorded = existing.answerMessageId != null || !!existing.officialResponse?.trim();
            if (!hasRecorded) {
                return c.json({ error: "No recorded answer to remove" }, 400);
            }
            if (!isRfiCreator(existing, userId) && !admin && !canRespond(existing, userId, false)) {
                return c.json({
                    error: "Only the creator, a responder, or a workspace admin can remove the recorded answer",
                }, 403);
            }
            const downgraded = existing.status === RfiStatus.ANSWERED;
            const row = await prisma.rfi.update({
                where: { id: rfiId },
                data: {
                    answerMessageId: null,
                    officialResponse: null,
                    ...(downgraded ? { status: RfiStatus.IN_REVIEW } : {}),
                },
                include: rfiInclude,
            });
            await logActivity(ctx.project.workspaceId, ActivityType.RFI_UPDATED, {
                actorUserId: userId,
                entityId: row.id,
                projectId,
                metadata: { title: row.title, rfiNumber: row.rfiNumber, clearedRecordedAnswer: true },
            });
            return c.json(rfiRowJson(row));
        }
        const statusRequested = data.status;
        let answerMessageForPatch = null;
        if (statusRequested !== undefined && statusRequested !== existing.status) {
            if (statusRequested === RfiStatus.IN_REVIEW) {
                if (existing.status !== RfiStatus.OPEN) {
                    return c.json({ error: "Only an open RFI can be sent for review" }, 400);
                }
                if (!isRfiCreator(existing, userId)) {
                    return c.json({ error: "Only the RFI creator can send for review" }, 403);
                }
                const nextAssigneeIds = data.assigneeUserIds !== undefined
                    ? [...new Set(data.assigneeUserIds)]
                    : data.assignedToUserId !== undefined
                        ? data.assignedToUserId
                            ? [data.assignedToUserId]
                            : []
                        : null;
                const willHaveResponder = nextAssigneeIds !== null ? nextAssigneeIds.length > 0 : rfiHasResponder(existing);
                if (!willHaveResponder) {
                    return c.json({ error: "Assign at least one responder before sending for review" }, 400);
                }
            }
            else if (statusRequested === RfiStatus.ANSWERED) {
                if (existing.status !== RfiStatus.IN_REVIEW) {
                    return c.json({ error: "Only an RFI in review can be marked answered" }, 400);
                }
                if (!canRespond(existing, userId, admin)) {
                    return c.json({ error: "Only a responder (or a workspace admin) can mark the answer" }, 403);
                }
                const mid = data.answerMessageId?.trim();
                if (!mid) {
                    return c.json({ error: "Select a discussion message as the official answer (answerMessageId)" }, 400);
                }
                const msg = await prisma.rfiMessage.findFirst({
                    where: { id: mid, rfiId },
                });
                if (!msg) {
                    return c.json({ error: "That message is not part of this RFI" }, 400);
                }
                if (isRfiRichTextEffectivelyEmpty(msg.body)) {
                    return c.json({ error: "The selected message is empty" }, 400);
                }
                answerMessageForPatch = { id: msg.id, body: msg.body };
            }
            else if (statusRequested === RfiStatus.CLOSED) {
                if (existing.status === RfiStatus.ANSWERED) {
                    if (!isRfiCreator(existing, userId)) {
                        return c.json({ error: "Only the RFI creator can close after an answer" }, 403);
                    }
                }
                else {
                    if (!isRfiCreator(existing, userId)) {
                        return c.json({ error: "Only the RFI creator can void or close this RFI" }, 403);
                    }
                }
            }
            else if (statusRequested === RfiStatus.OPEN) {
                return c.json({ error: "Invalid status transition" }, 400);
            }
        }
        else {
            if (!isRfiCreator(existing, userId) && !admin) {
                return c.json({ error: "Only the creator or a workspace admin can edit this RFI" }, 403);
            }
        }
        let assigneeIdsToSync;
        if (data.assigneeUserIds !== undefined) {
            assigneeIdsToSync = [...new Set(data.assigneeUserIds)];
        }
        else if (data.assignedToUserId !== undefined) {
            assigneeIdsToSync = data.assignedToUserId ? [data.assignedToUserId] : [];
        }
        if (assigneeIdsToSync !== undefined) {
            for (const uid of assigneeIdsToSync) {
                const a = await assertUserAssignableToProject(uid, projectId, ctx.project.workspaceId);
                if (!("ok" in a))
                    return c.json({ error: a.error }, a.status);
            }
        }
        const patchIssueIds = data.issueIds !== undefined ? [...new Set(data.issueIds)] : undefined;
        if (patchIssueIds !== undefined && patchIssueIds.length > 0) {
            const n = await prisma.issue.count({
                where: { id: { in: patchIssueIds }, projectId, workspaceId: ctx.project.workspaceId },
            });
            if (n !== patchIssueIds.length) {
                return c.json({ error: "One or more issues not found in this project" }, 400);
            }
        }
        let drawPatch;
        if (data.fileId !== undefined ||
            data.fileVersionId !== undefined ||
            data.pageNumber !== undefined ||
            data.pinNormX !== undefined ||
            data.pinNormY !== undefined) {
            const draw = await resolveDrawingFields(projectId, ctx.project.workspaceId, null, data.fileId !== undefined ? data.fileId : existing.fileId, data.fileVersionId !== undefined ? data.fileVersionId : existing.fileVersionId, data.pageNumber !== undefined ? data.pageNumber : existing.pageNumber, data.pinNormX !== undefined ? data.pinNormX : existing.pinNormX, data.pinNormY !== undefined ? data.pinNormY : existing.pinNormY);
            if ("error" in draw)
                return c.json({ error: draw.error }, 400);
            drawPatch = draw;
        }
        const { dueDate: dueYmd, status: _stIgnored, answerMessageId: _answerMessageIdOmit, officialResponse: _officialResponseOmit, issueIds: _issueIdsOmit, assigneeUserIds: _omitAssigneeIds, assignedToUserId: _omitAssignedSingle, fileId: _of, fileVersionId: _ofv, pageNumber: _opn, pinNormX: _opx, pinNormY: _opy, voidReason: voidReasonIn, ...scalarFields } = data;
        const updateData = { ...scalarFields };
        if (assigneeIdsToSync !== undefined) {
            updateData.assignedToUserId = assigneeIdsToSync[0] ?? null;
        }
        if (dueYmd !== undefined) {
            updateData.dueDate = dueYmd === null ? null : dateFromYmd(dueYmd);
        }
        if (drawPatch) {
            updateData.fileId = drawPatch.fileId;
            updateData.fileVersionId = drawPatch.fileVersionId;
            updateData.pageNumber = drawPatch.pageNumber;
            updateData.pinNormX = drawPatch.pinNormX;
            updateData.pinNormY = drawPatch.pinNormY;
        }
        if (statusRequested !== undefined) {
            updateData.status = statusRequested;
        }
        if (statusRequested === RfiStatus.CLOSED) {
            if (existing.status !== RfiStatus.ANSWERED) {
                updateData.voidReason = voidReasonIn ?? existing.voidReason ?? null;
            }
            else {
                updateData.voidReason = null;
            }
        }
        if (statusRequested === RfiStatus.ANSWERED && answerMessageForPatch) {
            updateData.answerMessageId = answerMessageForPatch.id;
            updateData.officialResponse = rfiRichTextPlainExcerpt(answerMessageForPatch.body, 20000);
        }
        const row = await prisma.$transaction(async (tx) => {
            await tx.rfi.update({
                where: { id: rfiId },
                data: updateData,
            });
            if (patchIssueIds !== undefined) {
                await syncRfiIssueLinks(tx, rfiId, patchIssueIds);
            }
            if (assigneeIdsToSync !== undefined) {
                await syncRfiAssigneeLinks(tx, rfiId, assigneeIdsToSync);
            }
            return tx.rfi.findUniqueOrThrow({ where: { id: rfiId }, include: rfiInclude });
        });
        const url = rfiDetailUrl(env, projectId, row.id);
        const actorName = c.get("user").name?.trim() || "Someone";
        if (statusRequested === RfiStatus.IN_REVIEW && existing.status === RfiStatus.OPEN) {
            await logActivity(ctx.project.workspaceId, ActivityType.RFI_SENT_FOR_REVIEW, {
                actorUserId: userId,
                entityId: row.id,
                projectId,
                metadata: { title: row.title, rfiNumber: row.rfiNumber },
            });
            const to = [
                ...new Set(row.assigneeLinks.map((l) => l.user.email).filter((e) => !!e?.trim())),
            ];
            if (to.length > 0) {
                const dueLabel = row.dueDate
                    ? row.dueDate.toLocaleDateString("en-US", { timeZone: "UTC" })
                    : "";
                await sendRfiNotificationEmail({
                    env,
                    to,
                    subject: `RFI #${String(row.rfiNumber).padStart(3, "0")} needs your review — ${row.title}`,
                    heading: "RFI sent for review",
                    lines: buildRfiSentEmailLines({
                        rfiNumber: row.rfiNumber,
                        title: row.title,
                        dueLabel,
                        senderName: actorName,
                    }),
                    actionUrl: url,
                    actionLabel: "Open RFI",
                });
            }
            await createUserNotifications({
                workspaceId: ctx.project.workspaceId,
                projectId,
                recipientUserIds: rfiAssigneeUserIds(row),
                excludeUserId: userId,
                kind: "RFI_REVIEW",
                title: `RFI #${String(row.rfiNumber).padStart(3, "0")} needs your review`,
                body: row.title,
                href: rfiAppHref(projectId, row.id),
                actorUserId: userId,
            });
        }
        else if (statusRequested === RfiStatus.ANSWERED && existing.status === RfiStatus.IN_REVIEW) {
            await logActivity(ctx.project.workspaceId, ActivityType.RFI_RESPONSE_SUBMITTED, {
                actorUserId: userId,
                entityId: row.id,
                projectId,
                metadata: { title: row.title, rfiNumber: row.rfiNumber },
            });
            const creatorEmail = row.creator?.email;
            if (creatorEmail) {
                await sendRfiNotificationEmail({
                    env,
                    to: [creatorEmail],
                    subject: `Response on RFI #${String(row.rfiNumber).padStart(3, "0")} — ${row.title}`,
                    heading: "Official response submitted",
                    lines: buildRfiResponseEmailLines({
                        rfiNumber: row.rfiNumber,
                        title: row.title,
                        responderName: actorName,
                        responseExcerpt: row.officialResponse ?? "",
                    }),
                    actionUrl: url,
                    actionLabel: "View response",
                });
            }
            const respText = (row.officialResponse ?? "").trim();
            const respExcerpt = respText.length > 200 ? `${respText.slice(0, 200)}…` : respText || null;
            if (row.creatorId && row.creatorId !== userId) {
                await createUserNotifications({
                    workspaceId: ctx.project.workspaceId,
                    projectId,
                    recipientUserIds: [row.creatorId],
                    kind: "RFI_RESPONSE",
                    title: `Response on RFI #${String(row.rfiNumber).padStart(3, "0")}`,
                    body: respExcerpt,
                    href: rfiAppHref(projectId, row.id),
                    actorUserId: userId,
                });
            }
        }
        else if (statusRequested === RfiStatus.CLOSED) {
            await logActivity(ctx.project.workspaceId, ActivityType.RFI_CLOSED, {
                actorUserId: userId,
                entityId: row.id,
                projectId,
                metadata: {
                    title: row.title,
                    rfiNumber: row.rfiNumber,
                    void: existing.status !== RfiStatus.ANSWERED,
                    reason: row.voidReason,
                },
            });
            const recipients = [
                ...new Set([row.creator?.email, ...row.assigneeLinks.map((l) => l.user.email)].filter((e) => !!e && e.trim().length > 0)),
            ];
            if (recipients.length > 0) {
                await sendRfiNotificationEmail({
                    env,
                    to: recipients,
                    subject: `RFI #${String(row.rfiNumber).padStart(3, "0")} closed — ${row.title}`,
                    heading: "RFI closed",
                    lines: buildRfiClosedEmailLines({
                        rfiNumber: row.rfiNumber,
                        title: row.title,
                        closedByName: actorName,
                    }),
                    actionUrl: url,
                    actionLabel: "View RFI",
                });
            }
            await createUserNotifications({
                workspaceId: ctx.project.workspaceId,
                projectId,
                recipientUserIds: rfiParticipantUserIds(row),
                excludeUserId: userId,
                kind: "RFI_CLOSED",
                title: `RFI #${String(row.rfiNumber).padStart(3, "0")} closed`,
                body: row.title,
                href: rfiAppHref(projectId, row.id),
                actorUserId: userId,
            });
        }
        else {
            await logActivity(ctx.project.workspaceId, ActivityType.RFI_UPDATED, {
                actorUserId: userId,
                entityId: row.id,
                projectId,
                metadata: { title: row.title, rfiNumber: row.rfiNumber },
            });
        }
        if (assigneeIdsToSync !== undefined) {
            const before = new Set(rfiAssigneeUserIds(existing));
            const addedResponders = assigneeIdsToSync.filter((id) => !before.has(id));
            if (addedResponders.length > 0) {
                await createUserNotifications({
                    workspaceId: ctx.project.workspaceId,
                    projectId,
                    recipientUserIds: addedResponders,
                    excludeUserId: userId,
                    kind: "RFI_ASSIGNED",
                    title: `You were named a responder on RFI #${String(row.rfiNumber).padStart(3, "0")}`,
                    body: row.title,
                    href: rfiAppHref(projectId, row.id),
                    actorUserId: userId,
                });
            }
        }
        return c.json(rfiRowJson(row));
    });
    r.delete("/projects/:projectId/rfis/:rfiId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const rfiId = c.req.param("rfiId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canCreateRfis(ctx)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.rfi.findFirst({
            where: { id: rfiId, projectId },
            include: { attachments: true },
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const bytes = existing.attachments.reduce((acc, a) => acc + a.sizeBytes, 0n);
        await logActivitySafe(ctx.project.workspaceId, ActivityType.RFI_DELETED, {
            actorUserId: c.get("user").id,
            entityId: existing.id,
            projectId,
            metadata: { title: existing.title, rfiNumber: existing.rfiNumber },
        });
        await prisma.$transaction([
            prisma.rfi.delete({ where: { id: rfiId } }),
            prisma.workspace.update({
                where: { id: ctx.project.workspaceId },
                data: { storageUsedBytes: { decrement: bytes } },
            }),
        ]);
        return c.json({ ok: true });
    });
    r.post("/projects/:projectId/rfis/:rfiId/attachments/presign", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const rfiId = c.req.param("rfiId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canCreateRfis(ctx)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rfi = await prisma.rfi.findFirst({ where: { id: rfiId, projectId } });
        if (!rfi)
            return c.json({ error: "Not found" }, 404);
        if (rfi.status === RfiStatus.CLOSED)
            return c.json({ error: "RFI is closed" }, 400);
        const body = z
            .object({
            fileName: z.string().min(1),
            contentType: z.string().default("application/octet-stream"),
            sizeBytes: z.coerce.bigint(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        if (body.data.sizeBytes <= 0n) {
            return c.json({ error: "File is empty" }, 400);
        }
        if (body.data.sizeBytes > MAX_RFI_ATTACHMENT_BYTES) {
            return c.json({ error: "File too large (max 25 MB per attachment)" }, 400);
        }
        const ws = ctx.project.workspace;
        const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        const uploadId = newUploadId();
        const key = buildRfiAttachmentKey(ctx.project.workspaceId, projectId, rfiId, uploadId, body.data.fileName);
        let url;
        try {
            url = await presignPut(env, key, body.data.contentType);
        }
        catch (e) {
            console.error("[rfi attachment presign]", e);
            return c.json({ error: "Could not create upload URL. Check S3 credentials and bucket configuration." }, 503);
        }
        if (!url) {
            return c.json({ error: "S3 not configured — set AWS_* and S3_BUCKET", devKey: key }, 503);
        }
        return c.json({ uploadUrl: url, key });
    });
    r.post("/projects/:projectId/rfis/:rfiId/attachments/complete", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const rfiId = c.req.param("rfiId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canCreateRfis(ctx)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rfi = await prisma.rfi.findFirst({ where: { id: rfiId, projectId } });
        if (!rfi)
            return c.json({ error: "Not found" }, 404);
        if (rfi.status === RfiStatus.CLOSED)
            return c.json({ error: "RFI is closed" }, 400);
        const body = z
            .object({
            key: z.string().min(1),
            fileName: z.string().min(1),
            mimeType: z.string().default("application/octet-stream"),
            sizeBytes: z.coerce.bigint(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        if (body.data.sizeBytes <= 0n) {
            return c.json({ error: "File is empty" }, 400);
        }
        if (body.data.sizeBytes > MAX_RFI_ATTACHMENT_BYTES) {
            return c.json({ error: "File too large (max 25 MB per attachment)" }, 400);
        }
        if (!s3KeyMatchesRfiAttachment(body.data.key, ctx.project.workspaceId, projectId, rfiId)) {
            return c.json({ error: "Invalid upload key" }, 400);
        }
        const ws = ctx.project.workspace;
        const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        const [att] = await prisma.$transaction([
            prisma.rfiAttachment.create({
                data: {
                    rfiId,
                    s3Key: body.data.key,
                    fileName: body.data.fileName,
                    mimeType: body.data.mimeType,
                    sizeBytes: body.data.sizeBytes,
                    uploadedById: c.get("user").id,
                },
                include: { uploadedBy: { select: { id: true, name: true } } },
            }),
            prisma.workspace.update({
                where: { id: ctx.project.workspaceId },
                data: { storageUsedBytes: { increment: body.data.sizeBytes } },
            }),
        ]);
        await logActivity(ctx.project.workspaceId, ActivityType.RFI_ATTACHMENT_ADDED, {
            actorUserId: c.get("user").id,
            entityId: rfiId,
            projectId,
            metadata: { fileName: att.fileName, rfiNumber: rfi.rfiNumber, title: rfi.title },
        });
        return c.json({
            id: att.id,
            rfiId: att.rfiId,
            s3Key: att.s3Key,
            fileName: att.fileName,
            mimeType: att.mimeType,
            sizeBytes: att.sizeBytes.toString(),
            uploadedById: att.uploadedById,
            uploadedBy: att.uploadedBy,
            createdAt: att.createdAt.toISOString(),
        });
    });
    r.get("/projects/:projectId/rfis/:rfiId/attachments/:attachmentId/presign-read", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const rfiId = c.req.param("rfiId");
        const attachmentId = c.req.param("attachmentId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canAccessRfisList(ctx)) {
            return c.json({ error: "Not found" }, 404);
        }
        const att = await prisma.rfiAttachment.findFirst({
            where: { id: attachmentId, rfiId, rfi: { projectId } },
        });
        if (!att)
            return c.json({ error: "Not found" }, 404);
        let url;
        try {
            url = await presignGet(env, att.s3Key);
        }
        catch (e) {
            console.error("[rfi attachment presign-read]", e);
            return c.json({ error: "Could not create download link (S3)." }, 503);
        }
        if (!url)
            return c.json({ error: "S3 not configured" }, 503);
        return c.json({ url });
    });
    r.delete("/projects/:projectId/rfis/:rfiId/attachments/:attachmentId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const rfiId = c.req.param("rfiId");
        const attachmentId = c.req.param("attachmentId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!canCreateRfis(ctx)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rfi = await prisma.rfi.findFirst({ where: { id: rfiId, projectId } });
        if (!rfi)
            return c.json({ error: "Not found" }, 404);
        if (rfi.status === RfiStatus.CLOSED)
            return c.json({ error: "RFI is closed" }, 400);
        const att = await prisma.rfiAttachment.findFirst({
            where: { id: attachmentId, rfiId },
        });
        if (!att)
            return c.json({ error: "Not found" }, 404);
        const del = await deleteObject(env, att.s3Key);
        if (!del.ok && del.error !== "S3 not configured") {
            return c.json({ error: del.error }, 503);
        }
        await prisma.$transaction([
            prisma.rfiAttachment.delete({ where: { id: att.id } }),
            prisma.workspace.update({
                where: { id: ctx.project.workspaceId },
                data: { storageUsedBytes: { decrement: att.sizeBytes } },
            }),
        ]);
        await logActivity(ctx.project.workspaceId, ActivityType.RFI_ATTACHMENT_REMOVED, {
            actorUserId: c.get("user").id,
            entityId: rfiId,
            projectId,
            metadata: { fileName: att.fileName, rfiNumber: rfi.rfiNumber, title: rfi.title },
        });
        return c.json({ ok: true });
    });
    r.post("/internal/rfi-overdue-reminders", async (c) => {
        const secret = env.INTERNAL_CRON_SECRET?.trim();
        if (!secret)
            return c.json({ error: "Not configured" }, 503);
        const hdr = c.req.header("x-plansync-cron-secret");
        if (hdr !== secret)
            return c.json({ error: "Unauthorized" }, 401);
        const now = new Date();
        const dayKey = now.toISOString().slice(0, 10);
        const rows = await prisma.rfi.findMany({
            where: {
                dueDate: { lt: now },
                status: { in: [RfiStatus.OPEN, RfiStatus.IN_REVIEW] },
            },
            include: {
                assigneeLinks: { include: { user: { select: { id: true, email: true } } } },
                assignedTo: { select: { id: true, email: true } },
                creator: { select: { id: true, email: true } },
                project: { select: { id: true, workspaceId: true } },
            },
        });
        let sent = 0;
        for (const row of rows) {
            const last = row.lastOverdueNotifiedAt;
            if (last && last.toISOString().slice(0, 10) === dayKey)
                continue;
            const dueLabel = row.dueDate
                ? row.dueDate.toLocaleDateString("en-US", { timeZone: "UTC" })
                : "";
            const recipients = [
                row.creator?.email,
                ...row.assigneeLinks.map((l) => l.user.email),
                row.assignedTo?.email,
            ].filter((e) => !!e?.trim());
            if (recipients.length === 0) {
                await prisma.rfi.update({
                    where: { id: row.id },
                    data: { lastOverdueNotifiedAt: now },
                });
                continue;
            }
            const url = rfiDetailUrl(env, row.projectId, row.id);
            await sendRfiNotificationEmail({
                env,
                to: recipients,
                subject: `Overdue: RFI #${String(row.rfiNumber).padStart(3, "0")} — ${row.title}`,
                heading: "RFI overdue reminder",
                lines: buildRfiOverdueEmailLines({
                    rfiNumber: row.rfiNumber,
                    title: row.title,
                    dueLabel,
                }),
                actionUrl: url,
                actionLabel: "Open RFI",
            });
            const overdueNotifyIds = rfiParticipantUserIds({
                creatorId: row.creatorId,
                assignedToUserId: row.assignedToUserId,
                assigneeLinks: row.assigneeLinks.map((l) => ({ userId: l.userId })),
            });
            try {
                await createUserNotifications({
                    workspaceId: row.project.workspaceId,
                    projectId: row.projectId,
                    recipientUserIds: overdueNotifyIds,
                    kind: "RFI_OVERDUE",
                    title: `Overdue: RFI #${String(row.rfiNumber).padStart(3, "0")}`,
                    body: row.title,
                    href: rfiAppHref(row.projectId, row.id),
                });
            }
            catch (e) {
                console.error("[rfi-overdue-notification]", e);
            }
            await prisma.rfi.update({
                where: { id: row.id },
                data: { lastOverdueNotifiedAt: now },
            });
            sent += 1;
        }
        return c.json({ ok: true, processed: rows.length, emailsSent: sent });
    });
}
