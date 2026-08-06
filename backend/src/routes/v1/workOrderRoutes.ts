import { randomBytes } from "node:crypto";
import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  ActivityType,
  AssetMeterType,
  InspectionRunStatus,
  IssueKind,
  IssuePriority,
  IssueStatus,
  Prisma,
  WorkOrderType,
} from "@prisma/client";
import { parseProjectSettingsJson } from "../../lib/projectSettings.js";
import { Resend } from "resend";
import { prisma } from "../../lib/prisma.js";
import { isWorkspaceOmBilling } from "../../lib/subscription.js";
import { loadProjectWithAuth } from "../../lib/permissions.js";
import { assertUserAssignableToProject } from "../../lib/projectAccess.js";
import type { Env } from "../../lib/env.js";
import { logActivity, logActivitySafe } from "../../lib/activity.js";
import { inviteFromAddress } from "../../lib/inviteEmail.js";
import { buildTransactionalEmailHtml } from "../../lib/transactionalEmailLayout.js";
import {
  parsePartsUsedJson,
  parseWorkOrderProcedure,
  parseWorkOrderProcedureResults,
  partsUsedToJsonValue,
  procedureResultsToJsonValue,
  validateProcedureCompletion,
} from "../../lib/workOrderChecklist.js";
import { resolveSourceInspectionRunId } from "../../lib/workOrderInspectionLink.js";
import { troubleshootWorkOrderWithAi } from "../../lib/workOrderAi.js";
import { parseReferencePhotos } from "../../lib/issueReferencePhotos.js";

function requireOmBilling(workspace: { subscriptionStatus: string | null }) {
  if (!isWorkspaceOmBilling(workspace)) {
    return { error: "O&M plan required", status: 402 as const };
  }
  return null;
}

function zodErrorMessage(flatten: ReturnType<z.ZodError<unknown>["flatten"]>): string {
  const fieldMsg = Object.values(flatten.fieldErrors)
    .flat()
    .find((m): m is string => typeof m === "string" && m.length > 0);
  if (fieldMsg) return fieldMsg;
  const formMsg = flatten.formErrors.find(
    (m): m is string => typeof m === "string" && m.length > 0,
  );
  return formMsg ?? "Invalid request";
}

async function getDefaultFileVersionForProject(projectId: string) {
  const file = await prisma.file.findFirst({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!file?.versions[0]) return null;
  return {
    fileId: file.id,
    fileVersionId: file.versions[0]!.id,
    fileVersion: file.versions[0]!,
    file,
  };
}

async function createMeterTriggeredWorkOrder(opts: {
  schedule: {
    id: string;
    title: string;
    frequency: string;
    assetId: string;
    assignedToUserId: string | null;
    asset: { tag: string; name: string };
  };
  projectId: string;
  workspaceId: string;
  actorUserId: string;
  meterType: AssetMeterType;
  readingValue: number;
  threshold: number;
  defaultFv: {
    fileId: string;
    fileVersionId: string;
    fileVersion: { version: number };
    file: { name: string };
  } | null;
}): Promise<{ created: boolean; issueId: string }> {
  const existing = await prisma.issue.findFirst({
    where: {
      projectId: opts.projectId,
      issueKind: IssueKind.WORK_ORDER,
      maintenanceScheduleId: opts.schedule.id,
      status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
    },
    select: { id: true },
  });
  if (existing) return { created: false, issueId: existing.id };

  const title = opts.schedule.title.trim()
    ? `${opts.schedule.title.trim()} (meter)`
    : `PPM meter: ${opts.schedule.asset.tag}`;
  const description = `Meter-triggered maintenance for ${opts.schedule.asset.tag} (${opts.schedule.asset.name}). ${opts.meterType} reading ${opts.readingValue} reached threshold ${opts.threshold}. Schedule: ${opts.schedule.frequency}.`;

  const now = new Date();
  const issue = await prisma.issue.create({
    data: {
      workspaceId: opts.workspaceId,
      projectId: opts.projectId,
      ...(opts.defaultFv
        ? {
            fileId: opts.defaultFv.fileId,
            fileVersionId: opts.defaultFv.fileVersionId,
            sheetName: opts.defaultFv.file.name,
            sheetVersion: opts.defaultFv.fileVersion.version,
          }
        : { fileId: null, fileVersionId: null }),
      title,
      description,
      issueKind: IssueKind.WORK_ORDER,
      workOrderType: WorkOrderType.PREVENTIVE,
      assetId: opts.schedule.assetId,
      status: IssueStatus.OPEN,
      statusChangedAt: now,
      priority: IssuePriority.MEDIUM,
      creatorId: opts.actorUserId,
      assigneeId: opts.schedule.assignedToUserId,
      maintenanceScheduleId: opts.schedule.id,
      maintenanceDueAt: now,
    },
    select: { id: true },
  });
  return { created: true, issueId: issue.id };
}

function dateFromYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
}

