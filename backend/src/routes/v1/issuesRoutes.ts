import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  ActivityType,
  IssueKind,
  IssuePriority,
  IssueStatus,
  Prisma,
  RfiStatus,
} from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "../../lib/prisma.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectForMember, assertUserAssignableToProject } from "../../lib/projectAccess.js";
import { canCreateIssues, issuesWhereForAuth, loadProjectWithAuth } from "../../lib/permissions.js";
import { logActivity } from "../../lib/activity.js";
import type { Env } from "../../lib/env.js";
import { inviteFromAddress } from "../../lib/inviteEmail.js";
import {
  buildIssueAssignedEmailHtml,
  buildIssueAssignedEmailText,
  buildViewerIssuePath,
  buildViewerIssueUrl,
} from "../../lib/issueAssignEmail.js";
import { createUserNotifications } from "../../lib/userNotifications.js";

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
  assignee: { select: { id: true, name: true, email: true, image: true } },
  creator: { select: { id: true, name: true, email: true, image: true } },
  asset: { select: { id: true, tag: true, name: true } },
  file: { select: { name: true } },
  fileVersion: { select: { version: true } },
  rfiLinks: {
    include: {
      rfi: { select: { id: true, rfiNumber: true, title: true, status: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
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
          image: row.assignee.image,
        }
      : null,
    creator: row.creator
      ? {
          id: row.creator.id,
          name: row.creator.name,
          email: row.creator.email,
          image: row.creator.image,
        }
      : null,
    file: { name: row.file.name },
    fileVersion: { version: row.fileVersion.version },
    linkedRfis: row.rfiLinks.map((l) => ({
      id: l.rfi.id,
      rfiNumber: l.rfi.rfiNumber,
      title: l.rfi.title,
      status: l.rfi.status,
    })),
    issueKind: row.issueKind,
    assetId: row.assetId,
    asset: row.asset ? { id: row.asset.id, tag: row.asset.tag, name: row.asset.name } : null,
    externalAssigneeEmail: row.externalAssigneeEmail,
    externalAssigneeName: row.externalAssigneeName,
    acknowledgedAt: row.acknowledgedAt ? row.acknowledgedAt.toISOString() : null,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    reporterName: row.reporterName,
    reporterEmail: row.reporterEmail,
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
    html: buildIssueAssignedEmailHtml(env, payload),
    text: buildIssueAssignedEmailText(payload),
  });
}

