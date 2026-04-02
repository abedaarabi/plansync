import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { ActivityType, IssuePriority, IssueStatus, Prisma } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "../../lib/prisma.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectForMember, assertUserAssignableToProject } from "../../lib/projectAccess.js";
import { logActivity } from "../../lib/activity.js";
import type { Env } from "../../lib/env.js";
import { inviteFromAddress } from "../../lib/inviteEmail.js";
import {
  buildIssueAssignedEmailHtml,
  buildIssueAssignedEmailText,
  buildViewerIssueUrl,
} from "../../lib/issueAssignEmail.js";

function requirePro(workspace: { subscriptionStatus: string | null }) {
  if (!isWorkspacePro(workspace)) {
    return { error: "Pro subscription required", status: 402 as const };
  }
  return null;
}

/** Parse `YYYY-MM-DD` from client date inputs; noon UTC avoids TZ edge shifts. */
function dateFromYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
}

const issueInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  creator: { select: { id: true, name: true, email: true } },
  file: { select: { name: true } },
  fileVersion: { select: { version: true } },
} as const;

type IssueRow = Prisma.IssueGetPayload<{ include: typeof issueInclude }>;
const CARRY_FORWARD_META_KEY = "__carryForwardFromFileVersionId";

function issueRowJson(row: IssueRow) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    fileId: row.fileId,
    fileVersionId: row.fileVersionId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    startDate: row.startDate ? row.startDate.toISOString() : null,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    location: row.location,
    annotationId: row.annotationId,
    sheetName: row.sheetName ?? row.file.name,
    sheetVersion: row.sheetVersion ?? row.fileVersion.version,
    pageNumber: row.pageNumber,
    assigneeId: row.assigneeId,
    creatorId: row.creatorId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assignee: row.assignee
      ? {
          id: row.assignee.id,
          name: row.assignee.name,
          email: row.assignee.email,
        }
      : null,
    creator: row.creator
      ? {
          id: row.creator.id,
          name: row.creator.name,
          email: row.creator.email,
        }
      : null,
    file: { name: row.file.name },
    fileVersion: { version: row.fileVersion.version },
  };
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

async function fileVersionWriteBlocked(fileVersionId: string, userId: string): Promise<boolean> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    select: { lockedByUserId: true, lockExpiresAt: true },
  });
  if (!fv?.lockedByUserId) return false;
  if (fv.lockExpiresAt && fv.lockExpiresAt < new Date()) return false;
  return fv.lockedByUserId !== userId;
}

async function sendIssueAssignedEmail(
  env: Env,
  input: {
    assigneeEmail: string;
    assignerName: string;
    issueTitle: string;
    fileName: string;
    viewerUrl: string;
  },
): Promise<void> {
  const key = env.RESEND_API_KEY?.trim();
  const from = inviteFromAddress(env);
  if (!key || !from) return;

  const resend = new Resend(key);
  const payload = {
    to: input.assigneeEmail,
    assignerName: input.assignerName,
    issueTitle: input.issueTitle,
    fileName: input.fileName,
    viewerUrl: input.viewerUrl,
  };
  await resend.emails.send({
    from,
    to: input.assigneeEmail,
    subject: `PlanSync: assigned — ${input.issueTitle.slice(0, 60)}${input.issueTitle.length > 60 ? "…" : ""}`,
    html: buildIssueAssignedEmailHtml(payload),
    text: buildIssueAssignedEmailText(payload),
  });
}