function vendorJson(v: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  trade: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: v.id,
    name: v.name,
    email: v.email,
    phone: v.phone,
    trade: v.trade,
    notes: v.notes,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

function partJson(p: {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  reorderLevel: number;
  unitCost: Prisma.Decimal | null;
  location: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    quantity: p.quantity,
    reorderLevel: p.reorderLevel,
    unitCost: p.unitCost != null ? Number(p.unitCost) : null,
    location: p.location,
    notes: p.notes,
    lowStock: p.quantity <= p.reorderLevel,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function registerWorkOrderRoutes(r: Hono, needUser: MiddlewareHandler, env: Env) {
  // --- Vendors ---
  r.get("/projects/:projectId/om/vendors", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.vendor.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
    return c.json(rows.map(vendorJson));
  });

  r.post("/projects/:projectId/om/vendors", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        name: z.string().min(1).max(200),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().max(80).optional(),
        trade: z.string().max(120).optional(),
        notes: z.string().max(2000).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: zodErrorMessage(body.error.flatten()) }, 400);

    const row = await prisma.vendor.create({
      data: {
        projectId,
        name: body.data.name.trim(),
        email: body.data.email?.trim() || null,
        phone: body.data.phone?.trim() || null,
        trade: body.data.trade?.trim() || null,
        notes: body.data.notes?.trim() || null,
      },
    });
    return c.json(vendorJson(row));
  });

  r.patch("/projects/:projectId/om/vendors/:vendorId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const vendorId = c.req.param("vendorId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        email: z.string().email().nullable().optional().or(z.literal("")),
        phone: z.string().max(80).nullable().optional(),
        trade: z.string().max(120).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: zodErrorMessage(body.error.flatten()) }, 400);

    const existing = await prisma.vendor.findFirst({ where: { id: vendorId, projectId } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const row = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(body.data.name !== undefined ? { name: body.data.name.trim() } : {}),
        ...(body.data.email !== undefined
          ? { email: body.data.email?.trim() ? body.data.email.trim() : null }
          : {}),
        ...(body.data.phone !== undefined
          ? { phone: body.data.phone?.trim() ? body.data.phone.trim() : null }
          : {}),
        ...(body.data.trade !== undefined
          ? { trade: body.data.trade?.trim() ? body.data.trade.trim() : null }
          : {}),
        ...(body.data.notes !== undefined
          ? { notes: body.data.notes?.trim() ? body.data.notes.trim() : null }
          : {}),
      },
    });
    return c.json(vendorJson(row));
  });

  r.delete("/projects/:projectId/om/vendors/:vendorId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const vendorId = c.req.param("vendorId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.vendor.findFirst({ where: { id: vendorId, projectId } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    await prisma.vendor.delete({ where: { id: vendorId } });
    return c.json({ ok: true });
  });

  /** Create work order from tenant request (keeps occupant issue in inbox). */
  r.post(
    "/projects/:projectId/om/work-orders/from-occupant/:occupantIssueId",
    needUser,
    async (c) => {
      const projectId = c.req.param("projectId")!;
      const occupantIssueId = c.req.param("occupantIssueId")!;
      const auth = await loadProjectWithAuth(projectId, c.get("user").id);
      if ("error" in auth) return c.json({ error: auth.error }, auth.status);
      const { ctx } = auth;
      if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
      if (!ctx.project.operationsMode || !ctx.settings.modules.issues) {
        return c.json({ error: "Work orders are not enabled" }, 403);
      }
      const gate = requireOmBilling(ctx.project.workspace);
      if (gate) return c.json({ error: gate.error }, gate.status);

      const occ = await prisma.issue.findFirst({
        where: { id: occupantIssueId, projectId, issueKind: IssueKind.OCCUPANT },
      });
      if (!occ) return c.json({ error: "Tenant request not found" }, 404);
      if (!occ.assetId) {
        return c.json(
          { error: "Tenant request has no linked asset — assign equipment first" },
          400,
        );
      }

      const body = z
        .object({
          title: z.string().min(1).max(500).optional(),
          assigneeId: z.string().optional(),
          vendorId: z.string().optional(),
          dueDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .safeParse(await c.req.json().catch(() => ({})));
      if (!body.success) return c.json({ error: body.error.flatten() }, 400);

      if (body.data.assigneeId) {
        const a = await assertUserAssignableToProject(
          body.data.assigneeId,
          projectId,
          ctx.project.workspaceId,
        );
        if ("error" in a) return c.json({ error: a.error }, a.status);
      }

      if (body.data.vendorId?.trim()) {
        const v = await prisma.vendor.findFirst({
          where: { id: body.data.vendorId.trim(), projectId },
        });
        if (!v) return c.json({ error: "Vendor not found" }, 400);
      }

      const title =
        body.data.title?.trim() ||
        (occ.title.trim() ? occ.title.trim() : `Tenant request: ${occ.reporterName ?? "occupant"}`);

      const wo = await prisma.$transaction(async (tx) => {
        const created = await tx.issue.create({
          data: {
            workspaceId: ctx.project.workspaceId,
            projectId,
            fileId: occ.fileId,
            fileVersionId: occ.fileVersionId,
            sheetName: occ.sheetName,
            sheetVersion: occ.sheetVersion,
            pageNumber: occ.pageNumber,
            annotationId: occ.annotationId,
            title,
            description: occ.description,
            location: occ.location,
            referencePhotos: occ.referencePhotos ?? undefined,
            assigneeId: body.data.assigneeId ?? null,
            creatorId: c.get("user").id,
            status: IssueStatus.OPEN,
            statusChangedAt: new Date(),
            priority: occ.priority ?? IssuePriority.MEDIUM,
            issueKind: IssueKind.WORK_ORDER,
            workOrderType: WorkOrderType.OCCUPANT,
            assetId: occ.assetId,
            vendorId: body.data.vendorId?.trim() || null,
            sourceOccupantIssueId: occ.id,
            reporterName: occ.reporterName,
            reporterEmail: occ.reporterEmail,
            ...(body.data.dueDate ? { dueDate: dateFromYmd(body.data.dueDate) } : {}),
          },
        });
        await tx.issue.update({
          where: { id: occ.id },
          data: {
            status: IssueStatus.IN_PROGRESS,
            acknowledgedAt: occ.acknowledgedAt ?? new Date(),
          },
        });
        return created;
      });

      await logActivity(ctx.project.workspaceId, ActivityType.ISSUE_CREATED, {
        actorUserId: c.get("user").id,
        entityId: wo.id,
        projectId,
        metadata: { title: wo.title, fromOccupantIssueId: occ.id },
      });

      return c.json({ id: wo.id, title: wo.title, sourceOccupantIssueId: occ.id });
    },
  );

  /** Complete work order with checklist, labor, and parts. */
  r.post("/projects/:projectId/om/work-orders/:issueId/complete", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const issueId = c.req.param("issueId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const issue = await prisma.issue.findFirst({
      where: { id: issueId, projectId, issueKind: IssueKind.WORK_ORDER },
    });
    if (!issue) return c.json({ error: "Work order not found" }, 404);

    const body = z
      .object({
        procedureResultJson: z.array(z.unknown()).max(50).optional(),
        laborMinutes: z.number().int().min(0).max(100_000).optional(),
        partsUsedJson: z.array(z.unknown()).max(30).optional(),
        // fallow-ignore-next-line code-duplication
        completionNotes: z.string().max(4000).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const procedure = parseWorkOrderProcedure(issue.procedureJson);
    const results = body.data.procedureResultJson
      ? parseWorkOrderProcedureResults(body.data.procedureResultJson)
      : parseWorkOrderProcedureResults(issue.procedureResultJson);

    const checklistErr = validateProcedureCompletion(procedure, results);
    if (checklistErr) return c.json({ error: checklistErr }, 400);

    if (issue.completionEvidenceRequired) {
      const photos = parseReferencePhotos(issue.referencePhotos);
      if (photos.length === 0) {
        return c.json({ error: "Completion photo evidence is required" }, 400);
      }
    }

    const partsUsed = body.data.partsUsedJson ? parsePartsUsedJson(body.data.partsUsedJson) : [];

    const now = new Date();
    const sourceRunId =
      issue.workOrderType === WorkOrderType.INSPECTION_FOLLOWUP
        ? resolveSourceInspectionRunId(issue)
        : null;

    const { updated, reInspectRunId } = await prisma.$transaction(async (tx) => {
      for (const part of partsUsed) {
        if (!part.inventoryItemId) continue;
        const item = await tx.partsInventoryItem.findFirst({
          where: { id: part.inventoryItemId, projectId },
        });
        if (!item) continue;
        const nextQty = Math.max(0, item.quantity - Math.round(part.qty));
        await tx.partsInventoryItem.update({
          where: { id: item.id },
          data: { quantity: nextQty },
        });
      }

      const wo = await tx.issue.update({
        where: { id: issueId },
        data: {
          status: IssueStatus.RESOLVED,
          statusChangedAt: now,
          resolvedAt: now,
          completedById: c.get("user").id,
          procedureResultJson:
            results.length > 0
              ? procedureResultsToJsonValue(results)
              : (issue.procedureResultJson ?? undefined),
          laborMinutes: body.data.laborMinutes ?? issue.laborMinutes,
          partsUsedJson:
            partsUsed.length > 0
              ? partsUsedToJsonValue(partsUsed)
              : (issue.partsUsedJson ?? undefined),
          ...(body.data.completionNotes?.trim()
            ? {
                description: issue.description
                  ? `${issue.description}\n\n--- Completion ---\n${body.data.completionNotes.trim()}`
                  : body.data.completionNotes.trim(),
              }
            : {}),
        },
      });

      let nextRunId: string | null = null;
      if (sourceRunId) {
        const src = await tx.inspectionRun.findFirst({
          where: { id: sourceRunId, projectId },
          select: { templateId: true, assetId: true, projectId: true },
        });
        if (src) {
          const draft = await tx.inspectionRun.create({
            data: {
              projectId: src.projectId,
              templateId: src.templateId,
              assetId: src.assetId,
              status: InspectionRunStatus.DRAFT,
              resultJson: [],
              createdById: c.get("user").id,
            },
            select: { id: true },
          });
          nextRunId = draft.id;
        }
      }

      return { updated: wo, reInspectRunId: nextRunId };
    });

    await logActivity(auth.ctx.project.workspaceId, ActivityType.ISSUE_UPDATED, {
      actorUserId: c.get("user").id,
      entityId: issueId,
      projectId,
      metadata: {
        workOrderCompleted: true,
        laborMinutes: updated.laborMinutes,
        ...(reInspectRunId ? { reInspectRunId } : {}),
      },
    });

    return c.json({
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      reInspectRunId,
    });
  });

  /** Email vendor a magic link to view / update the work order. */
  r.post("/projects/:projectId/om/work-orders/:issueId/vendor-link", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const issueId = c.req.param("issueId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const issue = await prisma.issue.findFirst({
      where: { id: issueId, projectId, issueKind: IssueKind.WORK_ORDER },
      include: { vendor: true, asset: true },
    });
    if (!issue) return c.json({ error: "Work order not found" }, 404);

    const email = issue.vendor?.email?.trim() || issue.externalAssigneeEmail?.trim() || null;
    if (!email) {
      return c.json({ error: "Assign a vendor with email or external assignee email first" }, 400);
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 14);

    await prisma.issue.update({
      where: { id: issueId },
      data: { vendorAccessToken: token, vendorAccessTokenExpiresAt: expiresAt },
    });

    const base = env.PUBLIC_APP_URL?.trim() || "https://app.plansync.io";
    const link = `${base.replace(/\/$/, "")}/vendor-work-order/${token}`;

    const key = env.RESEND_API_KEY?.trim();
    const from = inviteFromAddress(env);
    if (key && from) {
      const resend = new Resend(key);
      const assetLabel = issue.asset ? `${issue.asset.tag} — ${issue.asset.name}` : "Equipment";
      await resend.emails.send({
        from,
        to: email,
        subject: `Work order: ${issue.title.slice(0, 80)}`,
        html: buildTransactionalEmailHtml(env, {
          eyebrow: "O&M",
          title: "Work order assigned",
          bodyLines: [
            `You have been assigned a maintenance work order for ${assetLabel}.`,
            issue.title,
            "Link expires in 14 days.",
          ],
          primaryAction: { url: link, label: "View work order" },
          fallbackUrl: link,
        }),
        text: `Work order: ${issue.title}\nEquipment: ${assetLabel}\nOpen: ${link}`,
      });
    }

    return c.json({
      ok: true,
      link,
      emailed: Boolean(key && from),
      expiresAt: expiresAt.toISOString(),
    });
  });

  /** AI troubleshooting from asset context + manuals list. */
  r.post("/projects/:projectId/om/work-orders/:issueId/ai-troubleshoot", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const issueId = c.req.param("issueId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const issue = await prisma.issue.findFirst({
      where: { id: issueId, projectId, issueKind: IssueKind.WORK_ORDER },
      include: {
        asset: {
          include: { documents: { select: { label: true, fileName: true } } },
        },
      },
    });
    if (!issue || !issue.asset) {
      return c.json({ error: "Work order with linked asset required" }, 400);
    }

    try {
      const result = await troubleshootWorkOrderWithAi(env, {
        assetTag: issue.asset.tag,
        assetName: issue.asset.name,
        category: issue.asset.category,
        manufacturer: issue.asset.manufacturer,
        model: issue.asset.model,
        workOrderTitle: issue.title,
        workOrderDescription: issue.description,
        documentLabels: issue.asset.documents.map((d) =>
          d.label.trim() ? d.label.trim() : d.fileName,
        ),
      });
      return c.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI troubleshoot failed";
      return c.json({ error: msg }, 503);
    }
  });

  // --- Parts inventory ---
  r.get("/projects/:projectId/om/parts-inventory", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.partsInventoryItem.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
    return c.json(rows.map(partJson));
  });

  r.post("/projects/:projectId/om/parts-inventory", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        name: z.string().min(1).max(200),
        sku: z.string().max(80).optional(),
        quantity: z.number().int().min(0).optional(),
        reorderLevel: z.number().int().min(0).optional(),
        unitCost: z.number().min(0).optional(),
        location: z.string().max(200).optional(),
        // fallow-ignore-next-line code-duplication
        notes: z.string().max(2000).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const row = await prisma.partsInventoryItem.create({
      data: {
        projectId,
        name: body.data.name.trim(),
        sku: body.data.sku?.trim() || null,
        quantity: body.data.quantity ?? 0,
        reorderLevel: body.data.reorderLevel ?? 0,
        unitCost: body.data.unitCost != null ? body.data.unitCost : null,
        location: body.data.location?.trim() || null,
        notes: body.data.notes?.trim() || null,
      },
    });
    return c.json(partJson(row));
  });

  r.patch("/projects/:projectId/om/parts-inventory/:itemId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const itemId = c.req.param("itemId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        sku: z.string().max(80).nullable().optional(),
        quantity: z.number().int().min(0).optional(),
        reorderLevel: z.number().int().min(0).optional(),
        unitCost: z.number().min(0).nullable().optional(),
        location: z.string().max(200).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const existing = await prisma.partsInventoryItem.findFirst({
      where: { id: itemId, projectId },
    });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const row = await prisma.partsInventoryItem.update({
      where: { id: itemId },
      data: {
        ...(body.data.name !== undefined ? { name: body.data.name.trim() } : {}),
        ...(body.data.sku !== undefined ? { sku: body.data.sku?.trim() || null } : {}),
        ...(body.data.quantity !== undefined ? { quantity: body.data.quantity } : {}),
        ...(body.data.reorderLevel !== undefined ? { reorderLevel: body.data.reorderLevel } : {}),
        ...(body.data.unitCost !== undefined
          ? { unitCost: body.data.unitCost != null ? body.data.unitCost : null }
          : {}),
        ...(body.data.location !== undefined
          ? { location: body.data.location?.trim() || null }
          : {}),
        ...(body.data.notes !== undefined ? { notes: body.data.notes?.trim() || null } : {}),
      },
    });
    return c.json(partJson(row));
  });

  r.delete("/projects/:projectId/om/parts-inventory/:itemId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const itemId = c.req.param("itemId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.partsInventoryItem.findFirst({
      where: { id: itemId, projectId },
    });
    if (!existing) return c.json({ error: "Not found" }, 404);
    await prisma.partsInventoryItem.delete({ where: { id: itemId } });
    return c.json({ ok: true });
  });

  // --- Meter readings ---
  r.get("/projects/:projectId/om/assets/:assetId/meter-readings", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const assetId = c.req.param("assetId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
    if (!asset) return c.json({ error: "Asset not found" }, 404);

    const rows = await prisma.assetMeterReading.findMany({
      where: { assetId },
      orderBy: { recordedAt: "desc" },
      take: 50,
    });
    return c.json(
      rows.map((r) => ({
        id: r.id,
        meterType: r.meterType,
        label: r.label,
        value: Number(r.value),
        unit: r.unit,
        recordedAt: r.recordedAt.toISOString(),
      })),
    );
  });

  r.post("/projects/:projectId/om/assets/:assetId/meter-readings", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const assetId = c.req.param("assetId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
    if (!asset) return c.json({ error: "Asset not found" }, 404);

    const body = z
      .object({
        meterType: z.nativeEnum(AssetMeterType),
        label: z.string().max(120).optional(),
        value: z.number(),
        // fallow-ignore-next-line code-duplication
        unit: z.string().max(40).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const row = await prisma.assetMeterReading.create({
      data: {
        assetId,
        meterType: body.data.meterType,
        label: body.data.label?.trim() || null,
        value: body.data.value,
        unit: body.data.unit?.trim() || null,
        recordedByUserId: c.get("user").id,
      },
    });

    const settings = parseProjectSettingsJson(auth.ctx.project.settingsJson);
    const readingValue = Number(row.value);
    const triggered: { scheduleId: string; workOrderId: string; created: boolean }[] = [];

    const schedules = await prisma.maintenanceSchedule.findMany({
      where: {
        assetId,
        isActive: true,
        meterType: body.data.meterType,
        meterThreshold: { not: null },
      },
      include: { asset: { select: { tag: true, name: true } } },
    });

    const defaultFv =
      settings.modules.issues && auth.ctx.project.operationsMode
        ? await getDefaultFileVersionForProject(projectId)
        : null;

    for (const sched of schedules) {
      if (!sched.meterThreshold || readingValue < Number(sched.meterThreshold)) continue;

      await logActivitySafe(
        auth.ctx.project.workspaceId,
        ActivityType.MAINTENANCE_SCHEDULE_UPDATED,
        {
          actorUserId: c.get("user").id,
          entityType: "MaintenanceSchedule",
          entityId: sched.id,
          projectId,
          metadata: {
            meterThresholdExceeded: true,
            reading: readingValue,
            threshold: Number(sched.meterThreshold),
          },
        },
      );

      if (!settings.modules.issues) continue;

      const made = await createMeterTriggeredWorkOrder({
        schedule: sched,
        projectId,
        workspaceId: auth.ctx.project.workspaceId,
        actorUserId: c.get("user").id,
        meterType: body.data.meterType,
        readingValue,
        threshold: Number(sched.meterThreshold),
        defaultFv,
      });
      triggered.push({
        scheduleId: sched.id,
        workOrderId: made.issueId,
        created: made.created,
      });
      if (made.created) {
        await logActivity(auth.ctx.project.workspaceId, ActivityType.ISSUE_CREATED, {
          actorUserId: c.get("user").id,
          entityId: made.issueId,
          projectId,
          metadata: { meterTriggered: true, scheduleId: sched.id, reading: readingValue },
        });
      }
    }

    return c.json({
      id: row.id,
      meterType: row.meterType,
      value: readingValue,
      recordedAt: row.recordedAt.toISOString(),
      triggeredSchedules: triggered,
      workOrdersCreated: triggered.filter((t) => t.created).length,
    });
  });

  /** Monday UTC week start for `YYYY-MM-DD` bucketing. */
  function mondayWeekStartYmd(d: Date): string {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = x.getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    x.setUTCDate(x.getUTCDate() + diff);
    return x.toISOString().slice(0, 10);
  }

  function lastNWeekStarts(n: number): string[] {
    const anchor = mondayWeekStartYmd(new Date());
    const anchorMs = Date.parse(`${anchor}T00:00:00.000Z`);
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      out.push(new Date(anchorMs - i * 7 * 86_400_000).toISOString().slice(0, 10));
    }
    return out;
  }

  /** Maintenance analytics: MTTR, costs, PM compliance. */
  r.get("/projects/:projectId/om/reports/maintenance", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    if (auth.ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!auth.ctx.project.operationsMode) {
      return c.json({ error: "Operations mode is not enabled" }, 403);
    }
    const gate = requireOmBilling(auth.ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const resolvedWos = await prisma.issue.findMany({
      where: {
        projectId,
        issueKind: IssueKind.WORK_ORDER,
        status: { in: [IssueStatus.RESOLVED, IssueStatus.CLOSED] },
        resolvedAt: { not: null },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        resolvedAt: true,
        laborMinutes: true,
        partsUsedJson: true,
        asset: { select: { tag: true, name: true } },
      },
      orderBy: { resolvedAt: "desc" },
      take: 200,
    });

    let totalMttrHours = 0;
    let mttrCount = 0;
    let totalLaborMinutes = 0;
    let totalPartsCost = 0;
    const byAsset = new Map<string, { tag: string; name: string; count: number; cost: number }>();

    for (const wo of resolvedWos) {
      if (wo.resolvedAt) {
        const hrs = (wo.resolvedAt.getTime() - wo.createdAt.getTime()) / 3_600_000;
        if (hrs >= 0) {
          totalMttrHours += hrs;
          mttrCount++;
        }
      }
      totalLaborMinutes += wo.laborMinutes ?? 0;
      const parts = parsePartsUsedJson(wo.partsUsedJson);
      let woCost = 0;
      for (const p of parts) {
        woCost += (p.unitCost ?? 0) * p.qty;
      }
      totalPartsCost += woCost;
      if (wo.asset) {
        const key = wo.asset.tag;
        const cur = byAsset.get(key) ?? {
          tag: wo.asset.tag,
          name: wo.asset.name,
          count: 0,
          cost: 0,
        };
        cur.count++;
        cur.cost += woCost;
        byAsset.set(key, cur);
      }
    }

    const completions = await prisma.maintenanceCompletion.findMany({
      where: { projectId },
      select: { completedAt: true, previousDueAt: true },
      orderBy: { completedAt: "desc" },
      take: 500,
    });
    let pmOnTime = 0;
    let pmLate = 0;
    for (const cpl of completions) {
      if (!cpl.previousDueAt) continue;
      if (cpl.completedAt <= cpl.previousDueAt) pmOnTime++;
      else pmLate++;
    }
    const pmTotal = pmOnTime + pmLate;
    const pmCompliancePct = pmTotal === 0 ? 100 : Math.round((pmOnTime / pmTotal) * 100);

    const openBacklog = await prisma.issue.findMany({
      where: {
        projectId,
        issueKind: IssueKind.WORK_ORDER,
        status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
      },
      select: { id: true, title: true, createdAt: true, dueDate: true, priority: true },
      orderBy: { createdAt: "asc" },
    });
    const now = Date.now();
    const backlogAge = openBacklog.map((wo) => ({
      id: wo.id,
      title: wo.title,
      ageDays: Math.floor((now - wo.createdAt.getTime()) / 86_400_000),
      dueDate: wo.dueDate?.toISOString() ?? null,
      priority: wo.priority,
      overdue: wo.dueDate ? wo.dueDate.getTime() < now : false,
    }));

    const weekKeys = lastNWeekStarts(8);
    const weekBuckets = new Map(
      weekKeys.map((weekStart) => [
        weekStart,
        { weekStart, count: 0, laborHours: 0, partsCost: 0 },
      ]),
    );
    for (const wo of resolvedWos) {
      if (!wo.resolvedAt) continue;
      const ws = mondayWeekStartYmd(wo.resolvedAt);
      const bucket = weekBuckets.get(ws);
      if (!bucket) continue;
      bucket.count++;
      bucket.laborHours += (wo.laborMinutes ?? 0) / 60;
      const parts = parsePartsUsedJson(wo.partsUsedJson);
      for (const p of parts) {
        bucket.partsCost += (p.unitCost ?? 0) * p.qty;
      }
    }
    const completedByWeek = weekKeys.map((ws) => {
      const b = weekBuckets.get(ws)!;
      return {
        weekStart: b.weekStart,
        count: b.count,
        laborHours: Math.round(b.laborHours * 10) / 10,
        partsCost: Math.round(b.partsCost * 100) / 100,
      };
    });

    const backlogPriorityCounts = new Map<string, number>();
    for (const wo of openBacklog) {
      const p = wo.priority ?? IssuePriority.MEDIUM;
      backlogPriorityCounts.set(p, (backlogPriorityCounts.get(p) ?? 0) + 1);
    }
    const backlogByPriority = (
      [IssuePriority.LOW, IssuePriority.MEDIUM, IssuePriority.HIGH] as const
    ).map((priority) => ({
      priority,
      count: backlogPriorityCounts.get(priority) ?? 0,
    }));

    return c.json({
      mttrHours: mttrCount > 0 ? Math.round((totalMttrHours / mttrCount) * 10) / 10 : null,
      totalLaborHours: Math.round((totalLaborMinutes / 60) * 10) / 10,
      totalPartsCost: Math.round(totalPartsCost * 100) / 100,
      pmCompliancePct,
      pmCompletionsOnTime: pmOnTime,
      pmCompletionsLate: pmLate,
      topAssetsByCost: [...byAsset.values()].sort((a, b) => b.cost - a.cost).slice(0, 10),
      completedByWeek,
      backlogByPriority,
      backlog: backlogAge,
      recentCompleted: resolvedWos.slice(0, 20).map((wo) => ({
        id: wo.id,
        title: wo.title,
        assetTag: wo.asset?.tag ?? null,
        resolvedAt: wo.resolvedAt?.toISOString() ?? null,
        laborMinutes: wo.laborMinutes,
      })),
    });
  });
}