export function registerIssuesRoutes(
  r: Hono,
  needUser: MiddlewareHandler,
  env: Env,
  opts?: { onIssuesMutated?: (fileVersionId: string) => void },
) {
  const notifyIssues = (fileVersionId: string) => opts?.onIssuesMutated?.(fileVersionId);
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

    const issueKindRaw = c.req.query("issueKind")?.trim();
    const issueKind =
      issueKindRaw === "WORK_ORDER" || issueKindRaw === "CONSTRUCTION"
        ? (issueKindRaw as IssueKind)
        : undefined;

    const rows = await prisma.issue.findMany({
      where: { fileVersionId, ...(issueKind ? { issueKind } : {}) },
      include: issueInclude,
      orderBy: { createdAt: "desc" },
    });
    return c.json(rows.map(issueRowJson));
  });

  r.get("/projects/:projectId/issues", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const fileVersionId = c.req.query("fileVersionId")?.trim() || undefined;
    const assetIdFilter = c.req.query("assetId")?.trim() || undefined;
    const issueKindRaw = c.req.query("issueKind")?.trim();
    const issueKind =
      issueKindRaw === "WORK_ORDER" || issueKindRaw === "CONSTRUCTION"
        ? (issueKindRaw as IssueKind)
        : undefined;
    const userId = c.get("user").id;
    const auth = await loadProjectWithAuth(projectId, userId);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.settings.modules.issues) {
      return c.json([]);
    }
    const gate = requirePro(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const scope = issuesWhereForAuth(ctx, userId);
    const rows = await prisma.issue.findMany({
      where: {
        projectId,
        ...(fileVersionId ? { fileVersionId } : {}),
        ...(assetIdFilter ? { assetId: assetIdFilter } : {}),
        ...(issueKind ? { issueKind } : {}),
        ...scope,
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
    const userId = c.get("user").id;
    const auth = await loadProjectWithAuth(row.projectId, userId);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.settings.modules.issues) {
      return c.json({ error: "Not found" }, 404);
    }
    const gate = requirePro(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const scope = issuesWhereForAuth(ctx, userId);
    const allowed = await prisma.issue.count({
      where: { id: issueId, projectId: row.projectId, ...scope },
    });
    if (allowed === 0) return c.json({ error: "Not found" }, 404);
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
        /** Link new issue to one or more project RFIs (merged with `rfiId` if both sent). */
        rfiId: z.string().optional(),
        rfiIds: z.array(z.string()).max(50).optional(),
        issueKind: z.nativeEnum(IssueKind).optional(),
        assetId: z.string().optional(),
        externalAssigneeEmail: z.string().email().optional().or(z.literal("")),
        externalAssigneeName: z.string().max(200).optional(),
        reporterName: z.string().max(200).optional(),
        reporterEmail: z.string().email().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const file = await prisma.file.findFirst({
      where: { id: body.data.fileId, project: { workspaceId: body.data.workspaceId } },
      include: { project: { include: { workspace: true } } },
    });
    if (!file) return c.json({ error: "File not found" }, 404);
    const auth = await loadProjectWithAuth(file.projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.settings.modules.issues) {
      return c.json({ error: "Issues are disabled for this project" }, 403);
    }
    if (!canCreateIssues(ctx)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const gate = requirePro(file.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const fv = await prisma.fileVersion.findFirst({
      where: { id: body.data.fileVersionId, fileId: file.id },
    });
    if (!fv) return c.json({ error: "File version not found" }, 404);

    if (await fileVersionWriteBlocked(fv.id, c.get("user").id)) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    const rfiIdsToLink = [
      ...new Set([...(body.data.rfiIds ?? []), ...(body.data.rfiId ? [body.data.rfiId] : [])]),
    ];
    if (rfiIdsToLink.length > 0) {
      const linkRfis = await prisma.rfi.findMany({
        where: { id: { in: rfiIdsToLink }, projectId: file.projectId },
      });
      if (linkRfis.length !== rfiIdsToLink.length) {
        return c.json({ error: "One or more RFIs were not found in this project" }, 400);
      }
      if (linkRfis.some((r) => r.status === RfiStatus.CLOSED)) {
        return c.json({ error: "Cannot link a closed RFI" }, 400);
      }
    }

    if (body.data.assigneeId) {
      const a = await assertUserAssignableToProject(
        body.data.assigneeId,
        file.projectId,
        body.data.workspaceId,
      );
      if ("error" in a) return c.json({ error: a.error }, a.status);
    }

    if (body.data.assetId) {
      const ast = await prisma.asset.findFirst({
        where: { id: body.data.assetId, projectId: file.projectId },
      });
      if (!ast) return c.json({ error: "Asset not found on this project" }, 400);
    }

    const extEmail = body.data.externalAssigneeEmail?.trim();
    const extName = body.data.externalAssigneeName?.trim();

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

    const issue = await prisma.$transaction(async (tx) => {
      const iss = await tx.issue.create({
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
          ...(body.data.issueKind !== undefined ? { issueKind: body.data.issueKind } : {}),
          ...(body.data.assetId !== undefined ? { assetId: body.data.assetId } : {}),
          ...(extEmail
            ? {
                externalAssigneeEmail: extEmail,
                externalAssigneeName: extName || null,
              }
            : {}),
          ...(body.data.reporterName !== undefined ? { reporterName: body.data.reporterName } : {}),
          ...(body.data.reporterEmail !== undefined
            ? { reporterEmail: body.data.reporterEmail }
            : {}),
        },
      });
      if (rfiIdsToLink.length > 0) {
        await tx.rfiIssueLink.createMany({
          data: rfiIdsToLink.map((rfiId) => ({ rfiId, issueId: iss.id })),
          skipDuplicates: true,
        });
        for (const rfiId of rfiIdsToLink) {
          const linkRfi = await tx.rfi.findUnique({
            where: { id: rfiId },
            select: { fileId: true, fileVersionId: true },
          });
          if (linkRfi && !linkRfi.fileId && !linkRfi.fileVersionId) {
            await tx.rfi.update({
              where: { id: rfiId },
              data: {
                fileId: iss.fileId,
                fileVersionId: iss.fileVersionId,
                pageNumber: iss.pageNumber,
                pinNormX: null,
                pinNormY: null,
              },
            });
          }
        }
      }
      return tx.issue.findUniqueOrThrow({
        where: { id: iss.id },
        include: issueInclude,
      });
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
      const viewerParams = {
        issueId: issue.id,
        fileId: issue.fileId,
        fileVersionId: issue.fileVersionId,
        projectId: issue.projectId,
        fileName: issue.file.name,
        version: issue.fileVersion.version,
      };
      const viewerUrl = buildViewerIssueUrl(env, viewerParams);
      void sendIssueAssignedEmail(env, {
        assigneeEmail: issue.assignee.email,
        assignerName,
        issueTitle: issue.title,
        fileName: issue.file.name,
        viewerUrl,
      }).catch((e) => console.error("[issue-email]", e));
      void createUserNotifications({
        workspaceId: issue.workspaceId,
        projectId: issue.projectId,
        recipientUserIds: [issue.assigneeId],
        kind: "ISSUE_ASSIGNED",
        title: `Assigned: ${issue.title.length > 120 ? `${issue.title.slice(0, 120)}…` : issue.title}`,
        body: issue.file.name,
        href: buildViewerIssuePath(viewerParams),
        actorUserId: c.get("user").id,
      }).catch((e) => console.error("[issue-notification]", e));
    }

    if (extEmail) {
      const viewerParams = {
        issueId: issue.id,
        fileId: issue.fileId,
        fileVersionId: issue.fileVersionId,
        projectId: issue.projectId,
        fileName: issue.file.name,
        version: issue.fileVersion.version,
      };
      const viewerUrl = buildViewerIssueUrl(env, viewerParams);
      void sendIssueAssignedEmail(env, {
        assigneeEmail: extEmail,
        assignerName,
        issueTitle: issue.title,
        fileName: issue.file.name,
        viewerUrl,
      }).catch((e) => console.error("[issue-email-external]", e));
    }

    notifyIssues(issue.fileVersionId);
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
      notifyIssues(newFileVersionId);
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
      notifyIssues(newFileVersionId);
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
              issueKind: issue.issueKind,
              assetId: issue.assetId,
              externalAssigneeEmail: issue.externalAssigneeEmail,
              externalAssigneeName: issue.externalAssigneeName,
              reporterName: issue.reporterName,
              reporterEmail: issue.reporterEmail,
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

    notifyIssues(newFileVersionId);
    notifyIssues(body.data.fromFileVersionId);
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
        /** Replace RFIs linked to this issue (same project). */
        rfiIds: z.array(z.string()).max(50).optional(),
        issueKind: z.nativeEnum(IssueKind).optional(),
        assetId: z.string().nullable().optional(),
        externalAssigneeEmail: z.string().email().nullable().optional().or(z.literal("")),
        externalAssigneeName: z.string().max(200).nullable().optional(),
        acknowledgedAt: z.string().datetime().nullable().optional(),
        resolvedAt: z.string().datetime().nullable().optional(),
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

    if (body.data.assetId) {
      const ast = await prisma.asset.findFirst({
        where: { id: body.data.assetId, projectId: issue.projectId },
      });
      if (!ast) return c.json({ error: "Asset not found on this project" }, 400);
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

    const patchRfiIds = body.data.rfiIds !== undefined ? [...new Set(body.data.rfiIds)] : undefined;
    if (patchRfiIds !== undefined && patchRfiIds.length > 0) {
      const n = await prisma.rfi.count({
        where: { id: { in: patchRfiIds }, projectId: issue.projectId },
      });
      if (n !== patchRfiIds.length) {
        return c.json({ error: "One or more RFIs not found in this project" }, 400);
      }
    }

    const nextStatus = body.data.status;
    const shouldStampResolved =
      nextStatus === IssueStatus.RESOLVED || nextStatus === IssueStatus.CLOSED;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.issue.update({
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
          ...(body.data.issueKind !== undefined ? { issueKind: body.data.issueKind } : {}),
          ...(body.data.assetId !== undefined ? { assetId: body.data.assetId } : {}),
          ...(body.data.externalAssigneeEmail !== undefined
            ? {
                externalAssigneeEmail: body.data.externalAssigneeEmail?.trim()
                  ? body.data.externalAssigneeEmail.trim()
                  : null,
                externalAssigneeName: body.data.externalAssigneeName?.trim()
                  ? body.data.externalAssigneeName.trim()
                  : null,
              }
            : {}),
          ...(body.data.acknowledgedAt !== undefined
            ? {
                acknowledgedAt: body.data.acknowledgedAt
                  ? new Date(body.data.acknowledgedAt)
                  : null,
              }
            : {}),
          ...(body.data.resolvedAt !== undefined
            ? { resolvedAt: body.data.resolvedAt ? new Date(body.data.resolvedAt) : null }
            : {}),
          ...(shouldStampResolved && body.data.resolvedAt === undefined
            ? { resolvedAt: new Date() }
            : {}),
        },
      });
      if (patchRfiIds !== undefined) {
        await tx.rfiIssueLink.deleteMany({ where: { issueId: issue.id } });
        if (patchRfiIds.length > 0) {
          await tx.rfiIssueLink.createMany({
            data: patchRfiIds.map((rfiId) => ({ rfiId, issueId: issue.id })),
          });
        }
      }
      return tx.issue.findUniqueOrThrow({ where: { id: u.id }, include: issueInclude });
    });

    await logActivity(issue.workspaceId, ActivityType.ISSUE_UPDATED, {
      actorUserId: c.get("user").id,
      entityId: issue.id,
      projectId: issue.projectId,
      metadata: { title: updated.title },
    });

    const shouldNotifyAssignee =
      nextAssigneeId !== undefined && nextAssigneeId !== null && nextAssigneeId !== prevAssigneeId;

    if (shouldNotifyAssignee && updated.assigneeId && updated.assignee?.email) {
      const actor = await prisma.user.findUnique({
        where: { id: c.get("user").id },
        select: { name: true },
      });
      const assignerName = actor?.name?.trim() || "Someone";
      const viewerParams = {
        issueId: updated.id,
        fileId: updated.fileId,
        fileVersionId: updated.fileVersionId,
        projectId: updated.projectId,
        fileName: updated.file.name,
        version: updated.fileVersion.version,
      };
      const viewerUrl = buildViewerIssueUrl(env, viewerParams);
      void sendIssueAssignedEmail(env, {
        assigneeEmail: updated.assignee.email,
        assignerName,
        issueTitle: updated.title,
        fileName: updated.file.name,
        viewerUrl,
      }).catch((e) => console.error("[issue-email]", e));
      void createUserNotifications({
        workspaceId: updated.workspaceId,
        projectId: updated.projectId,
        recipientUserIds: [updated.assigneeId],
        kind: "ISSUE_ASSIGNED",
        title: `Assigned: ${updated.title.length > 120 ? `${updated.title.slice(0, 120)}…` : updated.title}`,
        body: updated.file.name,
        href: buildViewerIssuePath(viewerParams),
        actorUserId: c.get("user").id,
      }).catch((e) => console.error("[issue-notification]", e));
    }

    const prevExt = issue.externalAssigneeEmail?.trim() ?? "";
    const nextExt = updated.externalAssigneeEmail?.trim() ?? "";
    if (nextExt && nextExt !== prevExt) {
      const actor = await prisma.user.findUnique({
        where: { id: c.get("user").id },
        select: { name: true },
      });
      const assignerName = actor?.name?.trim() || "Someone";
      const viewerParams = {
        issueId: updated.id,
        fileId: updated.fileId,
        fileVersionId: updated.fileVersionId,
        projectId: updated.projectId,
        fileName: updated.file.name,
        version: updated.fileVersion.version,
      };
      const viewerUrl = buildViewerIssueUrl(env, viewerParams);
      void sendIssueAssignedEmail(env, {
        assigneeEmail: nextExt,
        assignerName,
        issueTitle: updated.title,
        fileName: updated.file.name,
        viewerUrl,
      }).catch((e) => console.error("[issue-email-external]", e));
    }

    notifyIssues(issue.fileVersionId);
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

    notifyIssues(issue.fileVersionId);
    return c.json({ ok: true as const });
  });
}
