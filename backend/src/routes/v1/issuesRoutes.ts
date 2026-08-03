import { randomUUID } from "node:crypto";
import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  ActivityType,
  IssueKind,
  IssuePriority,
  IssueStatus,
  MaintenanceFrequency,
  Prisma,
  RfiStatus,
  WorkOrderType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { fileVersionWriteBlocked } from "../../lib/fileVersionLock.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectForMember, assertUserAssignableToProject } from "../../lib/projectAccess.js";
import {
  canCreateIssues,
  issuesWhereForAuth,
  loadProjectWithAuth,
  type ProjectAuthContext,
} from "../../lib/permissions.js";
import { logActivity } from "../../lib/activity.js";
import type { Env } from "../../lib/env.js";
import {
  buildIssueReferencePhotoKey,
  newUploadId,
  s3KeyMatchesIssueReferencePhoto,
} from "../../lib/fileUpload.js";
import {
  deleteObject,
  presignGetDownloadResponse,
  presignPutUploadResponse,
} from "../../lib/s3.js";
import {
  deliverIssueAssignedNotify,
  flushPendingIssueAssignedNotify,
  scheduleIssueAssignedNotify,
} from "../../lib/notifyIssueAssigned.js";
import { broadcastViewerState } from "../../lib/viewerCollabHub.js";
import { collaborationGloballyEnabled } from "../../lib/viewerCollabPolicy.js";
import {
  ALLOWED_ISSUE_PHOTO_CONTENT_TYPES,
  issuePhotosStorageBytes,
  MAX_ISSUE_PHOTO_BYTES,
  MAX_ISSUE_PHOTO_SKETCH_BYTES,
  MAX_ISSUE_REFERENCE_PHOTOS,
  parseReferencePhotos,
  referencePhotosToJsonValue,
  sketchJsonByteSize,
  type IssueReferencePhotoParsed,
} from "../../lib/issueReferencePhotos.js";
import {
  commentAuthorInclude,
  simpleCommentJson,
  userPublicSelect,
} from "../../lib/userCommentJson.js";
import {
  parsePartsUsedJson,
  parseWorkOrderProcedure,
  parseWorkOrderProcedureResults,
  partsUsedToJsonValue,
  procedureResultsToJsonValue,
  procedureToJsonValue,
  type WorkOrderChecklistItem,
  type WorkOrderChecklistResult,
  type WorkOrderPartUsed,
} from "../../lib/workOrderChecklist.js";

function requirePro(workspace: { subscriptionStatus: string | null }) {
  if (!isWorkspacePro(workspace)) {
    return { error: "Pro subscription required", status: 402 as const };
  }
  return null;
}

const VALID_ISSUE_KIND_QUERY = new Set<string>(["CONSTRUCTION", "WORK_ORDER", "OCCUPANT"]);

/** Single `issueKind` or comma-separated `issueKinds=WORK_ORDER,OCCUPANT`. */
function parseIssueKindsFromQuery(c: {
  req: { query: (name: string) => string | undefined };
}): IssueKind[] | undefined {
  const multi = c.req.query("issueKinds")?.trim();
  if (multi) {
    const parts = multi
      .split(/,/g)
      .map((s) => s.trim())
      .filter(Boolean);
    const out: IssueKind[] = [];
    for (const p of parts) {
      if (VALID_ISSUE_KIND_QUERY.has(p)) out.push(p as IssueKind);
    }
    const uniq = [...new Set(out)];
    return uniq.length ? uniq : undefined;
  }
  const one = c.req.query("issueKind")?.trim();
  if (one && VALID_ISSUE_KIND_QUERY.has(one)) return [one as IssueKind];
  return undefined;
}

function issueKindWhere(kinds: IssueKind[] | undefined): Prisma.IssueWhereInput {
  if (!kinds?.length) return {};
  if (kinds.length === 1) return { issueKind: kinds[0] };
  return { issueKind: { in: kinds } };
}

/** Parse `YYYY-MM-DD` from client date inputs; noon UTC avoids TZ edge shifts. */
function dateFromYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function frequencyToNextFrom(
  frequency: MaintenanceFrequency,
  intervalDays: number | null,
  from: Date,
): Date {
  switch (frequency) {
    case MaintenanceFrequency.DAILY:
      return addDays(from, 1);
    case MaintenanceFrequency.WEEKLY:
      return addDays(from, 7);
    case MaintenanceFrequency.BIWEEKLY:
      return addDays(from, 14);
    case MaintenanceFrequency.MONTHLY:
      return addDays(from, 30);
    case MaintenanceFrequency.QUARTERLY:
      return addDays(from, 90);
    case MaintenanceFrequency.SEMI_ANNUAL:
      return addDays(from, 182);
    case MaintenanceFrequency.ANNUAL:
      return addDays(from, 365);
    case MaintenanceFrequency.CUSTOM:
      return addDays(from, Math.max(1, intervalDays ?? 30));
    default:
      return addDays(from, 30);
  }
}