export function registerIssuesRoutes(r: Hono, needUser: MiddlewareHandler, env: Env) {
  r.get("/file-versions/:fileVersionId/issues", needUser, async (c) => {
    const fileVersionId = c.req.param("fileVersionId")!;
    const fv = await prisma.fileVersion.findUnique({
      where: { id: fileVersionId },
      include: { file: { include: { project: { include: { workspace: true } } } } },
    });
    if (!fv) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.issue.findMany({
      where: { fileVersionId },
      include: issueInclude,
      orderBy: { createdAt: "desc" },
    });
    return c.json(rows.map(issueRowJson));
  });

  r.get("/projects/:projectId/issues", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const fileVersionId = c.req.query("fileVersionId")?.trim() || undefined;
    const access = await loadProjectForMember(projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.issue.findMany({
      where: {
        projectId,
        ...(fileVersionId ? { fileVersionId } : {}),
      },
      include: issueInclude,
      orderBy: { createdAt: "desc" },
    });
    return c.json(rows.map(issueRowJson));
  });

  r.get("/issues/:issueId", needUser, async (c) => {
    const issueId = c.req.param("issueId")!;
    const row = await prisma.issue.findUnique({
      where: { id: issueId },
      include: issueInclude,
    });
    if (!row) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(row.projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    const gate = requirePro(access.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    return c.json(issueRowJson(row));
  });

  r.post("/issues", needUser, async (c) => {
    const optionalYmd = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional();
    const body = z
      .object({
        workspaceId: z.string(),
        fileId: z.string(),
        fileVersionId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        annotationId: z.string().optional(),
        assigneeId: z.string().optional(),
        status: z.nativeEnum(IssueStatus).optional(),
        priority: z.nativeEnum(IssuePriority).optional(),
        startDate: optionalYmd,
        dueDate: optionalYmd,
        location: z.string().max(500).nullable().optional(),
        pageNumber: z.number().int().min(1).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const file = await prisma.file.findFirst({
      where: { id: body.data.fileId, project: { workspaceId: body.data.workspaceId } },
      include: { project: { include: { workspace: true } } },
    });
    if (!file) return c.json({ error: "File not found" }, 404);
    const issueAccess = await loadProjectForMember(file.projectId, c.get("user").id);
    if ("error" in issueAccess) return c.json({ error: issueAccess.error }, issueAccess.status);
    const gate = requirePro(file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const fv = await prisma.fileVersion.findFirst({
      where: { id: body.data.fileVersionId, fileId: file.id },
    });
    if (!fv) return c.json({ error: "File version not found" }, 404);

    if (await fileVersionWriteBlocked(fv.id, c.get("user").id)) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    if (body.data.assigneeId) {
      const a = await assertUserAssignableToProject(
        body.data.assigneeId,
        file.projectId,
        body.data.workspaceId,
      );
      if ("error" in a) return c.json({ error: a.error }, a.status);
    }

    const startDate =
      body.data.startDate === undefined
        ? undefined
        : body.data.startDate === null
          ? null
          : dateFromYmd(body.data.startDate);
    const dueDate =
      body.data.dueDate === undefined
        ? undefined
        : body.data.dueDate === null
          ? null
          : dateFromYmd(body.data.dueDate);

    const issue = await prisma.issue.create({
      data: {
        workspaceId: body.data.workspaceId,
        projectId: file.projectId,
        fileId: body.data.fileId,
        fileVersionId: body.data.fileVersionId,
        title: body.data.title,
        description: body.data.description,
        annotationId: body.data.annotationId,
        assigneeId: body.data.assigneeId,
        creatorId: c.get("user").id,
        status: body.data.status ?? IssueStatus.OPEN,
        priority: body.data.priority ?? IssuePriority.MEDIUM,
        ...(startDate !== undefined ? { startDate } : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
        ...(body.data.location !== undefined ? { location: body.data.location } : {}),
        sheetName: file.name,
        sheetVersion: fv.version,
        ...(body.data.pageNumber !== undefined ? { pageNumber: body.data.pageNumber } : {}),
      },
      include: issueInclude,
    });

    await logActivity(body.data.workspaceId, ActivityType.ISSUE_CREATED, {
      actorUserId: c.get("user").id,
      entityId: issue.id,
      projectId: issue.projectId,
      metadata: { title: issue.title },
    });

    const actor = await prisma.user.findUnique({
      where: { id: c.get("user").id },
      select: { name: true },
    });
    const assignerName = actor?.name?.trim() || "Someone";

    if (issue.assigneeId && issue.assignee?.email) {
      const viewerUrl = buildViewerIssueUrl(env, {
        issueId: issue.id,
        fileId: issue.fileId,
        fileVersionId: issue.fileVersionId,
        projectId: issue.projectId,
        fileName: issue.file.name,
        version: issue.fileVersion.version,
      });
      void sendIssueAssignedEmail(env, {
        assigneeEmail: issue.assignee.email,
        assignerName,
        issueTitle: issue.title,
        fileName: issue.file.name,
        viewerUrl,
      }).catch((e) => console.error("[issue-email]", e));
    }

    return c.json(issueRowJson(issue));
  });

  r.post("/file-versions/:newFileVersionId/issues/carry-forward", needUser, async (c) => {
    const newFileVersionId = c.req.param("newFileVersionId")!;
    const body = z
      .object({
        fromFileVersionId: z.string().min(1),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    if (body.data.fromFileVersionId === newFileVersionId) {
      return c.json({ error: "Source and destination versions must differ" }, 400);
    }

    const [fromVersion, toVersion] = await Promise.all([
      prisma.fileVersion.findUnique({
        where: { id: body.data.fromFileVersionId },
        include: { file: { include: { project: { include: { workspace: true } } } } },
      }),
      prisma.fileVersion.findUnique({
        where: { id: newFileVersionId },
        include: { file: true },
      }),
    ]);
    if (!fromVersion || !toVersion) return c.json({ error: "File version not found" }, 404);
    if (fromVersion.fileId !== toVersion.fileId) {
      return c.json({ error: "Versions must belong to the same file" }, 400);
    }
    if (fromVersion.version >= toVersion.version) {
      return c.json({ error: "Source version must be older than destination version" }, 400);
    }
    const carryAccess = await loadProjectForMember(fromVersion.file.projectId, c.get("user").id);
    if ("error" in carryAccess) return c.json({ error: carryAccess.error }, carryAccess.status);
    const gate = requirePro(carryAccess.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    if (await fileVersionWriteBlocked(toVersion.id, c.get("user").id)) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    const toBlobObj = asObject(toVersion.annotationBlob);
    if (toBlobObj?.[CARRY_FORWARD_META_KEY] === body.data.fromFileVersionId) {
      return c.json({ ok: true as const, copiedIssueCount: 0, idempotent: true as const });
    }

    const sourceIssues = await prisma.issue.findMany({
      where: { fileVersionId: fromVersion.id },
      orderBy: { createdAt: "asc" },
    });
    if (sourceIssues.length === 0) {
      const baseObj = asObject(toVersion.annotationBlob) ?? {};
      await prisma.fileVersion.update({
        where: { id: toVersion.id },
        data: {
          annotationBlob: {
            ...baseObj,
            [CARRY_FORWARD_META_KEY]: body.data.fromFileVersionId,
          } as Prisma.InputJsonValue,
        },
      });
      return c.json({ ok: true as const, copiedIssueCount: 0, idempotent: false as const });
    }

    const sourceBlobObj = asObject(fromVersion.annotationBlob);
    const sourceAnnotations = Array.isArray(sourceBlobObj?.annotations)
      ? (sourceBlobObj?.annotations as Array<Record<string, unknown>>)
      : [];

    const result = await prisma.$transaction(async (tx) => {
      const createdRows = await Promise.all(
        sourceIssues.map((issue) =>
          tx.issue.create({
            data: {
              workspaceId: issue.workspaceId,
              projectId: issue.projectId,
              fileId: issue.fileId,
              fileVersionId: toVersion.id,
              title: issue.title,
              description: issue.description,
              status: issue.status,
              priority: issue.priority,
              startDate: issue.startDate,
              dueDate: issue.dueDate,
              location: issue.location,
              annotationId: issue.annotationId,
              pageNumber: issue.pageNumber,
              assigneeId: issue.assigneeId,
              creatorId: c.get("user").id,
              sheetName: toVersion.file.name,
              sheetVersion: toVersion.version,
            },
            select: { id: true },
          }),
        ),
      );

      const issueIdMap = new Map<string, string>();
      sourceIssues.forEach((oldIssue, idx) => issueIdMap.set(oldIssue.id, createdRows[idx]!.id));

      const nextAnnotations = sourceAnnotations.map((ann) => {
        const linked = typeof ann.linkedIssueId === "string" ? ann.linkedIssueId : null;
        if (!linked) return ann;
        const mapped = issueIdMap.get(linked);
        if (!mapped) return ann;
        return { ...ann, linkedIssueId: mapped };
      });

      const nextBlob = {
        ...(sourceBlobObj ?? {}),
        annotations: nextAnnotations,
        [CARRY_FORWARD_META_KEY]: body.data.fromFileVersionId,
      };
      await tx.fileVersion.update({
        where: { id: toVersion.id },
        data: { annotationBlob: nextBlob as Prisma.InputJsonValue },
      });
      return createdRows.length;
    });

    await logActivity(fromVersion.file.project.workspaceId, ActivityType.ISSUE_CREATED, {
      actorUserId: c.get("user").id,
      entityId: toVersion.id,
      projectId: fromVersion.file.projectId,
      metadata: {
        carryForwardFromFileVersionId: fromVersion.id,
        carryForwardToFileVersionId: toVersion.id,
        copiedIssueCount: result,
      },
    });

    return c.json({ ok: true as const, copiedIssueCount: result, idempotent: false as const });
  });

  r.patch("/issues/:issueId", needUser, async (c) => {
    const issueId = c.req.param("issueId")!;
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        workspace: true,
        assignee: { select: { id: true, email: true } },
        file: { select: { name: true } },
        fileVersion: { select: { version: true } },
      },
    });
    if (!issue) return c.json({ error: "Not found" }, 404);
    const issuePatchAccess = await loadProjectForMember(issue.projectId, c.get("user").id);
    if ("error" in issuePatchAccess)
      return c.json({ error: issuePatchAccess.error }, issuePatchAccess.status);
    const gate = requirePro(issuePatchAccess.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    if (await fileVersionWriteBlocked(issue.fileVersionId, c.get("user").id)) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    const optionalYmdPatch = z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
      .optional();
    const body = z
      .object({
        status: z.nativeEnum(IssueStatus).optional(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        assigneeId: z.string().nullable().optional(),
        annotationId: z.string().nullable().optional(),
        priority: z.nativeEnum(IssuePriority).optional(),
        startDate: optionalYmdPatch,
        dueDate: optionalYmdPatch,
        location: z.string().max(500).nullable().optional(),
        pageNumber: z.number().int().min(1).nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const prevAssigneeId = issue.assigneeId;
    const nextAssigneeId = body.data.assigneeId === undefined ? undefined : body.data.assigneeId;
    const nextAnnotationId =
      body.data.annotationId === undefined ? undefined : body.data.annotationId;

    if (nextAssigneeId) {
      const a = await assertUserAssignableToProject(
        nextAssigneeId,
        issue.projectId,
        issue.workspaceId,
      );
      if ("error" in a) return c.json({ error: a.error }, a.status);
    }

    const patchStart =
      body.data.startDate === undefined
        ? undefined
        : body.data.startDate === null
          ? null
          : dateFromYmd(body.data.startDate);
    const patchDue =
      body.data.dueDate === undefined
        ? undefined
        : body.data.dueDate === null
          ? null
          : dateFromYmd(body.data.dueDate);

    const [fileFresh, fvFresh] = await Promise.all([
      prisma.file.findUnique({ where: { id: issue.fileId }, select: { name: true } }),
      prisma.fileVersion.findUnique({
        where: { id: issue.fileVersionId },
        select: { version: true },
      }),
    ]);

    const updated = await prisma.issue.update({
      where: { id: issue.id },
      data: {
        sheetName: fileFresh?.name ?? issue.file.name,
        sheetVersion: fvFresh?.version ?? issue.fileVersion.version,
        ...(body.data.status !== undefined ? { status: body.data.status } : {}),
        ...(body.data.title !== undefined ? { title: body.data.title } : {}),
        ...(body.data.description !== undefined ? { description: body.data.description } : {}),
        ...(nextAssigneeId !== undefined ? { assigneeId: nextAssigneeId } : {}),
        ...(nextAnnotationId !== undefined ? { annotationId: nextAnnotationId } : {}),
        ...(body.data.priority !== undefined ? { priority: body.data.priority } : {}),
        ...(patchStart !== undefined ? { startDate: patchStart } : {}),
        ...(patchDue !== undefined ? { dueDate: patchDue } : {}),
        ...(body.data.location !== undefined ? { location: body.data.location } : {}),
        ...(body.data.pageNumber !== undefined ? { pageNumber: body.data.pageNumber } : {}),
      },
      include: issueInclude,
    });

    await logActivity(issue.workspaceId, ActivityType.ISSUE_UPDATED, {
      actorUserId: c.get("user").id,
      entityId: issue.id,
      projectId: issue.projectId,
      metadata: { title: updated.title },
    });

    const shouldNotifyAssignee =
      nextAssigneeId !== undefined && nextAssigneeId !== null && nextAssigneeId !== prevAssigneeId;

    if (shouldNotifyAssignee && updated.assignee?.email) {
      const actor = await prisma.user.findUnique({
        where: { id: c.get("user").id },
        select: { name: true },
      });
      const assignerName = actor?.name?.trim() || "Someone";
      const viewerUrl = buildViewerIssueUrl(env, {
        issueId: updated.id,
        fileId: updated.fileId,
        fileVersionId: updated.fileVersionId,
        projectId: updated.projectId,
        fileName: updated.file.name,
        version: updated.fileVersion.version,
      });
      void sendIssueAssignedEmail(env, {
        assigneeEmail: updated.assignee.email,
        assignerName,
        issueTitle: updated.title,
        fileName: updated.file.name,
        viewerUrl,
      }).catch((e) => console.error("[issue-email]", e));
    }

    return c.json(issueRowJson(updated));
  });

  r.delete("/issues/:issueId", needUser, async (c) => {
    const issueId = c.req.param("issueId")!;
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { workspace: true },
    });
    if (!issue) return c.json({ error: "Not found" }, 404);
    const delAccess = await loadProjectForMember(issue.projectId, c.get("user").id);
    if ("error" in delAccess) return c.json({ error: delAccess.error }, delAccess.status);
    const gate = requirePro(delAccess.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    if (await fileVersionWriteBlocked(issue.fileVersionId, c.get("user").id)) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    const title = issue.title;
    await prisma.issue.delete({ where: { id: issueId } });

    await logActivity(issue.workspaceId, ActivityType.ISSUE_DELETED, {
      actorUserId: c.get("user").id,
      entityId: issueId,
      projectId: issue.projectId,
      metadata: { title },
    });

    return c.json({ ok: true as const });
  });
}