/** Public vendor work order portal (no session). */
export function registerVendorWorkOrderPublicRoutes(r: Hono) {
  r.get("/vendor-work-order/:token/meta", async (c) => {
    const token = c.req.param("token")!;
    const issue = await prisma.issue.findFirst({
      where: {
        vendorAccessToken: token,
        issueKind: IssueKind.WORK_ORDER,
      },
      include: {
        asset: { select: { tag: true, name: true, locationLabel: true } },
        project: { select: { name: true } },
      },
    });
    if (!issue) return c.json({ error: "Invalid or expired link" }, 404);
    if (issue.vendorAccessTokenExpiresAt && issue.vendorAccessTokenExpiresAt < new Date()) {
      return c.json({ error: "This link has expired" }, 403);
    }

    return c.json({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      dueDate: issue.dueDate?.toISOString() ?? null,
      location: issue.location,
      projectName: issue.project.name,
      asset: issue.asset,
      procedureJson: parseWorkOrderProcedure(issue.procedureJson),
    });
  });

  r.patch("/vendor-work-order/:token", async (c) => {
    const token = c.req.param("token")!;
    const issue = await prisma.issue.findFirst({
      where: { vendorAccessToken: token, issueKind: IssueKind.WORK_ORDER },
    });
    if (!issue) return c.json({ error: "Invalid or expired link" }, 404);
    if (issue.vendorAccessTokenExpiresAt && issue.vendorAccessTokenExpiresAt < new Date()) {
      return c.json({ error: "This link has expired" }, 403);
    }

    const body = z
      .object({
        status: z.enum(["IN_PROGRESS", "RESOLVED"]).optional(),
        completionNotes: z.string().max(4000).optional(),
        // fallow-ignore-next-line code-duplication
        procedureResultJson: z.array(z.unknown()).max(50).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const procedure = parseWorkOrderProcedure(issue.procedureJson);
    const results = body.data.procedureResultJson
      ? parseWorkOrderProcedureResults(body.data.procedureResultJson)
      : [];

    if (body.data.status === "RESOLVED") {
      const err = validateProcedureCompletion(procedure, results);
      if (err) return c.json({ error: err }, 400);
    }

    const now = new Date();
    const statusChanging = Boolean(body.data.status && body.data.status !== issue.status);
    const updated = await prisma.issue.update({
      where: { id: issue.id },
      data: {
        ...(body.data.status ? { status: body.data.status as IssueStatus } : {}),
        ...(statusChanging ? { statusChangedAt: now } : {}),
        ...(body.data.status === "RESOLVED" ? { resolvedAt: now } : {}),
        ...(results.length > 0
          ? { procedureResultJson: procedureResultsToJsonValue(results) }
          : {}),
        ...(body.data.completionNotes?.trim()
          ? {
              description: issue.description
                ? `${issue.description}\n\n--- Vendor completion ---\n${body.data.completionNotes.trim()}`
                : body.data.completionNotes.trim(),
            }
          : {}),
      },
    });

    return c.json({
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    });
  });
}