const issueInclude = {
  assignee: { select: userPublicSelect },
  creator: { select: userPublicSelect },
  completedBy: { select: userPublicSelect },
  asset: { select: { id: true, tag: true, name: true } },
  vendor: { select: { id: true, name: true, email: true, trade: true } },
  file: { select: { name: true } },
  fileVersion: { select: { version: true } },
  rfiLinks: {
    include: {
      rfi: { select: { id: true, rfiNumber: true, title: true, status: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  _count: { select: { comments: true } },
} as const;

type IssueRow = Prisma.IssueGetPayload<{ include: typeof issueInclude }>;
const CARRY_FORWARD_META_KEY = "__carryForwardFromFileVersionId";

async function issueDisplayNumbersForProject(projectId: string): Promise<Map<string, number>> {
  const chron = await prisma.issue.findMany({
    where: { projectId },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return new Map(chron.map((row, i) => [row.id, i + 1]));
}

async function issueRowJsonWithDisplay(row: IssueRow, opts?: { maskPortalReporter?: boolean }) {
  const displayNums = await issueDisplayNumbersForProject(row.projectId);
  return issueRowJson(row, {
    ...opts,
    displayNumber: displayNums.get(row.id) ?? null,
  });
}

async function issueRowsToJson(rows: IssueRow[], projectId: string, maskPortalReporter: boolean) {
  const displayNums = await issueDisplayNumbersForProject(projectId);
  return rows.map((row) =>
    issueRowJson(row, {
      maskPortalReporter,
      displayNumber: displayNums.get(row.id) ?? null,
    }),
  );
}

type IssueAccessResult =
  | { ok: false; status: 402 | 403 | 404; error: string }
  | {
      ok: true;
      issue: {
        id: string;
        projectId: string;
        workspaceId: string;
        fileVersionId?: string | null;
        title?: string;
      };
      ctx: ProjectAuthContext;
    };

async function authorizeIssueAccess(
  issueId: string,
  userId: string,
  select: { id: true; projectId: true; workspaceId: true; fileVersionId?: true; title?: true },
): Promise<IssueAccessResult> {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select });
  if (!issue) return { ok: false, status: 404, error: "Not found" };
  const auth = await loadProjectWithAuth(issue.projectId, userId);
  if ("error" in auth) return { ok: false, status: auth.status, error: auth.error };
  const { ctx } = auth;
  if (!ctx.settings.modules.issues) return { ok: false, status: 404, error: "Not found" };
  const gate = requirePro(ctx.project.workspace);
  if (gate) return { ok: false, status: gate.status, error: gate.error };
  const scope = issuesWhereForAuth(ctx, userId);
  const allowed = await prisma.issue.count({
    where: { id: issueId, projectId: issue.projectId, ...scope },
  });
  if (allowed === 0) return { ok: false, status: 404, error: "Not found" };
  return { ok: true, issue, ctx };
}

const issueCommentReadSelect = {
  id: true,
  projectId: true,
  workspaceId: true,
} as const;

const issueCommentWriteSelect = {
  ...issueCommentReadSelect,
  fileVersionId: true,
  title: true,
} as const;

async function loadIssueCommentAccess(
  c: { req: { param: (name: string) => string }; get: (key: "user") => { id: string } },
  select: typeof issueCommentReadSelect | typeof issueCommentWriteSelect,
): Promise<IssueAccessResult> {
  return authorizeIssueAccess(c.req.param("issueId")!, c.get("user").id, select);
}

// fallow-ignore-next-line complexity
function issueRowJson(
  row: IssueRow,
  opts?: { maskPortalReporter?: boolean; displayNumber?: number | null },
) {
  const mask =
    Boolean(opts?.maskPortalReporter) &&
    row.issueKind === IssueKind.OCCUPANT &&
    Boolean(row.reporterEmail || row.reporterName);
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
    bimAnchor: row.bimAnchor ?? null,
    attachedMarkupAnnotationIds: parseAttachedMarkupAnnotationIds(row.attachedMarkupAnnotationIds),
    referencePhotos: parseReferencePhotos(row.referencePhotos),
    sheetName: row.sheetName ?? row.file?.name ?? null,
    sheetVersion: row.sheetVersion ?? row.fileVersion?.version ?? null,
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
    file: row.file ? { name: row.file.name } : null,
    fileVersion: row.fileVersion ? { version: row.fileVersion.version } : null,
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
    reporterName: mask ? null : row.reporterName,
    reporterEmail: mask ? null : row.reporterEmail,
    maintenanceScheduleId: row.maintenanceScheduleId,
    maintenanceDueAt: row.maintenanceDueAt ? row.maintenanceDueAt.toISOString() : null,
    workOrderType: row.workOrderType,
    procedureJson: parseWorkOrderProcedure(row.procedureJson),
    procedureResultJson: parseWorkOrderProcedureResults(row.procedureResultJson),
    laborMinutes: row.laborMinutes,
    partsUsedJson: parsePartsUsedJson(row.partsUsedJson),
    completedById: row.completedById,
    completedBy: row.completedBy
      ? {
          id: row.completedBy.id,
          name: row.completedBy.name,
          email: row.completedBy.email,
          image: row.completedBy.image,
        }
      : null,
    vendorId: row.vendorId,
    vendor: row.vendor
      ? {
          id: row.vendor.id,
          name: row.vendor.name,
          email: row.vendor.email,
          trade: row.vendor.trade,
        }
      : null,
    sourceOccupantIssueId: row.sourceOccupantIssueId,
    completionEvidenceRequired: row.completionEvidenceRequired,
    hasVendorAccessLink: Boolean(row.vendorAccessToken),
    displayNumber: opts?.displayNumber ?? null,
    commentCount: row._count?.comments ?? 0,
  };
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

/** Normalized list of viewer annotation ids for markups linked to an issue (not the pin). */
function parseAttachedMarkupAnnotationIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === "string" && x.trim()) out.push(x.trim());
  }
  return [...new Set(out)].slice(0, 30);
}

/** Annotation ids to drop from `FileVersion.annotationBlob` when an issue is deleted (pin + linked markups). */
function annotationIdsToRemoveForDeletedIssue(
  issueId: string,
  issueAnnotationId: string | null | undefined,
  attachedMarkupAnnotationIdsJson: unknown,
  blobAnnotations: unknown[],
): Set<string> {
  const ids = new Set<string>();
  const pin = typeof issueAnnotationId === "string" ? issueAnnotationId.trim() : "";
  if (pin) ids.add(pin);
  for (const id of parseAttachedMarkupAnnotationIds(attachedMarkupAnnotationIdsJson)) {
    ids.add(id);
  }
  for (const ann of blobAnnotations) {
    if (!ann || typeof ann !== "object") continue;
    const o = ann as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const linked = typeof o.linkedIssueId === "string" ? o.linkedIssueId : null;
    if (linked === issueId && id) ids.add(id);
  }
  return ids;
}

function stripIssueLinkedAnnotationsFromViewerBlob(
  blobUnknown: unknown,
  issueId: string,
  issueAnnotationId: string | null | undefined,
  attachedMarkupAnnotationIdsJson: unknown,
): Prisma.InputJsonValue | null {
  const blobObj = asObject(blobUnknown) ?? {};
  const annotations = Array.isArray(blobObj.annotations) ? blobObj.annotations : [];
  const idsToRemove = annotationIdsToRemoveForDeletedIssue(
    issueId,
    issueAnnotationId,
    attachedMarkupAnnotationIdsJson,
    annotations,
  );
  const nextAnnotations = annotations.filter((ann) => {
    if (!ann || typeof ann !== "object") return true;
    const o = ann as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    if (!id) return true;
    return !idsToRemove.has(id);
  });
  if (nextAnnotations.length === annotations.length) return null;
  return { ...blobObj, annotations: nextAnnotations } as Prisma.InputJsonValue;
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
    const access = await loadProjectWithAuth(fv.file.projectId, c.get("user").id);
    if ("error" in access) return c.json({ error: access.error }, access.status);
    if (!access.ctx.settings.modules.issues) {
      return c.json([]);
    }
    const gate = requirePro(access.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const kinds = parseIssueKindsFromQuery(c);
    const kindClause = issueKindWhere(kinds);
    const scope = issuesWhereForAuth(access.ctx, c.get("user").id);

    const rows = await prisma.issue.findMany({
      where: { fileVersionId, ...kindClause, ...scope },
      include: issueInclude,
      orderBy: { createdAt: "desc" },
    });
    const mask = access.ctx.workspaceMember.isExternal;
    return c.json(await issueRowsToJson(rows, fv.file.projectId, mask));
  });

  // fallow-ignore-next-line complexity
  r.get("/projects/:projectId/issues", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const fileVersionId = c.req.query("fileVersionId")?.trim() || undefined;
    const assetIdFilter = c.req.query("assetId")?.trim() || undefined;
    const kinds = parseIssueKindsFromQuery(c);
    const kindClause = issueKindWhere(kinds);
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
    const assigneeFilter = c.req.query("assignee")?.trim();
    const dueToday = c.req.query("dueToday") === "true";
    const overdueOnly = c.req.query("overdueOnly") === "true";
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const rows = await prisma.issue.findMany({
      where: {
        projectId,
        ...(fileVersionId ? { fileVersionId } : {}),
        ...(assetIdFilter ? { assetId: assetIdFilter } : {}),
        ...(assigneeFilter === "me" ? { assigneeId: userId } : {}),
        ...(dueToday
          ? {
              dueDate: { gte: todayStart, lt: todayEnd },
              status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
            }
          : {}),
        ...(overdueOnly
          ? {
              dueDate: { lt: todayStart },
              status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
            }
          : {}),
        ...kindClause,
        ...scope,
      },
      include: issueInclude,
      orderBy: { createdAt: "desc" },
    });
    const mask = ctx.workspaceMember.isExternal;
    return c.json(await issueRowsToJson(rows, projectId, mask));
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
    const mask = ctx.workspaceMember.isExternal;
    return c.json(await issueRowJsonWithDisplay(row, { maskPortalReporter: mask }));
  });

  // fallow-ignore-next-line complexity
  r.post("/issues/:issueId/reference-photos/presign", needUser, async (c) => {
    const issueId = c.req.param("issueId")!;
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        projectId: true,
        workspaceId: true,
        fileVersionId: true,
        referencePhotos: true,
      },
    });
    if (!issue) return c.json({ error: "Not found" }, 404);
    const auth = await loadProjectWithAuth(issue.projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.settings.modules.issues) {
      return c.json({ error: "Not found" }, 404);
    }
    if (!canCreateIssues(ctx)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const gate = requirePro(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    if (
      issue.fileVersionId &&
      (await fileVersionWriteBlocked(issue.fileVersionId, c.get("user").id))
    ) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    const existing = parseReferencePhotos(issue.referencePhotos);
    if (existing.length >= MAX_ISSUE_REFERENCE_PHOTOS) {
      return c.json(
        { error: `At most ${MAX_ISSUE_REFERENCE_PHOTOS} reference photos per issue` },
        400,
      );
    }

    const body = z
      .object({
        fileName: z.string().min(1),
        contentType: z.string().default("application/octet-stream"),
        sizeBytes: z.coerce.bigint(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const ct = body.data.contentType.trim().toLowerCase();
    if (!ALLOWED_ISSUE_PHOTO_CONTENT_TYPES.has(ct)) {
      return c.json(
        {
          error: "Only JPEG, PNG, WebP, GIF, or HEIC/HEIF images are allowed for reference photos",
        },
        400,
      );
    }

    if (body.data.sizeBytes <= 0n) {
      return c.json({ error: "File is empty" }, 400);
    }
    if (body.data.sizeBytes > MAX_ISSUE_PHOTO_BYTES) {
      return c.json({ error: "File too large (max 15 MB per reference photo)" }, 400);
    }

    const ws = ctx.project.workspace;
    const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
    if (newUsed > ws.storageQuotaBytes) {
      return c.json({ error: "Storage quota exceeded" }, 400);
    }

    const uploadId = newUploadId();
    const key = buildIssueReferencePhotoKey(
      ctx.project.workspaceId,
      issue.projectId,
      uploadId,
      body.data.fileName,
    );
    const presign = await presignPutUploadResponse(env, key, ct, "issue reference photo presign");
    if (!presign.ok) return c.json(presign.body, presign.status);
    return c.json({ uploadUrl: presign.uploadUrl, key: presign.key });
  });

  // fallow-ignore-next-line complexity
  r.post("/issues/:issueId/reference-photos/complete", needUser, async (c) => {
    const issueId = c.req.param("issueId")!;
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        projectId: true,
        workspaceId: true,
        fileVersionId: true,
        referencePhotos: true,
      },
    });
    if (!issue) return c.json({ error: "Not found" }, 404);
    const auth = await loadProjectWithAuth(issue.projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.settings.modules.issues) {
      return c.json({ error: "Not found" }, 404);
    }
    if (!canCreateIssues(ctx)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const gate = requirePro(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    if (
      issue.fileVersionId &&
      (await fileVersionWriteBlocked(issue.fileVersionId, c.get("user").id))
    ) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    const body = z
      .object({
        key: z.string().min(1),
        fileName: z.string().min(1),
        contentType: z.string().default("image/jpeg"),
        sizeBytes: z.coerce.bigint(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    if (body.data.sizeBytes <= 0n) {
      return c.json({ error: "File is empty" }, 400);
    }
    if (body.data.sizeBytes > MAX_ISSUE_PHOTO_BYTES) {
      return c.json({ error: "File too large (max 15 MB per reference photo)" }, 400);
    }

    if (!s3KeyMatchesIssueReferencePhoto(body.data.key, ctx.project.workspaceId, issue.projectId)) {
      return c.json({ error: "Invalid upload key" }, 400);
    }

    const ct = body.data.contentType.trim().toLowerCase();
    if (!ALLOWED_ISSUE_PHOTO_CONTENT_TYPES.has(ct)) {
      return c.json({ error: "Invalid content type for reference photo" }, 400);
    }

    const existing = parseReferencePhotos(issue.referencePhotos);
    if (existing.length >= MAX_ISSUE_REFERENCE_PHOTOS) {
      return c.json(
        { error: `At most ${MAX_ISSUE_REFERENCE_PHOTOS} reference photos per issue` },
        400,
      );
    }

    const ws = ctx.project.workspace;
    const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
    if (newUsed > ws.storageQuotaBytes) {
      return c.json({ error: "Storage quota exceeded" }, 400);
    }

    const photoId = randomUUID();
    const entry: IssueReferencePhotoParsed = {
      id: photoId,
      s3Key: body.data.key,
      fileName: body.data.fileName,
      contentType: ct,
      createdAt: new Date().toISOString(),
      sizeBytes: Number(
        body.data.sizeBytes > BigInt(Number.MAX_SAFE_INTEGER)
          ? BigInt(Number.MAX_SAFE_INTEGER)
          : body.data.sizeBytes,
      ),
    };

    const next = [...existing, entry];

    const updated = await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: ctx.project.workspaceId },
        data: { storageUsedBytes: { increment: body.data.sizeBytes } },
      });
      return tx.issue.update({
        where: { id: issue.id },
        data: { referencePhotos: referencePhotosToJsonValue(next) },
        include: issueInclude,
      });
    });

    // First photo after create: send deferred assign notify now so email/push include the snapshot.
    if (existing.length === 0) {
      flushPendingIssueAssignedNotify(env, issue.id, c.get("user").id);
    }

    if (updated.fileVersionId) notifyIssues(updated.fileVersionId);
    return c.json(
      await issueRowJsonWithDisplay(updated, {
        maskPortalReporter: ctx.workspaceMember.isExternal,
      }),
    );
  });

  r.get("/issues/:issueId/comments", needUser, async (c) => {
    const access = await loadIssueCommentAccess(c, issueCommentReadSelect);
    if (!access.ok) return c.json({ error: access.error }, access.status);

    const comments = await prisma.issueComment.findMany({
      where: { issueId: access.issue.id },
      orderBy: { createdAt: "asc" },
      include: commentAuthorInclude,
    });
    return c.json({ comments: comments.map(simpleCommentJson) });
  });

  r.post("/issues/:issueId/comments", needUser, async (c) => {
    const access = await loadIssueCommentAccess(c, issueCommentWriteSelect);
    if (!access.ok) return c.json({ error: access.error }, access.status);
    if (!canCreateIssues(access.ctx)) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json<{ body?: string }>();
    const text = body.body?.trim();
    if (!text) return c.json({ error: "body is required" }, 400);

    const issueId = access.issue.id;
    const comment = await prisma.issueComment.create({
      data: { issueId, authorId: c.get("user").id, body: text },
      include: commentAuthorInclude,
    });
    if (access.issue.fileVersionId) notifyIssues(access.issue.fileVersionId);
    return c.json({
      ...simpleCommentJson(comment),
      commentCount: await prisma.issueComment.count({ where: { issueId } }),
    });
  });

  r.get("/issues/:issueId/reference-photos/:photoId/presign-read", needUser, async (c) => {
    const issueId = c.req.param("issueId")!;
    const photoId = c.req.param("photoId")!;
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

    const photos = parseReferencePhotos(row.referencePhotos);
    const hit = photos.find((p) => p.id === photoId);
    if (!hit) return c.json({ error: "Not found" }, 404);

    const presign = await presignGetDownloadResponse(
      env,
      hit.s3Key,
      "issue reference photo presign-read",
    );
    if (!presign.ok) return c.json(presign.body, presign.status);
    return c.json({ url: presign.url });
  });

  // fallow-ignore-next-line complexity
  r.post("/issues", needUser, async (c) => {
    const optionalYmd = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional();
    const body = z
      .object({
        workspaceId: z.string(),
        /** Required when creating without a linked sheet. */
        projectId: z.string().optional(),
        fileId: z.string().optional(),
        fileVersionId: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        annotationId: z.string().optional(),
        /** Extra sheet markups (annotation ids) to associate with this issue (same revision). */
        attachedMarkupAnnotationIds: z.array(z.string().min(1)).max(30).optional(),
        assigneeId: z.string().optional(),
        status: z.nativeEnum(IssueStatus).optional(),
        priority: z.nativeEnum(IssuePriority).optional(),
        startDate: optionalYmd,
        dueDate: optionalYmd,
        location: z.string().max(500).nullable().optional(),
        pageNumber: z.number().int().min(1).optional(),
        /** 3D anchor for issues created from the BIM viewer (IFC GUID + context). */
        bimAnchor: z
          .object({
            ifcGuid: z.string().min(1).max(64),
            localId: z.number().int().optional(),
            name: z.string().max(300).optional(),
            ifcType: z.string().max(120).optional(),
            spatialPath: z.array(z.string().max(300)).max(20).optional(),
            position: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
            fileVersionId: z.string().max(64).optional(),
            /** Clash partner (item 2) — enables ghost + green/red on open. */
            ifcGuidB: z.string().min(1).max(64).optional(),
            nameB: z.string().max(300).optional(),
            ifcTypeB: z.string().max(120).optional(),
            fileVersionIdB: z.string().max(64).optional(),
          })
          .optional(),
        /** Link new issue to one or more project RFIs (merged with `rfiId` if both sent). */
        rfiId: z.string().optional(),
        rfiIds: z.array(z.string()).max(50).optional(),
        issueKind: z.nativeEnum(IssueKind).optional(),
        assetId: z.string().optional(),
        externalAssigneeEmail: z.string().email().optional().or(z.literal("")),
        externalAssigneeName: z.string().max(200).optional(),
        reporterName: z.string().max(200).optional(),
        reporterEmail: z.string().email().optional(),
        workOrderType: z.nativeEnum(WorkOrderType).optional(),
        procedureJson: z.array(z.unknown()).max(50).optional(),
        vendorId: z.string().optional(),
        sourceOccupantIssueId: z.string().optional(),
        completionEvidenceRequired: z.boolean().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const hasSheet = Boolean(body.data.fileId?.trim() || body.data.fileVersionId?.trim());
    if (hasSheet && (!body.data.fileId?.trim() || !body.data.fileVersionId?.trim())) {
      return c.json(
        { error: "fileId and fileVersionId must both be set when linking a sheet" },
        400,
      );
    }
    if (!hasSheet && !body.data.projectId?.trim()) {
      return c.json({ error: "projectId is required when no sheet is linked" }, 400);
    }

    let projectId: string;
    let file: { id: string; name: string; projectId: string } | null = null;
    let fv: { id: string; version: number } | null = null;

    if (hasSheet) {
      const fileRow = await prisma.file.findFirst({
        where: { id: body.data.fileId!, project: { workspaceId: body.data.workspaceId } },
        include: { project: { include: { workspace: true } } },
      });
      if (!fileRow) return c.json({ error: "File not found" }, 404);
      const fvRow = await prisma.fileVersion.findFirst({
        where: { id: body.data.fileVersionId!, fileId: fileRow.id },
      });
      if (!fvRow) return c.json({ error: "File version not found" }, 404);
      if (await fileVersionWriteBlocked(fvRow.id, c.get("user").id)) {
        return c.json({ error: "File is locked by another user" }, 409);
      }
      projectId = fileRow.projectId;
      file = { id: fileRow.id, name: fileRow.name, projectId: fileRow.projectId };
      fv = { id: fvRow.id, version: fvRow.version };
    } else {
      projectId = body.data.projectId!.trim();
    }

    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.project.workspaceId !== body.data.workspaceId) {
      return c.json({ error: "Project not found in workspace" }, 400);
    }
    if (!ctx.settings.modules.issues) {
      return c.json({ error: "Issues are disabled for this project" }, 403);
    }
    if (!canCreateIssues(ctx)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const gate = requirePro(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    if (body.data.issueKind === IssueKind.OCCUPANT) {
      return c.json({ error: "Tenant requests are created only through the occupant portal" }, 400);
    }

    if (body.data.pageNumber !== undefined && !hasSheet) {
      return c.json({ error: "pageNumber requires a linked sheet" }, 400);
    }
    if (body.data.bimAnchor !== undefined && !hasSheet) {
      return c.json({ error: "bimAnchor requires a linked model file" }, 400);
    }
    if (body.data.annotationId?.trim() && !hasSheet) {
      return c.json({ error: "annotationId requires a linked sheet" }, 400);
    }
    if ((body.data.attachedMarkupAnnotationIds?.length ?? 0) > 0 && !hasSheet) {
      return c.json({ error: "attachedMarkupAnnotationIds requires a linked sheet" }, 400);
    }

    const rfiIdsToLink = [
      ...new Set([...(body.data.rfiIds ?? []), ...(body.data.rfiId ? [body.data.rfiId] : [])]),
    ];
    if (rfiIdsToLink.length > 0) {
      const linkRfis = await prisma.rfi.findMany({
        where: { id: { in: rfiIdsToLink }, projectId },
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
        projectId,
        body.data.workspaceId,
      );
      if ("error" in a) return c.json({ error: a.error }, a.status);
    }

    if (body.data.assetId) {
      const ast = await prisma.asset.findFirst({
        where: { id: body.data.assetId, projectId },
      });
      if (!ast) return c.json({ error: "Asset not found on this project" }, 400);
    }

    if (body.data.vendorId?.trim()) {
      const v = await prisma.vendor.findFirst({
        where: { id: body.data.vendorId.trim(), projectId },
      });
      if (!v) return c.json({ error: "Vendor not found on this project" }, 400);
    }

    if (body.data.sourceOccupantIssueId?.trim()) {
      const occ = await prisma.issue.findFirst({
        where: {
          id: body.data.sourceOccupantIssueId.trim(),
          projectId,
          issueKind: IssueKind.OCCUPANT,
        },
      });
      if (!occ) return c.json({ error: "Tenant request not found" }, 400);
    }

    const procedureItems: WorkOrderChecklistItem[] = body.data.procedureJson
      ? parseWorkOrderProcedure(body.data.procedureJson)
      : [];

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

    const primaryAnnId = body.data.annotationId?.trim();
    const attachedCreate = parseAttachedMarkupAnnotationIds(
      body.data.attachedMarkupAnnotationIds ?? [],
    ).filter((id) => !primaryAnnId || id !== primaryAnnId);

    const issue = await prisma.$transaction(async (tx) => {
      const iss = await tx.issue.create({
        data: {
          workspaceId: body.data.workspaceId,
          projectId,
          ...(file && fv
            ? {
                fileId: file.id,
                fileVersionId: fv.id,
                sheetName: file.name,
                sheetVersion: fv.version,
              }
            : { fileId: null, fileVersionId: null }),
          title: body.data.title,
          description: body.data.description,
          annotationId: primaryAnnId,
          ...(attachedCreate.length > 0
            ? { attachedMarkupAnnotationIds: attachedCreate as unknown as Prisma.InputJsonValue }
            : {}),
          assigneeId: body.data.assigneeId,
          creatorId: c.get("user").id,
          status: body.data.status ?? IssueStatus.OPEN,
          priority: body.data.priority ?? IssuePriority.MEDIUM,
          ...(startDate !== undefined ? { startDate } : {}),
          ...(dueDate !== undefined ? { dueDate } : {}),
          ...(body.data.location !== undefined ? { location: body.data.location } : {}),
          ...(body.data.pageNumber !== undefined ? { pageNumber: body.data.pageNumber } : {}),
          ...(body.data.bimAnchor !== undefined
            ? { bimAnchor: body.data.bimAnchor as Prisma.InputJsonValue }
            : {}),
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
          ...(body.data.workOrderType !== undefined
            ? { workOrderType: body.data.workOrderType }
            : {}),
          ...(procedureItems.length > 0
            ? { procedureJson: procedureToJsonValue(procedureItems) }
            : {}),
          ...(body.data.vendorId?.trim() ? { vendorId: body.data.vendorId.trim() } : {}),
          ...(body.data.sourceOccupantIssueId?.trim()
            ? { sourceOccupantIssueId: body.data.sourceOccupantIssueId.trim() }
            : {}),
          ...(body.data.completionEvidenceRequired !== undefined
            ? { completionEvidenceRequired: body.data.completionEvidenceRequired }
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

    if (issue.fileId && issue.fileVersionId && issue.file && issue.fileVersion) {
      const notifyInternal = Boolean(issue.assigneeId && issue.assignee?.email);
      const notifyExternal = Boolean(extEmail);
      if (notifyInternal || notifyExternal) {
        scheduleIssueAssignedNotify(env, issue.id, c.get("user").id, {
          internal: notifyInternal,
          external: notifyExternal,
        });
      }
    }

    if (issue.fileVersionId) notifyIssues(issue.fileVersionId);
    return c.json(
      await issueRowJsonWithDisplay(issue, { maskPortalReporter: ctx.workspaceMember.isExternal }),
    );
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
              ...(parseAttachedMarkupAnnotationIds(issue.attachedMarkupAnnotationIds).length > 0
                ? {
                    attachedMarkupAnnotationIds: parseAttachedMarkupAnnotationIds(
                      issue.attachedMarkupAnnotationIds,
                    ) as unknown as Prisma.InputJsonValue,
                  }
                : {}),
              ...(parseReferencePhotos(issue.referencePhotos).length > 0
                ? {
                    referencePhotos: referencePhotosToJsonValue(
                      parseReferencePhotos(issue.referencePhotos),
                    ),
                  }
                : {}),
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

  // fallow-ignore-next-line complexity
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
    const issuePatchAuth = await loadProjectWithAuth(issue.projectId, c.get("user").id);
    if ("error" in issuePatchAuth)
      return c.json({ error: issuePatchAuth.error }, issuePatchAuth.status);
    if (!issuePatchAuth.ctx.settings.modules.issues) {
      return c.json({ error: "Not found" }, 404);
    }
    const gate = requirePro(issuePatchAuth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const issuePatchScope = issuesWhereForAuth(issuePatchAuth.ctx, c.get("user").id);
    const issuePatchAllowed = await prisma.issue.count({
      where: { id: issueId, projectId: issue.projectId, ...issuePatchScope },
    });
    if (issuePatchAllowed === 0) return c.json({ error: "Not found" }, 404);

    if (
      issue.fileVersionId &&
      (await fileVersionWriteBlocked(issue.fileVersionId, c.get("user").id))
    ) {
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
        /** Replace linked markup ids; send `null` to clear. Omit to leave unchanged. */
        attachedMarkupAnnotationIds: z.array(z.string().min(1)).max(30).nullable().optional(),
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
        /** Replace reference photos (S3 keys under this project). Send `null` to clear all. */
        referencePhotos: z
          .array(
            z.object({
              id: z.string().min(1).max(80),
              s3Key: z.string().min(1).max(500),
              fileName: z.string().min(1).max(220),
              contentType: z.string().max(120).optional(),
              createdAt: z.string().max(80).optional(),
              sizeBytes: z
                .number()
                .int()
                .min(0)
                .max(80 * 1024 * 1024)
                .optional(),
              sketch: z.union([z.unknown(), z.null()]).optional(),
            }),
          )
          .max(MAX_ISSUE_REFERENCE_PHOTOS)
          .nullable()
          .optional(),
        workOrderType: z.nativeEnum(WorkOrderType).nullable().optional(),
        procedureJson: z.array(z.unknown()).max(50).nullable().optional(),
        procedureResultJson: z.array(z.unknown()).max(50).nullable().optional(),
        laborMinutes: z.number().int().min(0).max(100_000).nullable().optional(),
        partsUsedJson: z.array(z.unknown()).max(30).nullable().optional(),
        vendorId: z.string().nullable().optional(),
        completionEvidenceRequired: z.boolean().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    if (body.data.issueKind !== undefined) {
      if (body.data.issueKind === IssueKind.OCCUPANT && issue.issueKind !== IssueKind.OCCUPANT) {
        return c.json({ error: "Cannot set issue kind to tenant request manually" }, 400);
      }
      if (issue.issueKind === IssueKind.OCCUPANT && body.data.issueKind !== IssueKind.WORK_ORDER) {
        return c.json(
          { error: "Tenant requests can only be promoted to internal work orders" },
          400,
        );
      }
      if (
        issue.issueKind === IssueKind.OCCUPANT &&
        body.data.issueKind === IssueKind.WORK_ORDER &&
        issuePatchAuth.ctx.workspaceMember.isExternal
      ) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }

    const prevPhotosForRef = parseReferencePhotos(issue.referencePhotos);
    let nextReferencePhotos: IssueReferencePhotoParsed[] | undefined;
    let photosToDeleteFromS3: IssueReferencePhotoParsed[] = [];
    let bytesRemovedFromPhotos = 0n;
    const refRaw = body.data.referencePhotos;
    if (refRaw !== undefined) {
      const incoming = refRaw === null ? [] : refRaw;
      const seenIds = new Set<string>();
      const seenKeys = new Set<string>();
      for (const row of incoming) {
        if (seenIds.has(row.id)) {
          return c.json({ error: "Duplicate reference photo id" }, 400);
        }
        seenIds.add(row.id);
        if (seenKeys.has(row.s3Key)) {
          return c.json({ error: "Duplicate reference photo storage key" }, 400);
        }
        seenKeys.add(row.s3Key);
        if (!s3KeyMatchesIssueReferencePhoto(row.s3Key, issue.workspaceId, issue.projectId)) {
          return c.json({ error: "Invalid reference photo storage key" }, 400);
        }
        const sk = row.sketch === null ? undefined : row.sketch;
        if (sk !== undefined && sketchJsonByteSize(sk) > MAX_ISSUE_PHOTO_SKETCH_BYTES) {
          return c.json({ error: "Reference photo sketch payload is too large" }, 400);
        }
      }
      nextReferencePhotos = incoming.map((r) => {
        const match = prevPhotosForRef.find((p) => p.id === r.id && p.s3Key === r.s3Key);
        const sizeBytes =
          typeof r.sizeBytes === "number" && r.sizeBytes > 0
            ? r.sizeBytes
            : (match?.sizeBytes ?? 0);
        const sketch =
          r.sketch === null ? undefined : r.sketch !== undefined ? r.sketch : match?.sketch;
        return {
          id: r.id,
          s3Key: r.s3Key,
          fileName: r.fileName,
          contentType: r.contentType,
          createdAt:
            (r.createdAt && r.createdAt.trim()) || match?.createdAt || new Date().toISOString(),
          sizeBytes,
          ...(sketch !== undefined ? { sketch } : {}),
        };
      });
      const nextKeys = new Set(nextReferencePhotos.map((p) => p.s3Key));
      photosToDeleteFromS3 = prevPhotosForRef.filter((p) => !nextKeys.has(p.s3Key));
      bytesRemovedFromPhotos = issuePhotosStorageBytes(photosToDeleteFromS3);
    }

    const prevAssigneeId = issue.assigneeId;
    const nextAssigneeId = body.data.assigneeId === undefined ? undefined : body.data.assigneeId;
    const nextAnnotationId =
      body.data.annotationId === undefined ? undefined : body.data.annotationId;
    const nextAttachedRaw = body.data.attachedMarkupAnnotationIds;
    const nextAttachedIds =
      nextAttachedRaw === undefined
        ? undefined
        : nextAttachedRaw === null
          ? null
          : parseAttachedMarkupAnnotationIds(nextAttachedRaw).filter(
              (id) => !issue.annotationId || id !== issue.annotationId,
            );

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

    if (body.data.vendorId) {
      const v = await prisma.vendor.findFirst({
        where: { id: body.data.vendorId, projectId: issue.projectId },
      });
      if (!v) return c.json({ error: "Vendor not found on this project" }, 400);
    }

    const nextProcedure =
      body.data.procedureJson === undefined
        ? undefined
        : body.data.procedureJson === null
          ? null
          : parseWorkOrderProcedure(body.data.procedureJson);
    const nextProcedureResults =
      body.data.procedureResultJson === undefined
        ? undefined
        : body.data.procedureResultJson === null
          ? null
          : parseWorkOrderProcedureResults(body.data.procedureResultJson);
    const nextPartsUsed =
      body.data.partsUsedJson === undefined
        ? undefined
        : body.data.partsUsedJson === null
          ? null
          : parsePartsUsedJson(body.data.partsUsedJson);

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

    const [fileFresh, fvFresh] =
      issue.fileId && issue.fileVersionId
        ? await Promise.all([
            prisma.file.findUnique({ where: { id: issue.fileId }, select: { name: true } }),
            prisma.fileVersion.findUnique({
              where: { id: issue.fileVersionId },
              select: { version: true },
            }),
          ])
        : [null, null];

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
      if (bytesRemovedFromPhotos > 0n) {
        await tx.workspace.update({
          where: { id: issue.workspaceId },
          data: { storageUsedBytes: { decrement: bytesRemovedFromPhotos } },
        });
      }
      const u = await tx.issue.update({
        where: { id: issue.id },
        data: {
          sheetName: fileFresh?.name ?? issue.file?.name ?? issue.sheetName,
          sheetVersion: fvFresh?.version ?? issue.fileVersion?.version ?? issue.sheetVersion,
          ...(body.data.status !== undefined ? { status: body.data.status } : {}),
          ...(body.data.title !== undefined ? { title: body.data.title } : {}),
          ...(body.data.description !== undefined ? { description: body.data.description } : {}),
          ...(nextAssigneeId !== undefined ? { assigneeId: nextAssigneeId } : {}),
          ...(nextAnnotationId !== undefined ? { annotationId: nextAnnotationId } : {}),
          ...(nextAttachedIds !== undefined
            ? {
                attachedMarkupAnnotationIds:
                  nextAttachedIds === null || nextAttachedIds.length === 0
                    ? null
                    : (nextAttachedIds as unknown as Prisma.InputJsonValue),
              }
            : {}),
          ...(nextReferencePhotos !== undefined
            ? {
                referencePhotos:
                  nextReferencePhotos.length === 0
                    ? null
                    : referencePhotosToJsonValue(nextReferencePhotos),
              }
            : {}),
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
          ...(body.data.workOrderType !== undefined
            ? { workOrderType: body.data.workOrderType }
            : {}),
          ...(nextProcedure !== undefined
            ? {
                procedureJson:
                  nextProcedure === null || nextProcedure.length === 0
                    ? null
                    : procedureToJsonValue(nextProcedure),
              }
            : {}),
          ...(nextProcedureResults !== undefined
            ? {
                procedureResultJson:
                  nextProcedureResults === null || nextProcedureResults.length === 0
                    ? null
                    : procedureResultsToJsonValue(nextProcedureResults),
              }
            : {}),
          ...(body.data.laborMinutes !== undefined ? { laborMinutes: body.data.laborMinutes } : {}),
          ...(nextPartsUsed !== undefined
            ? {
                partsUsedJson:
                  nextPartsUsed === null || nextPartsUsed.length === 0
                    ? null
                    : partsUsedToJsonValue(nextPartsUsed),
              }
            : {}),
          ...(body.data.vendorId !== undefined ? { vendorId: body.data.vendorId } : {}),
          ...(body.data.completionEvidenceRequired !== undefined
            ? { completionEvidenceRequired: body.data.completionEvidenceRequired }
            : {}),
          ...(shouldStampResolved && issue.issueKind === IssueKind.WORK_ORDER
            ? { completedById: c.get("user").id }
            : {}),
        } as Prisma.IssueUncheckedUpdateInput,
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

    const promotedToWo =
      issue.issueKind === IssueKind.OCCUPANT && body.data.issueKind === IssueKind.WORK_ORDER;
    const nextIssueStatus = updated.status;
    const transitionedToDone =
      issue.status !== IssueStatus.RESOLVED &&
      issue.status !== IssueStatus.CLOSED &&
      (nextIssueStatus === IssueStatus.RESOLVED || nextIssueStatus === IssueStatus.CLOSED);

    let maintenanceCompletionLogged = false;
    const maintenanceScheduleId = issue.maintenanceScheduleId;
    if (transitionedToDone && issue.issueKind === IssueKind.WORK_ORDER && maintenanceScheduleId) {
      const completedAt = new Date();
      const completion = await prisma.$transaction(async (tx) => {
        const already = await tx.maintenanceCompletion.findFirst({
          where: { workOrderId: issue.id },
          select: { id: true },
        });
        if (already) return null;

        const schedule = await tx.maintenanceSchedule.findFirst({
          where: { id: maintenanceScheduleId, asset: { projectId: issue.projectId } },
          include: { asset: { select: { id: true, tag: true, name: true } } },
        });
        if (!schedule) return null;

        const previousDueAt = schedule.nextDueAt;
        const canAdvance =
          schedule.nextDueAt &&
          issue.maintenanceDueAt &&
          schedule.nextDueAt.getTime() === issue.maintenanceDueAt.getTime();
        const nextDueAt = canAdvance
          ? frequencyToNextFrom(schedule.frequency, schedule.intervalDays, completedAt)
          : schedule.nextDueAt;

        if (canAdvance && nextDueAt) {
          await tx.maintenanceSchedule.update({
            where: { id: schedule.id },
            data: {
              lastCompletedAt: completedAt,
              nextDueAt,
            },
          });
        }

        return tx.maintenanceCompletion.create({
          data: {
            workspaceId: issue.workspaceId,
            projectId: issue.projectId,
            assetId: schedule.assetId,
            scheduleId: schedule.id,
            completedAt,
            completedByUserId: c.get("user").id,
            previousDueAt,
            nextDueAt,
            workOrderId: issue.id,
            vendorLabel: schedule.assignedVendorLabel ?? null,
          },
          select: { id: true, nextDueAt: true, previousDueAt: true, scheduleId: true },
        });
      });

      if (completion) {
        maintenanceCompletionLogged = true;
        await logActivity(issue.workspaceId, ActivityType.MAINTENANCE_SCHEDULE_COMPLETED, {
          actorUserId: c.get("user").id,
          entityType: "MaintenanceSchedule",
          entityId: completion.scheduleId,
          projectId: issue.projectId,
          metadata: {
            completionId: completion.id,
            workOrderId: issue.id,
            completedVia: "workOrder",
            previousDueAt: completion.previousDueAt?.toISOString() ?? null,
            nextDueAt: completion.nextDueAt?.toISOString() ?? null,
          },
        });
      }
    }

    await logActivity(issue.workspaceId, ActivityType.ISSUE_UPDATED, {
      actorUserId: c.get("user").id,
      entityId: issue.id,
      projectId: issue.projectId,
      metadata: {
        title: updated.title,
        ...(promotedToWo ? { occupantPromotedToWorkOrder: true } : {}),
        ...(maintenanceCompletionLogged ? { maintenanceCompletedViaWorkOrder: true } : {}),
      },
    });

    const shouldNotifyAssignee =
      nextAssigneeId !== undefined && nextAssigneeId !== null && nextAssigneeId !== prevAssigneeId;

    if (
      shouldNotifyAssignee &&
      updated.assigneeId &&
      updated.assignee?.email &&
      updated.fileId &&
      updated.fileVersionId &&
      updated.file &&
      updated.fileVersion
    ) {
      void deliverIssueAssignedNotify(env, updated.id, c.get("user").id, {
        internal: true,
        external: false,
      }).catch((e) => console.error("[issue-assign-notify]", e));
    }

    const prevExt = issue.externalAssigneeEmail?.trim() ?? "";
    const nextExt = updated.externalAssigneeEmail?.trim() ?? "";
    if (
      nextExt &&
      nextExt !== prevExt &&
      updated.fileId &&
      updated.fileVersionId &&
      updated.file &&
      updated.fileVersion
    ) {
      void deliverIssueAssignedNotify(env, updated.id, c.get("user").id, {
        internal: false,
        external: true,
      }).catch((e) => console.error("[issue-assign-notify-external]", e));
    }

    for (const p of photosToDeleteFromS3) {
      void deleteObject(env, p.s3Key).catch((e) =>
        console.error("[issue reference photo delete after patch]", p.s3Key, e),
      );
    }

    if (issue.fileVersionId) notifyIssues(issue.fileVersionId);
    return c.json(
      await issueRowJsonWithDisplay(updated, {
        maskPortalReporter: issuePatchAuth.ctx.workspaceMember.isExternal,
      }),
    );
  });

  r.delete("/issues/:issueId", needUser, async (c) => {
    const issueId = c.req.param("issueId")!;
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { workspace: true },
    });
    if (!issue) return c.json({ error: "Not found" }, 404);
    const delAccess = await loadProjectWithAuth(issue.projectId, c.get("user").id);
    if ("error" in delAccess) return c.json({ error: delAccess.error }, delAccess.status);
    if (!delAccess.ctx.settings.modules.issues) {
      return c.json({ error: "Not found" }, 404);
    }
    const gate = requirePro(delAccess.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);
    const delScope = issuesWhereForAuth(delAccess.ctx, c.get("user").id);
    const delAllowed = await prisma.issue.count({
      where: { id: issueId, projectId: issue.projectId, ...delScope },
    });
    if (delAllowed === 0) return c.json({ error: "Not found" }, 404);

    if (
      issue.fileVersionId &&
      (await fileVersionWriteBlocked(issue.fileVersionId, c.get("user").id))
    ) {
      return c.json({ error: "File is locked by another user" }, 409);
    }

    const title = issue.title;
    const photos = parseReferencePhotos(issue.referencePhotos);
    const photoBytes = issuePhotosStorageBytes(photos);

    const viewerRevision = await prisma.$transaction(async (tx) => {
      let rev: number | undefined;
      if (issue.fileVersionId) {
        const fv = await tx.fileVersion.findUnique({
          where: { id: issue.fileVersionId },
          select: { annotationBlob: true },
        });
        const nextBlob = stripIssueLinkedAnnotationsFromViewerBlob(
          fv?.annotationBlob,
          issueId,
          issue.annotationId,
          issue.attachedMarkupAnnotationIds,
        );
        if (nextBlob !== null) {
          const fvUp = await tx.fileVersion.update({
            where: { id: issue.fileVersionId },
            data: {
              annotationBlob: nextBlob,
              annotationBlobRevision: { increment: 1 },
            },
            select: { annotationBlobRevision: true },
          });
          rev = fvUp.annotationBlobRevision;
        }
      }
      await tx.issue.delete({ where: { id: issueId } });
      if (photoBytes > 0n) {
        await tx.workspace.update({
          where: { id: issue.workspaceId },
          data: { storageUsedBytes: { decrement: photoBytes } },
        });
      }
      return rev;
    });

    if (issue.fileVersionId && viewerRevision !== undefined && collaborationGloballyEnabled(env)) {
      broadcastViewerState(issue.fileVersionId, viewerRevision, c.get("user").id);
    }

    for (const p of photos) {
      void deleteObject(env, p.s3Key).catch((e) =>
        console.error("[issue reference photo delete on issue delete]", p.s3Key, e),
      );
    }

    await logActivity(issue.workspaceId, ActivityType.ISSUE_DELETED, {
      actorUserId: c.get("user").id,
      entityId: issueId,
      projectId: issue.projectId,
      metadata: { title },
    });

    if (issue.fileVersionId) notifyIssues(issue.fileVersionId);
    return c.json({ ok: true as const });
  });
}
