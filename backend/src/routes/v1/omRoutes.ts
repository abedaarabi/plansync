import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { randomBytes, randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import { z } from "zod";
import {
  ActivityType,
  InspectionRunStatus,
  IssueKind,
  IssuePriority,
  IssueStatus,
  MaintenanceFrequency,
  Prisma,
  PunchStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isWorkspaceOmBilling, isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectWithAuth } from "../../lib/permissions.js";
import { mergeProjectSettingsPatch, parseProjectSettingsJson } from "../../lib/projectSettings.js";
import { cloneSettingsJson } from "../../lib/takeoffPricing.js";
import type { Env } from "../../lib/env.js";
import { logActivity } from "../../lib/activity.js";
import { Resend } from "resend";
import { createUserNotifications } from "../../lib/userNotifications.js";
import {
  buildAssetDocumentKey,
  buildIssueReferencePhotoKey,
  newUploadId,
  s3KeyMatchesAssetDocument,
  s3KeyMatchesIssueReferencePhoto,
} from "../../lib/fileUpload.js";
import {
  ALLOWED_ISSUE_PHOTO_CONTENT_TYPES,
  MAX_ISSUE_PHOTO_BYTES,
  MAX_ISSUE_REFERENCE_PHOTOS,
  parseReferencePhotos,
  referencePhotosToJsonValue,
  type IssueReferencePhotoParsed,
} from "../../lib/issueReferencePhotos.js";
import { deleteObject, presignGet, presignPut } from "../../lib/s3.js";
import { broadcastIssuesChanged } from "../../lib/viewerCollabHub.js";
import { collaborationGloballyEnabled } from "../../lib/viewerCollabPolicy.js";
import { inviteFromAddress } from "../../lib/inviteEmail.js";
import { buildViewerIssuePath } from "../../lib/issueAssignEmail.js";
import { occupantSubmitRateLimited } from "../../lib/occupantSubmitRateLimit.js";
import { buildTransactionalEmailHtml } from "../../lib/transactionalEmailLayout.js";

function startOfUtcWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfUtcWeek(weekStart: Date): Date {
  const e = new Date(weekStart);
  e.setUTCDate(e.getUTCDate() + 7);
  return e;
}

function csvEscapeCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function requireOmBilling(workspace: {
  subscriptionStatus: string | null;
  billingPlan?: string | null;
}) {
  if (!isWorkspaceOmBilling(workspace)) {
    if (!isWorkspacePro(workspace)) {
      return { error: "Pro subscription required", status: 402 as const };
    }
    return {
      error:
        "PlanSync Enterprise is required for Operations & Maintenance. Upgrade under Dashboard → Billing (Enterprise includes O&M).",
      status: 402 as const,
    };
  }
  return null;
}

const MAX_ASSET_DOCUMENT_BYTES = 25 * 1024 * 1024;

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

/** PPM health: overdue | dueSoon | onTrack */
export function ppmHealthLabel(
  nextDueAt: Date | null,
  now = new Date(),
): "overdue" | "dueSoon" | "onTrack" {
  if (!nextDueAt) return "onTrack";
  const d0 = new Date(now);
  d0.setUTCHours(0, 0, 0, 0);
  const due = new Date(nextDueAt);
  due.setUTCHours(0, 0, 0, 0);
  if (due < d0) return "overdue";
  const soon = addDays(d0, 30);
  if (due <= soon) return "dueSoon";
  return "onTrack";
}

async function getDefaultFileVersion(projectId: string) {
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

const OCCUPANT_PHOTO_TOKEN_MS = 60 * 60 * 1000;

type OmAssetRowDb = Prisma.AssetGetPayload<{
  include: {
    file: { select: { id: true; name: true } };
    fileVersion: { select: { id: true; version: true } };
  };
}>;

function toOmAssetJson(a: OmAssetRowDb) {
  const {
    occupantScanSecret,
    installDate,
    warrantyExpires,
    lastServiceAt,
    createdAt,
    updatedAt,
    ...rest
  } = a;
  return {
    ...rest,
    hasOccupantQr: Boolean(occupantScanSecret),
    installDate: installDate?.toISOString() ?? null,
    warrantyExpires: warrantyExpires?.toISOString() ?? null,
    lastServiceAt: lastServiceAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

type InspectionRunWorkOrderContext = {
  id: string;
  fileId: string | null;
  fileVersionId: string | null;
  pageNumber: number | null;
  template: { name: string };
};

async function resolveInspectionRunDrawing(
  projectId: string,
  run: InspectionRunWorkOrderContext,
): Promise<
  | { ok: true; fileId: string; fileVersionId: string; pageNumber: number }
  | { ok: false; error: string }
> {
  let fileId = run.fileId;
  let fileVersionId = run.fileVersionId;
  let pageNumber = run.pageNumber ?? 1;
  if (!fileId || !fileVersionId) {
    const def = await getDefaultFileVersion(projectId);
    if (!def) return { ok: false, error: "No project drawing to attach" };
    fileId = def.fileId;
    fileVersionId = def.fileVersionId;
    pageNumber = 1;
  }
  return { ok: true, fileId, fileVersionId, pageNumber };
}

/** Create a work order issue linked to the inspection run’s sheet (or project default drawing). */
async function createInspectionRunWorkOrderIssue(
  projectId: string,
  workspaceId: string,
  userId: string,
  run: InspectionRunWorkOrderContext,
  params: { title: string; itemLabel: string; note?: string | null },
): Promise<{ id: string; title: string } | { error: string }> {
  const draw = await resolveInspectionRunDrawing(projectId, run);
  if (!draw.ok) return { error: draw.error };

  const file = await prisma.file.findFirst({
    where: { id: draw.fileId, projectId },
    include: { project: true },
  });
  if (!file) return { error: "File not found" };
  const fv = await prisma.fileVersion.findFirst({
    where: { id: draw.fileVersionId, fileId: file.id },
  });
  if (!fv) return { error: "File version not found" };

  const descLines = [
    `From inspection: ${run.template.name} (run ${run.id.slice(0, 8)}…)`,
    `Item: ${params.itemLabel}`,
  ];
  if (params.note?.trim()) descLines.push(`Note: ${params.note.trim()}`);

  const issue = await prisma.issue.create({
    data: {
      workspaceId,
      projectId,
      fileId: file.id,
      fileVersionId: fv.id,
      title: params.title.trim(),
      description: descLines.join("\n"),
      status: IssueStatus.OPEN,
      priority: IssuePriority.MEDIUM,
      pageNumber: draw.pageNumber,
      sheetName: file.name,
      sheetVersion: fv.version,
      issueKind: IssueKind.WORK_ORDER,
      creatorId: userId,
    },
  });

  return { id: issue.id, title: issue.title };
}

type InspectionRunForReportPdf = {
  id: string;
  status: string;
  resultJson: unknown;
  completedAt: Date | null;
  template: {
    name: string;
    description: string | null;
    frequency: string | null;
    checklistJson: unknown;
  };
  project: { name: string };
  file: { name: string } | null;
  fileVersion: { version: number } | null;
  signedOffBy: { name: string | null } | null;
};

function sortInspectionLevelKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const na = Number.parseInt(a, 10);
    const nb = Number.parseInt(b, 10);
    const aIsNum = !Number.isNaN(na) && String(na) === a.trim();
    const bIsNum = !Number.isNaN(nb) && String(nb) === b.trim();
    if (aIsNum && bIsNum) return na - nb;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return a.localeCompare(b);
  });
}

function inspectionDataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = /^data:image\/(png|jpe?g|webp);base64,([\s\S]+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return Buffer.from(m[2].replace(/\s/g, ""), "base64");
  } catch {
    return null;
  }
}

async function buildInspectionReportPdfBuffer(run: InspectionRunForReportPdf): Promise<Buffer> {
  const margin = 48;
  const checklistRaw = Array.isArray(run.template.checklistJson)
    ? (run.template.checklistJson as Array<{
        id?: string;
        label?: string;
        level?: string;
        type?: string;
      }>)
    : [];
  const checklist = checklistRaw.filter((it) => typeof it.id === "string" && it.id.length > 0);

  type ResultRow = {
    itemId?: string;
    outcome?: string;
    note?: string;
    photoDataUrl?: string;
    photoFileName?: string;
    value?: unknown;
  };
  const results = Array.isArray(run.resultJson) ? (run.resultJson as ResultRow[]) : [];

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({
    margin,
    size: "LETTER",
    info: { Title: `Inspection — ${run.template.name}`, Author: "PlanSync" },
  });
  doc.on("data", (b: Buffer) => chunks.push(b));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const contentW = doc.page.width - margin * 2;
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;

  const ensureSpace = (need: number) => {
    if (doc.y + need > pageBottom() - 8) {
      doc.addPage();
      doc.x = margin;
      doc.fillColor("#64748b").font("Helvetica").fontSize(8);
      doc.text(`${run.project.name} · ${run.template.name} (continued)`, margin, margin, {
        width: contentW,
      });
      doc.moveDown(1.2);
      doc.fillColor("#0f172a");
    }
  };

  // —— Cover banner ——
  const bannerH = 86;
  const y0 = margin;
  doc.save();
  doc.rect(margin, y0, contentW, bannerH).fill("#0f172a");
  doc.fillColor("#f8fafc").font("Helvetica-Bold").fontSize(22);
  doc.text("Inspection report", margin + 22, y0 + 20, { width: contentW - 44 });
  doc.font("Helvetica").fontSize(12).fillColor("#94a3b8");
  doc.text(run.template.name, margin + 22, y0 + 50, { width: contentW - 44 });
  doc.restore();
  doc.y = y0 + bannerH + 22;
  doc.x = margin;

  // —— Summary ——
  doc.font("Helvetica").fontSize(9).fillColor("#475569");
  const meta: string[] = [];
  meta.push(`Project: ${run.project.name}`);
  meta.push(`Checklist template: ${run.template.name}`);
  if (run.template.frequency?.trim()) meta.push(`Cadence: ${run.template.frequency.trim()}`);
  if (run.template.description?.trim())
    meta.push(`Template notes: ${run.template.description.trim()}`);
  if (run.file?.name) {
    const fv = run.fileVersion != null ? ` · Sheet version v${run.fileVersion.version}` : "";
    meta.push(`Linked drawing file: ${run.file.name}${fv}`);
  }
  if (run.completedAt) {
    meta.push(`Completed (UTC): ${run.completedAt.toISOString().replace("T", " ").slice(0, 19)}`);
  } else {
    meta.push(`Generated (UTC): ${new Date().toISOString().replace("T", " ").slice(0, 19)}`);
  }
  if (run.signedOffBy?.name?.trim()) meta.push(`Signed off by: ${run.signedOffBy.name.trim()}`);
  meta.push(`Status: ${run.status}`);
  meta.push(`Run ID: ${run.id}`);
  doc.text(meta.join("\n"), { width: contentW });
  doc.moveDown(1);
  doc
    .strokeColor("#e2e8f0")
    .lineWidth(1)
    .moveTo(margin, doc.y)
    .lineTo(margin + contentW, doc.y)
    .stroke();
  doc.moveDown(1);
  doc.fillColor("#0f172a");

  // —— Group by level ——
  const byLevel = new Map<string, typeof checklist>();
  for (const it of checklist) {
    const key =
      typeof it.level === "string" && it.level.trim().length > 0 ? it.level.trim() : "General";
    const list = byLevel.get(key) ?? [];
    list.push(it);
    byLevel.set(key, list);
  }
  const levelKeys = sortInspectionLevelKeys([...byLevel.keys()]);

  const outcomeLabel = (o: string) =>
    o === "pass" ? "PASS" : o === "fail" ? "FAIL" : o === "na" ? "N/A" : "—";
  const outcomeColor = (o: string) =>
    o === "pass" ? "#059669" : o === "fail" ? "#dc2626" : o === "na" ? "#64748b" : "#94a3b8";

  let itemNum = 0;
  for (const levelKey of levelKeys) {
    const items = byLevel.get(levelKey) ?? [];
    ensureSpace(40);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1d4ed8");
    const levelHeading =
      Number.isFinite(Number(levelKey)) && String(Number(levelKey)) === levelKey.trim()
        ? `LEVEL ${levelKey}`
        : levelKey.toUpperCase();
    doc.text(levelHeading, { width: contentW });
    doc.moveDown(0.5);
    doc.fillColor("#0f172a").font("Helvetica");

    for (const item of items) {
      itemNum += 1;
      const res = results.find((r) => r.itemId === item.id);
      const oc = (res?.outcome ?? "").toLowerCase();
      const note = typeof res?.note === "string" ? res.note.trim() : "";
      const photo = typeof res?.photoDataUrl === "string" ? res.photoDataUrl : "";
      const photoFile =
        typeof res?.photoFileName === "string" && res.photoFileName.trim()
          ? res.photoFileName.trim()
          : "";

      ensureSpace(56);
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#0f172a");
      doc.text(`${itemNum}. ${item.label ?? item.id ?? "Item"}`, { width: contentW });
      doc.moveDown(0.35);
      doc.font("Helvetica").fontSize(9);
      doc
        .fillColor(outcomeColor(oc))
        .font("Helvetica-Bold")
        .text(`Outcome: ${outcomeLabel(oc)}`, {
          width: contentW,
        });
      doc.fillColor("#334155").font("Helvetica").moveDown(0.4);

      if (note) {
        ensureSpace(28);
        doc.fontSize(9).text(`Notes: ${note}`, { width: contentW });
        doc.moveDown(0.45);
      }

      if (photo.startsWith("data:image")) {
        const buf = inspectionDataUrlToBuffer(photo);
        if (buf) {
          ensureSpace(photoFile ? 230 : 210);
          if (photoFile) {
            doc.fontSize(8).fillColor("#475569").text(`Photo file name: ${photoFile}`, {
              width: contentW,
            });
            doc.moveDown(0.25);
          }
          try {
            doc.image(buf, margin, doc.y, {
              fit: [contentW, 200],
              align: "center",
            });
            doc.moveDown(0.4);
          } catch {
            doc
              .fillColor("#94a3b8")
              .fontSize(8)
              .text(
                "A photo was saved for this item but could not be embedded in this PDF (format).",
                { width: contentW },
              );
            doc.moveDown(0.35);
          }
          doc.fillColor("#0f172a");
        }
      }

      doc.moveDown(0.35);
      doc
        .strokeColor("#f1f5f9")
        .lineWidth(0.5)
        .moveTo(margin, doc.y)
        .lineTo(margin + contentW, doc.y)
        .stroke();
      doc.moveDown(0.55);
    }
  }

  doc.end();
  return done;
}

async function tryEmailInspectionReportToBuildingOwner(opts: {
  env: Env;
  to: string;
  projectName: string;
  templateName: string;
  completedAt: Date;
  signedByName: string | null;
  pdfBuffer: Buffer;
  runId: string;
}): Promise<{ ok: true } | { ok: false; reason: "resend_not_configured" | "send_failed" }> {
  const key = opts.env.RESEND_API_KEY?.trim();
  const from = inviteFromAddress(opts.env);
  if (!key || !from) return { ok: false, reason: "resend_not_configured" };

  const resend = new Resend(key);
  const filename = `inspection-${opts.runId.slice(0, 8)}.pdf`;
  const subject = `Inspection report: ${opts.templateName} — ${opts.projectName}`;
  const lines = [
    `A completed inspection report is attached for ${opts.projectName}.`,
    `Template: ${opts.templateName}`,
    `Completed (UTC): ${opts.completedAt.toISOString().replace("T", " ").slice(0, 19)}`,
  ];
  if (opts.signedByName?.trim()) lines.push(`Signed off by: ${opts.signedByName.trim()}`);

  const html = buildTransactionalEmailHtml(opts.env, {
    eyebrow: "PlanSync",
    title: "Inspection report",
    bodyLines: lines,
  });

  const text = [...lines, "", `PDF attached: ${filename}`].join("\n");

  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject,
    html,
    text,
    attachments: [{ filename, content: opts.pdfBuffer.toString("base64") }],
  });
  if (error) {
    console.error("[inspection-report-email]", error.message);
    return { ok: false, reason: "send_failed" };
  }
  return { ok: true };
}

export function registerOmRoutes(r: Hono, needUser: MiddlewareHandler, env: Env) {
  // --- Assets ---
  r.get("/projects/:projectId/om/assets", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
      return c.json({ error: "Operations assets are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const qRaw = c.req.query("q")?.trim();
    const searchWhere =
      qRaw && qRaw.length > 0
        ? {
            OR: [
              { tag: { contains: qRaw, mode: "insensitive" as const } },
              { name: { contains: qRaw, mode: "insensitive" as const } },
              { manufacturer: { contains: qRaw, mode: "insensitive" as const } },
              { model: { contains: qRaw, mode: "insensitive" as const } },
              { serialNumber: { contains: qRaw, mode: "insensitive" as const } },
              { locationLabel: { contains: qRaw, mode: "insensitive" as const } },
              { notes: { contains: qRaw, mode: "insensitive" as const } },
              { category: { contains: qRaw, mode: "insensitive" as const } },
              { file: { name: { contains: qRaw, mode: "insensitive" as const } } },
            ],
          }
        : {};

    const rows = await prisma.asset.findMany({
      where: { projectId, ...searchWhere },
      orderBy: [{ tag: "asc" }],
      include: {
        file: { select: { id: true, name: true } },
        fileVersion: { select: { id: true, version: true } },
      },
    });
    return c.json(rows.map(toOmAssetJson));
  });

  r.post("/projects/:projectId/om/assets", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
      return c.json({ error: "Operations assets are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        tag: z.string().min(1).max(80),
        name: z.string().min(1).max(500),
        category: z.string().max(120).nullable().optional(),
        manufacturer: z.string().max(200).nullable().optional(),
        model: z.string().max(200).nullable().optional(),
        serialNumber: z.string().max(200).nullable().optional(),
        locationLabel: z.string().max(500).nullable().optional(),
        installDate: z.string().datetime().nullable().optional(),
        warrantyExpires: z.string().datetime().nullable().optional(),
        lastServiceAt: z.string().datetime().nullable().optional(),
        notes: z.string().max(5000).nullable().optional(),
        fileId: z.string().nullable().optional(),
        fileVersionId: z.string().nullable().optional(),
        pageNumber: z.number().int().min(1).nullable().optional(),
        annotationId: z.string().nullable().optional(),
        pinJson: z.unknown().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const d = body.data;

    if (d.fileId && d.fileVersionId) {
      const fv = await prisma.fileVersion.findFirst({
        where: { id: d.fileVersionId, fileId: d.fileId, file: { projectId } },
      });
      if (!fv) return c.json({ error: "File version not found in this project" }, 400);
    } else if (d.fileId || d.fileVersionId) {
      return c.json({ error: "fileId and fileVersionId must be set together" }, 400);
    }

    const occupantScanSecret = ctx.settings.modules.omTenantPortal
      ? randomBytes(24).toString("hex")
      : null;

    const row = await prisma.asset.create({
      data: {
        projectId,
        tag: d.tag.trim(),
        name: d.name.trim(),
        category: d.category?.trim() ? d.category.trim() : null,
        manufacturer: d.manufacturer ?? null,
        model: d.model ?? null,
        serialNumber: d.serialNumber ?? null,
        locationLabel: d.locationLabel ?? null,
        installDate: d.installDate ? new Date(d.installDate) : null,
        warrantyExpires: d.warrantyExpires ? new Date(d.warrantyExpires) : null,
        lastServiceAt: d.lastServiceAt ? new Date(d.lastServiceAt) : null,
        notes: d.notes ?? null,
        fileId: d.fileId ?? null,
        fileVersionId: d.fileVersionId ?? null,
        pageNumber: d.pageNumber ?? null,
        annotationId: d.annotationId ?? null,
        pinJson: d.pinJson === undefined ? undefined : (d.pinJson as Prisma.InputJsonValue),
        ...(occupantScanSecret ? { occupantScanSecret } : {}),
      },
      include: {
        file: { select: { id: true, name: true } },
        fileVersion: { select: { id: true, version: true } },
      },
    });

    await logActivity(ctx.project.workspaceId, ActivityType.PROJECT_UPDATED, {
      actorUserId: c.get("user").id,
      entityId: row.id,
      projectId,
      metadata: { omAssetCreated: row.tag },
    });

    return c.json(toOmAssetJson(row));
  });

  r.patch("/projects/:projectId/om/assets/:assetId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const assetId = c.req.param("assetId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
      return c.json({ error: "Operations assets are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const body = z
      .object({
        tag: z.string().min(1).max(80).optional(),
        name: z.string().min(1).max(500).optional(),
        category: z.string().max(120).nullable().optional(),
        manufacturer: z.string().max(200).nullable().optional(),
        model: z.string().max(200).nullable().optional(),
        serialNumber: z.string().max(200).nullable().optional(),
        locationLabel: z.string().max(500).nullable().optional(),
        installDate: z.string().datetime().nullable().optional(),
        warrantyExpires: z.string().datetime().nullable().optional(),
        lastServiceAt: z.string().datetime().nullable().optional(),
        notes: z.string().max(5000).nullable().optional(),
        fileId: z.string().nullable().optional(),
        fileVersionId: z.string().nullable().optional(),
        pageNumber: z.number().int().min(1).nullable().optional(),
        annotationId: z.string().nullable().optional(),
        pinJson: z.unknown().nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const d = body.data;

    if (d.fileId !== undefined || d.fileVersionId !== undefined) {
      const nf = d.fileId ?? existing.fileId;
      const nv = d.fileVersionId ?? existing.fileVersionId;
      if (nf && nv) {
        const fv = await prisma.fileVersion.findFirst({
          where: { id: nv, fileId: nf, file: { projectId } },
        });
        if (!fv) return c.json({ error: "File version not found in this project" }, 400);
      } else if (nf || nv) {
        return c.json({ error: "fileId and fileVersionId must be set together" }, 400);
      }
    }

    const row = await prisma.asset.update({
      where: { id: assetId },
      data: {
        ...(d.tag !== undefined ? { tag: d.tag.trim() } : {}),
        ...(d.name !== undefined ? { name: d.name.trim() } : {}),
        ...(d.category !== undefined
          ? { category: d.category?.trim() ? d.category.trim() : null }
          : {}),
        ...(d.manufacturer !== undefined ? { manufacturer: d.manufacturer } : {}),
        ...(d.model !== undefined ? { model: d.model } : {}),
        ...(d.serialNumber !== undefined ? { serialNumber: d.serialNumber } : {}),
        ...(d.locationLabel !== undefined ? { locationLabel: d.locationLabel } : {}),
        ...(d.installDate !== undefined
          ? { installDate: d.installDate ? new Date(d.installDate) : null }
          : {}),
        ...(d.warrantyExpires !== undefined
          ? { warrantyExpires: d.warrantyExpires ? new Date(d.warrantyExpires) : null }
          : {}),
        ...(d.lastServiceAt !== undefined
          ? { lastServiceAt: d.lastServiceAt ? new Date(d.lastServiceAt) : null }
          : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.fileId !== undefined ? { fileId: d.fileId } : {}),
        ...(d.fileVersionId !== undefined ? { fileVersionId: d.fileVersionId } : {}),
        ...(d.pageNumber !== undefined ? { pageNumber: d.pageNumber } : {}),
        ...(d.annotationId !== undefined ? { annotationId: d.annotationId } : {}),
        ...(d.pinJson !== undefined
          ? { pinJson: d.pinJson as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput }
          : {}),
      },
      include: {
        file: { select: { id: true, name: true } },
        fileVersion: { select: { id: true, version: true } },
      },
    });

    return c.json(toOmAssetJson(row));
  });

  r.post("/projects/:projectId/om/assets/:assetId/occupant-scan-secret", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const assetId = c.req.param("assetId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (
      !ctx.project.operationsMode ||
      !ctx.settings.modules.omAssets ||
      !ctx.settings.modules.omTenantPortal
    ) {
      return c.json({ error: "Not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const body = z
      .object({ rotate: z.boolean().optional() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    let secret = existing.occupantScanSecret;
    if (!secret || body.data.rotate) {
      secret = randomBytes(24).toString("hex");
      await prisma.asset.update({
        where: { id: assetId },
        data: { occupantScanSecret: secret },
      });
    }
    return c.json({ occupantScanSecret: secret });
  });

  r.get("/projects/:projectId/om/assets/:assetId/documents", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const assetId = c.req.param("assetId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
      return c.json({ error: "Operations assets are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
    if (!asset) return c.json({ error: "Not found" }, 404);

    const docs = await prisma.assetDocument.findMany({
      where: { assetId },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    return c.json(
      docs.map((d) => ({
        id: d.id,
        assetId: d.assetId,
        label: d.label,
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes.toString(),
        uploadedBy: d.uploadedBy,
        createdAt: d.createdAt.toISOString(),
      })),
    );
  });

  r.post("/projects/:projectId/om/assets/:assetId/documents/presign", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const assetId = c.req.param("assetId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
      return c.json({ error: "Operations assets are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
    if (!asset) return c.json({ error: "Not found" }, 404);

    const body = z
      .object({
        fileName: z.string().min(1),
        contentType: z.string().default("application/octet-stream"),
        sizeBytes: z.coerce.bigint(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    if (body.data.sizeBytes <= 0n) return c.json({ error: "File is empty" }, 400);
    if (body.data.sizeBytes > BigInt(MAX_ASSET_DOCUMENT_BYTES)) {
      return c.json({ error: "File too large (max 25 MB per document)" }, 400);
    }

    const ws = ctx.project.workspace;
    const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
    if (newUsed > ws.storageQuotaBytes) {
      return c.json({ error: "Storage quota exceeded" }, 400);
    }

    const uploadId = newUploadId();
    const key = buildAssetDocumentKey(
      ctx.project.workspaceId,
      projectId,
      assetId,
      uploadId,
      body.data.fileName,
    );
    let url: string | null;
    try {
      url = await presignPut(env, key, body.data.contentType);
    } catch (e) {
      console.error("[asset document presign]", e);
      return c.json(
        { error: "Could not create upload URL. Check S3 credentials and bucket configuration." },
        503,
      );
    }
    if (!url) {
      return c.json({ error: "S3 not configured — set AWS_* and S3_BUCKET", devKey: key }, 503);
    }
    return c.json({ uploadUrl: url, key });
  });

  r.post("/projects/:projectId/om/assets/:assetId/documents/complete", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const assetId = c.req.param("assetId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
      return c.json({ error: "Operations assets are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
    if (!asset) return c.json({ error: "Not found" }, 404);

    const body = z
      .object({
        key: z.string().min(1),
        label: z.string().max(200).optional(),
        fileName: z.string().min(1),
        mimeType: z.string().default("application/octet-stream"),
        sizeBytes: z.coerce.bigint(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    if (body.data.sizeBytes <= 0n) return c.json({ error: "File is empty" }, 400);
    if (body.data.sizeBytes > BigInt(MAX_ASSET_DOCUMENT_BYTES)) {
      return c.json({ error: "File too large (max 25 MB per document)" }, 400);
    }
    if (!s3KeyMatchesAssetDocument(body.data.key, ctx.project.workspaceId, projectId, assetId)) {
      return c.json({ error: "Invalid upload key" }, 400);
    }

    const ws = ctx.project.workspace;
    const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
    if (newUsed > ws.storageQuotaBytes) {
      return c.json({ error: "Storage quota exceeded" }, 400);
    }

    const labelTrim = body.data.label?.trim() ?? "";
    const displayLabel =
      labelTrim.length > 0
        ? labelTrim
        : body.data.fileName.replace(/\.[^/.]+$/, "") || body.data.fileName;

    const [doc] = await prisma.$transaction([
      prisma.assetDocument.create({
        data: {
          assetId,
          label: displayLabel,
          fileName: body.data.fileName,
          mimeType: body.data.mimeType,
          s3Key: body.data.key,
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

    await logActivity(ctx.project.workspaceId, ActivityType.PROJECT_UPDATED, {
      actorUserId: c.get("user").id,
      entityId: assetId,
      projectId,
      metadata: { omAssetDocumentAdded: doc.fileName, assetTag: asset.tag },
    });

    return c.json({
      id: doc.id,
      assetId: doc.assetId,
      label: doc.label,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes.toString(),
      uploadedBy: doc.uploadedBy,
      createdAt: doc.createdAt.toISOString(),
    });
  });

  r.get(
    "/projects/:projectId/om/assets/:assetId/documents/:documentId/presign-read",
    needUser,
    async (c) => {
      const projectId = c.req.param("projectId")!;
      const assetId = c.req.param("assetId")!;
      const documentId = c.req.param("documentId")!;
      const auth = await loadProjectWithAuth(projectId, c.get("user").id);
      if ("error" in auth) return c.json({ error: auth.error }, auth.status);
      const { ctx } = auth;
      if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
        return c.json({ error: "Not found" }, 404);
      }
      const gate = requireOmBilling(ctx.project.workspace);
      if (gate) return c.json({ error: gate.error }, gate.status);

      const doc = await prisma.assetDocument.findFirst({
        where: { id: documentId, assetId, asset: { projectId } },
      });
      if (!doc) return c.json({ error: "Not found" }, 404);

      let url: string | null;
      try {
        url = await presignGet(env, doc.s3Key);
      } catch (e) {
        console.error("[asset document presign-read]", e);
        return c.json({ error: "Could not create download link (S3)." }, 503);
      }
      if (!url) return c.json({ error: "S3 not configured" }, 503);
      return c.json({ url });
    },
  );

  r.delete("/projects/:projectId/om/assets/:assetId/documents/:documentId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const assetId = c.req.param("assetId")!;
    const documentId = c.req.param("documentId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
      return c.json({ error: "Operations assets are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const doc = await prisma.assetDocument.findFirst({
      where: { id: documentId, assetId, asset: { projectId } },
    });
    if (!doc) return c.json({ error: "Not found" }, 404);

    const del = await deleteObject(env, doc.s3Key);
    if (!del.ok && del.error !== "S3 not configured") {
      return c.json({ error: del.error }, 503);
    }

    await prisma.$transaction([
      prisma.assetDocument.delete({ where: { id: doc.id } }),
      prisma.workspace.update({
        where: { id: ctx.project.workspaceId },
        data: { storageUsedBytes: { decrement: doc.sizeBytes } },
      }),
    ]);

    return c.json({ ok: true as const });
  });

  r.delete("/projects/:projectId/om/assets/:assetId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const assetId = c.req.param("assetId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
      return c.json({ error: "Operations assets are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const docs = await prisma.assetDocument.findMany({ where: { assetId } });
    let dec = 0n;
    for (const d of docs) {
      dec += d.sizeBytes;
      const del = await deleteObject(env, d.s3Key);
      if (!del.ok && del.error !== "S3 not configured") {
        console.warn(`[asset delete] deleteObject ${d.s3Key}:`, del.error);
      }
    }

    await prisma.$transaction([
      prisma.assetDocument.deleteMany({ where: { assetId } }),
      prisma.asset.delete({ where: { id: assetId } }),
      ...(dec > 0n
        ? [
            prisma.workspace.update({
              where: { id: ctx.project.workspaceId },
              data: { storageUsedBytes: { decrement: dec } },
            }),
          ]
        : []),
    ]);

    return c.json({ ok: true as const });
  });

  // --- Maintenance (PPM) ---
  r.get("/projects/:projectId/om/maintenance", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
      return c.json({ error: "Maintenance module is not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.maintenanceSchedule.findMany({
      where: { asset: { projectId } },
      include: { asset: { select: { id: true, tag: true, name: true } } },
      orderBy: [{ nextDueAt: "asc" }],
    });
    const now = new Date();
    return c.json(
      rows.map((r) => ({
        ...r,
        nextDueAt: r.nextDueAt?.toISOString() ?? null,
        lastCompletedAt: r.lastCompletedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        health: ppmHealthLabel(r.nextDueAt, now),
      })),
    );
  });

  r.post("/projects/:projectId/om/maintenance", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
      return c.json({ error: "Maintenance module is not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        assetId: z.string(),
        title: z.string().max(200).optional(),
        frequency: z.nativeEnum(MaintenanceFrequency),
        intervalDays: z.number().int().min(1).max(3650).nullable().optional(),
        nextDueAt: z.string().datetime().nullable().optional(),
        assignedVendorLabel: z.string().max(200).nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const asset = await prisma.asset.findFirst({ where: { id: body.data.assetId, projectId } });
    if (!asset) return c.json({ error: "Asset not found" }, 404);

    let nextDue = body.data.nextDueAt ? new Date(body.data.nextDueAt) : new Date();
    if (!body.data.nextDueAt) {
      nextDue = frequencyToNextFrom(
        body.data.frequency,
        body.data.intervalDays ?? null,
        new Date(),
      );
    }

    const row = await prisma.maintenanceSchedule.create({
      data: {
        assetId: asset.id,
        title: body.data.title?.trim() ?? "",
        frequency: body.data.frequency,
        intervalDays: body.data.intervalDays ?? null,
        nextDueAt: nextDue,
        assignedVendorLabel: body.data.assignedVendorLabel ?? null,
      },
      include: { asset: { select: { id: true, tag: true, name: true } } },
    });

    return c.json({
      ...row,
      nextDueAt: row.nextDueAt?.toISOString() ?? null,
      lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      health: ppmHealthLabel(row.nextDueAt),
    });
  });

  r.patch("/projects/:projectId/om/maintenance/:scheduleId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const scheduleId = c.req.param("scheduleId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
      return c.json({ error: "Maintenance module is not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.maintenanceSchedule.findFirst({
      where: { id: scheduleId, asset: { projectId } },
    });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const body = z
      .object({
        title: z.string().max(200).optional(),
        frequency: z.nativeEnum(MaintenanceFrequency).optional(),
        intervalDays: z.number().int().min(1).max(3650).nullable().optional(),
        nextDueAt: z.string().datetime().nullable().optional(),
        lastCompletedAt: z.string().datetime().nullable().optional(),
        assignedVendorLabel: z.string().max(200).nullable().optional(),
        isActive: z.boolean().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const d = body.data;

    const row = await prisma.maintenanceSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(d.title !== undefined ? { title: d.title.trim() } : {}),
        ...(d.frequency !== undefined ? { frequency: d.frequency } : {}),
        ...(d.intervalDays !== undefined ? { intervalDays: d.intervalDays } : {}),
        ...(d.nextDueAt !== undefined
          ? { nextDueAt: d.nextDueAt ? new Date(d.nextDueAt) : null }
          : {}),
        ...(d.lastCompletedAt !== undefined
          ? { lastCompletedAt: d.lastCompletedAt ? new Date(d.lastCompletedAt) : null }
          : {}),
        ...(d.assignedVendorLabel !== undefined
          ? { assignedVendorLabel: d.assignedVendorLabel }
          : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
      include: { asset: { select: { id: true, tag: true, name: true } } },
    });

    return c.json({
      ...row,
      nextDueAt: row.nextDueAt?.toISOString() ?? null,
      lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      health: ppmHealthLabel(row.nextDueAt),
    });
  });

  /** Create work orders (issues) for schedules that are due or overdue. */
  r.post("/projects/:projectId/om/maintenance/generate-work-orders", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
      return c.json({ error: "Maintenance module is not enabled" }, 403);
    }
    if (!ctx.settings.modules.issues) {
      return c.json({ error: "Issues/work orders module is disabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const defaultFv = await getDefaultFileVersion(projectId);
    if (!defaultFv) {
      return c.json({ error: "Upload at least one PDF before generating work orders" }, 400);
    }

    const endToday = new Date();
    endToday.setUTCHours(23, 59, 59, 999);
    const due = await prisma.maintenanceSchedule.findMany({
      where: {
        isActive: true,
        asset: { projectId },
        nextDueAt: { not: null, lte: endToday },
      },
      include: { asset: true },
    });

    const created: string[] = [];
    for (const s of due) {
      const title = s.title.trim() ? s.title.trim() : `PPM: ${s.asset.tag} — ${s.frequency}`;
      const iss = await prisma.issue.create({
        data: {
          workspaceId: ctx.project.workspaceId,
          projectId,
          fileId: defaultFv.fileId,
          fileVersionId: defaultFv.fileVersionId,
          title,
          description: `Preventive maintenance due for asset ${s.asset.tag} (${s.asset.name}). Schedule: ${s.frequency}. Next due: ${s.nextDueAt?.toISOString() ?? "—"}.`,
          issueKind: IssueKind.WORK_ORDER,
          assetId: s.assetId,
          status: IssueStatus.OPEN,
          priority: IssuePriority.MEDIUM,
          creatorId: c.get("user").id,
          sheetName: defaultFv.file.name,
          sheetVersion: defaultFv.fileVersion.version,
        },
      });
      created.push(iss.id);
    }

    await logActivity(ctx.project.workspaceId, ActivityType.ISSUE_CREATED, {
      actorUserId: c.get("user").id,
      entityId: projectId,
      projectId,
      metadata: { omGeneratedWorkOrders: created.length },
    });

    return c.json({ createdIds: created });
  });

  r.post("/projects/:projectId/om/maintenance/:scheduleId/complete", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const scheduleId = c.req.param("scheduleId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
      return c.json({ error: "Maintenance module is not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.maintenanceSchedule.findFirst({
      where: { id: scheduleId, asset: { projectId } },
      include: { asset: true },
    });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const completedAt = new Date();
    const next = frequencyToNextFrom(existing.frequency, existing.intervalDays, completedAt);

    const row = await prisma.maintenanceSchedule.update({
      where: { id: scheduleId },
      data: {
        lastCompletedAt: completedAt,
        nextDueAt: next,
      },
      include: { asset: { select: { id: true, tag: true, name: true } } },
    });

    return c.json({
      ...row,
      nextDueAt: row.nextDueAt?.toISOString() ?? null,
      lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      health: ppmHealthLabel(row.nextDueAt),
    });
  });

  // --- Inspection templates ---
  r.get("/projects/:projectId/om/inspection-templates", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
      return c.json({ error: "Inspections are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.inspectionTemplate.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
    return c.json(
      rows.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    );
  });

  r.post("/projects/:projectId/om/inspection-templates", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
      return c.json({ error: "Inspections are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        name: z.string().min(1).max(300),
        description: z.string().max(2000).nullable().optional(),
        frequency: z.string().max(80).nullable().optional(),
        checklistJson: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            type: z.enum(["checkbox", "passfail", "text", "photo"]),
            level: z.string().max(120).optional(),
          }),
        ),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const row = await prisma.inspectionTemplate.create({
      data: {
        projectId,
        name: body.data.name.trim(),
        description: body.data.description ?? null,
        frequency: body.data.frequency?.trim() || null,
        checklistJson: body.data.checklistJson as Prisma.InputJsonValue,
      },
    });
    return c.json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  r.delete("/projects/:projectId/om/inspection-templates/:templateId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const templateId = c.req.param("templateId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
      return c.json({ error: "Inspections are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const tpl = await prisma.inspectionTemplate.findFirst({
      where: { id: templateId, projectId },
      select: { id: true },
    });
    if (!tpl) return c.json({ error: "Not found" }, 404);

    await prisma.inspectionTemplate.delete({ where: { id: templateId } });
    return c.json({ ok: true as const });
  });

  // --- Inspection runs ---
  r.get("/projects/:projectId/om/inspection-runs", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
      return c.json({ error: "Inspections are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.inspectionRun.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      include: {
        template: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return c.json(
      rows.map((r) => ({
        ...r,
        completedAt: r.completedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  });

  r.post("/projects/:projectId/om/inspection-runs", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
      return c.json({ error: "Inspections are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        templateId: z.string(),
        fileId: z.string().nullable().optional(),
        fileVersionId: z.string().nullable().optional(),
        pageNumber: z.number().int().min(1).nullable().optional(),
        resultJson: z.array(z.unknown()).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const tpl = await prisma.inspectionTemplate.findFirst({
      where: { id: body.data.templateId, projectId },
    });
    if (!tpl) return c.json({ error: "Template not found" }, 404);

    if (body.data.fileId && body.data.fileVersionId) {
      const ok = await prisma.fileVersion.findFirst({
        where: { id: body.data.fileVersionId, fileId: body.data.fileId, file: { projectId } },
      });
      if (!ok) return c.json({ error: "File version not found" }, 400);
    }

    const row = await prisma.inspectionRun.create({
      data: {
        projectId,
        templateId: tpl.id,
        fileId: body.data.fileId ?? null,
        fileVersionId: body.data.fileVersionId ?? null,
        pageNumber: body.data.pageNumber ?? null,
        resultJson: (body.data.resultJson ?? []) as Prisma.InputJsonValue,
        createdById: c.get("user").id,
        status: InspectionRunStatus.DRAFT,
      },
      include: { template: { select: { id: true, name: true } } },
    });

    return c.json({
      ...row,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  r.patch("/projects/:projectId/om/inspection-runs/:runId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const runId = c.req.param("runId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
      return c.json({ error: "Inspections are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.inspectionRun.findFirst({ where: { id: runId, projectId } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const body = z
      .object({
        resultJson: z.array(z.unknown()).optional(),
        attachmentsJson: z.array(z.unknown()).optional(),
        status: z.nativeEnum(InspectionRunStatus).optional(),
        completedAt: z.string().datetime().nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const d = body.data;

    const markComplete =
      d.status === InspectionRunStatus.COMPLETED ||
      (d.completedAt !== undefined && d.completedAt !== null);
    const row = await prisma.inspectionRun.update({
      where: { id: runId },
      data: {
        ...(d.resultJson !== undefined
          ? { resultJson: d.resultJson as Prisma.InputJsonValue }
          : {}),
        ...(d.attachmentsJson !== undefined
          ? { attachmentsJson: d.attachmentsJson as Prisma.InputJsonValue }
          : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.completedAt !== undefined
          ? { completedAt: d.completedAt ? new Date(d.completedAt) : null }
          : {}),
        ...(markComplete && d.completedAt === undefined
          ? {
              completedAt: new Date(),
              signedOffById: c.get("user").id,
              status: InspectionRunStatus.COMPLETED,
            }
          : {}),
      },
      include: { template: true },
    });

    return c.json({
      ...row,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  });

  r.delete("/projects/:projectId/om/inspection-runs/:runId", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const runId = c.req.param("runId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
      return c.json({ error: "Inspections are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const existing = await prisma.inspectionRun.findFirst({ where: { id: runId, projectId } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    await prisma.inspectionRun.delete({ where: { id: runId } });
    return c.json({ ok: true as const });
  });

  /**
   * Complete inspection: persist results, mark run completed, optionally create work orders for failed items.
   */
  r.post("/projects/:projectId/om/inspection-runs/:runId/complete", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const runId = c.req.param("runId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
      return c.json({ error: "Inspections are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        resultJson: z.array(
          z.object({
            itemId: z.string(),
            outcome: z.enum(["pass", "fail", "na"]),
            note: z.string().max(4000).optional(),
            photoDataUrl: z.string().max(2_000_000).optional(),
            /** Original filename when uploaded (shown on PDF). Camera captures use a generated label. */
            photoFileName: z.string().max(260).optional(),
            /** When set, complete will not create another work order for this failed item. */
            followUpIssueId: z.string().optional(),
          }),
        ),
        createWorkOrdersForFailures: z.boolean().default(true),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const run = await prisma.inspectionRun.findFirst({
      where: { id: runId, projectId },
      include: { template: true },
    });
    if (!run) return c.json({ error: "Not found" }, 404);
    if (run.status !== InspectionRunStatus.DRAFT) {
      return c.json({ error: "Inspection is already completed or archived" }, 400);
    }

    const checklist = Array.isArray(run.template.checklistJson)
      ? (run.template.checklistJson as { id?: string; label?: string }[])
      : [];
    const idList = checklist
      .map((x) => x.id)
      .filter((x): x is string => typeof x === "string" && x.length > 0);
    const ids = new Set(idList);
    if (idList.length !== ids.size) {
      return c.json({ error: "Checklist item ids must be unique" }, 400);
    }
    for (const row of body.data.resultJson) {
      if (!ids.has(row.itemId))
        return c.json({ error: `Unknown checklist item: ${row.itemId}` }, 400);
    }
    if (body.data.resultJson.length !== ids.size) {
      return c.json({ error: "Result count must match checklist items" }, 400);
    }

    const userId = c.get("user").id;
    const wantWo = body.data.createWorkOrdersForFailures;
    const fails = body.data.resultJson.filter((r) => r.outcome === "fail");

    if (wantWo && fails.length > 0 && !ctx.settings.modules.issues) {
      return c.json(
        { error: "Issues module is disabled; turn off work order creation or enable issues." },
        403,
      );
    }

    const updated = await prisma.inspectionRun.update({
      where: { id: runId },
      data: {
        resultJson: body.data.resultJson as Prisma.InputJsonValue,
        status: InspectionRunStatus.COMPLETED,
        completedAt: new Date(),
        signedOffById: userId,
      },
      include: { template: { select: { id: true, name: true } } },
    });

    const woIds: string[] = [];
    if (wantWo && fails.length > 0) {
      for (const f of fails) {
        if (f.followUpIssueId?.trim()) continue;
        const label = checklist.find((it) => it.id === f.itemId)?.label?.trim() || f.itemId;
        const created = await createInspectionRunWorkOrderIssue(
          projectId,
          ctx.project.workspaceId,
          userId,
          run,
          {
            title: `Work order: ${label}`,
            itemLabel: label,
            note: f.note,
          },
        );
        if ("error" in created) return c.json({ error: created.error }, 400);
        woIds.push(created.id);
        await logActivity(ctx.project.workspaceId, ActivityType.ISSUE_CREATED, {
          actorUserId: userId,
          entityId: created.id,
          projectId,
          metadata: { title: created.title, fromInspectionRun: runId },
        });
      }
    }

    const runForPdf = await prisma.inspectionRun.findFirst({
      where: { id: runId, projectId },
      include: {
        template: true,
        project: { select: { name: true } },
        file: { select: { name: true } },
        fileVersion: { select: { version: true } },
        signedOffBy: { select: { name: true } },
      },
    });
    const handover = parseProjectSettingsJson(ctx.project.settingsJson).omHandover;
    const ownerEmail = handover.buildingOwnerEmail;
    const signer = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    let buildingOwnerNotify:
      | { sent: true }
      | { sent: false; skippedReason: "no_recipient" | "resend_not_configured" | "send_failed" };

    if (!ownerEmail) {
      buildingOwnerNotify = { sent: false, skippedReason: "no_recipient" };
    } else if (!runForPdf) {
      buildingOwnerNotify = { sent: false, skippedReason: "send_failed" };
    } else {
      try {
        const pdfBuf = await buildInspectionReportPdfBuffer(runForPdf);
        const emailed = await tryEmailInspectionReportToBuildingOwner({
          env,
          to: ownerEmail,
          projectName: runForPdf.project.name,
          templateName: runForPdf.template.name,
          completedAt: updated.completedAt!,
          signedByName: signer?.name ?? null,
          pdfBuffer: pdfBuf,
          runId,
        });
        buildingOwnerNotify = emailed.ok
          ? { sent: true }
          : { sent: false, skippedReason: emailed.reason };
      } catch (e) {
        console.error("[inspection-complete] building owner email", e);
        buildingOwnerNotify = { sent: false, skippedReason: "send_failed" };
      }
    }

    return c.json({
      id: updated.id,
      status: updated.status,
      workOrderIds: woIds,
      reportPdfPath: `/api/v1/projects/${projectId}/om/inspection-runs/${runId}/report.pdf`,
      completedAt: updated.completedAt!.toISOString(),
      buildingOwnerNotify,
    });
  });

  r.get("/projects/:projectId/om/inspection-runs/:runId/report.pdf", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const runId = c.req.param("runId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
      return c.json({ error: "Inspections are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const run = await prisma.inspectionRun.findFirst({
      where: { id: runId, projectId },
      include: {
        template: true,
        project: { select: { name: true } },
        file: { select: { name: true } },
        fileVersion: { select: { version: true } },
        signedOffBy: { select: { name: true } },
      },
    });
    if (!run) return c.json({ error: "Not found" }, 404);

    const buf = await buildInspectionReportPdfBuffer(run);

    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `inline; filename="inspection-${runId.slice(0, 12)}.pdf"`);
    return c.body(new Uint8Array(buf));
  });

  // --- Occupant portal tokens (admin) ---
  r.get("/projects/:projectId/om/occupant-tokens", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (!ctx.project.operationsMode || !ctx.settings.modules.omTenantPortal) {
      return c.json({ error: "Occupant portal is not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    let rows = await prisma.occupantPortalToken.findMany({
      where: { projectId, revokedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (rows.length === 0) {
      const tok = randomBytes(24).toString("hex");
      const created = await prisma.occupantPortalToken.create({
        data: { projectId, token: tok, label: "Building link" },
      });
      rows = [created];
    }
    return c.json(
      rows.map((t) => ({
        id: t.id,
        token: t.token,
        label: t.label,
        expiresAt: t.expiresAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    );
  });

  r.get("/projects/:projectId/om/occupant-tokens/revoked", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (!ctx.project.operationsMode || !ctx.settings.modules.omTenantPortal) {
      return c.json({ error: "Occupant portal is not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.occupantPortalToken.findMany({
      where: { projectId, revokedAt: { not: null } },
      orderBy: { revokedAt: "desc" },
      take: 40,
      select: { id: true, label: true, token: true, createdAt: true, revokedAt: true },
    });
    return c.json(
      rows.map((t) => ({
        id: t.id,
        label: t.label,
        createdAt: t.createdAt.toISOString(),
        revokedAt: t.revokedAt!.toISOString(),
        tokenSuffix: t.token.length > 8 ? t.token.slice(-6) : t.token,
      })),
    );
  });

  r.post("/projects/:projectId/om/occupant-tokens/:tokenId/revoke", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const tokenId = c.req.param("tokenId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (!ctx.project.operationsMode || !ctx.settings.modules.omTenantPortal) {
      return c.json({ error: "Occupant portal is not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const now = new Date();
    const activeCount = await prisma.occupantPortalToken.count({
      where: {
        projectId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (activeCount <= 1) {
      return c.json(
        { error: "Keep at least one active building link. Add another before revoking." },
        400,
      );
    }

    const row = await prisma.occupantPortalToken.findFirst({
      where: { id: tokenId, projectId, revokedAt: null },
    });
    if (!row) return c.json({ error: "Not found or already revoked" }, 404);

    await prisma.occupantPortalToken.update({
      where: { id: row.id },
      data: { revokedAt: now },
    });
    return c.json({ ok: true as const });
  });

  r.post("/projects/:projectId/om/occupant-tokens", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (!ctx.project.operationsMode || !ctx.settings.modules.omTenantPortal) {
      return c.json({ error: "Occupant portal is not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        label: z.string().max(120).optional(),
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const token = randomBytes(24).toString("hex");
    const row = await prisma.occupantPortalToken.create({
      data: {
        projectId,
        token,
        label: body.data.label?.trim() || "Link",
        expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : null,
      },
    });

    return c.json({
      id: row.id,
      token: row.token,
      label: row.label,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    });
  });

  // --- Handover hub: readiness metrics + team brief (notes / completion) ---
  r.get("/projects/:projectId/om/handover-summary", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode) {
      return c.json({ error: "Operations mode is not enabled for this project" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const settings = parseProjectSettingsJson(ctx.project.settingsJson);
    const now = new Date();

    const [
      assetTotal,
      assetsLinkedToDrawing,
      assetsWithOccupantSecret,
      openWorkOrders,
      maintRows,
      inspectionTemplateCount,
      completedInspectionRuns,
      activeOccupantTokens,
      openPunchItems,
      constructionOpenIssues,
      openOccupantRequests,
    ] = await Promise.all([
      prisma.asset.count({ where: { projectId } }),
      prisma.asset.count({ where: { projectId, fileId: { not: null } } }),
      prisma.asset.count({ where: { projectId, occupantScanSecret: { not: null } } }),
      prisma.issue.count({
        where: {
          projectId,
          issueKind: IssueKind.WORK_ORDER,
          status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
        },
      }),
      prisma.maintenanceSchedule.findMany({
        where: {
          asset: { projectId },
          isActive: true,
          nextDueAt: { not: null },
        },
        select: { nextDueAt: true },
      }),
      prisma.inspectionTemplate.count({ where: { projectId } }),
      prisma.inspectionRun.count({
        where: { projectId, status: InspectionRunStatus.COMPLETED },
      }),
      prisma.occupantPortalToken.count({
        where: {
          projectId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      prisma.punchItem.count({
        where: { projectId, status: { not: PunchStatus.CLOSED } },
      }),
      prisma.issue.count({
        where: {
          projectId,
          issueKind: IssueKind.CONSTRUCTION,
          status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
        },
      }),
      prisma.issue.count({
        where: {
          projectId,
          issueKind: IssueKind.OCCUPANT,
          status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
        },
      }),
    ]);

    let maintenanceOverdue = 0;
    let maintenanceDueSoon = 0;
    for (const row of maintRows) {
      if (!row.nextDueAt) continue;
      const h = ppmHealthLabel(row.nextDueAt, now);
      if (h === "overdue") maintenanceOverdue++;
      else if (h === "dueSoon") maintenanceDueSoon++;
    }

    return c.json({
      projectId,
      projectName: ctx.project.name,
      stage: ctx.project.stage,
      operationsMode: ctx.project.operationsMode,
      handoverNotes: settings.omHandover.notes,
      handoverCompletedAt: settings.omHandover.handoverCompletedAt,
      readiness: {
        assets: {
          total: assetTotal,
          linkedToDrawing: assetsLinkedToDrawing,
        },
        workOrdersOpen: openWorkOrders,
        maintenance: {
          schedulesTracked: maintRows.length,
          overdue: maintenanceOverdue,
          dueSoon: maintenanceDueSoon,
        },
        inspections: {
          templates: inspectionTemplateCount,
          completedRuns: completedInspectionRuns,
        },
        occupantPortal: {
          activeMagicLinks: activeOccupantTokens,
          assetsWithOccupantSecret,
        },
        punchOpen: openPunchItems,
        constructionIssuesOpen: constructionOpenIssues,
        tenantRequestsOpen: openOccupantRequests,
      },
    });
  });

  r.patch("/projects/:projectId/om/handover-brief", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode) {
      return c.json({ error: "Operations mode is not enabled for this project" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        notes: z.string().max(20000).optional(),
        handoverCompletedAt: z.string().datetime().nullable().optional(),
        buildingLabel: z.string().max(500).nullable().optional(),
        facilityManagerUserId: z.string().nullable().optional(),
        handoverDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        transferAsBuilt: z.boolean().optional(),
        transferClosedIssues: z.boolean().optional(),
        transferPunch: z.boolean().optional(),
        transferTeamAccess: z.boolean().optional(),
        handoverWizardCompletedAt: z.string().datetime().nullable().optional(),
        buildingOwnerEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const current = parseProjectSettingsJson(ctx.project.settingsJson);
    const prevWizardAt = current.omHandover.handoverWizardCompletedAt;
    const merged = mergeProjectSettingsPatch(current, { omHandover: body.data });
    const raw = cloneSettingsJson(ctx.project.settingsJson);
    raw.modules = merged.modules;
    raw.clientVisibility = merged.clientVisibility;
    raw.omHandover = merged.omHandover;

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { settingsJson: raw as Prisma.InputJsonValue },
    });

    await logActivity(ctx.project.workspaceId, ActivityType.PROJECT_UPDATED, {
      actorUserId: c.get("user").id,
      entityId: projectId,
      projectId,
      metadata: { handoverBriefUpdated: true },
    });

    const fmId = merged.omHandover.facilityManagerUserId;
    if (!prevWizardAt && merged.omHandover.handoverWizardCompletedAt && fmId) {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: ctx.project.workspaceId, userId: fmId },
      });
      if (member) {
        void createUserNotifications({
          workspaceId: ctx.project.workspaceId,
          projectId,
          recipientUserIds: [fmId],
          excludeUserId: c.get("user").id,
          kind: "HANDOVER_FM",
          title: `FM handover: ${ctx.project.name}`,
          body: "You were named as the facility contact for this handover.",
          href: `/projects/${projectId}/om/dashboard`,
          actorUserId: c.get("user").id,
        });
      }
    }

    return c.json({
      projectId,
      settings: parseProjectSettingsJson(updated.settingsJson),
    });
  });

  /** FM dashboard KPIs + lists (operations mode). */
  r.get("/projects/:projectId/om/fm-dashboard", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode) {
      return c.json({ error: "Operations mode is not enabled for this project" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const settings = parseProjectSettingsJson(ctx.project.settingsJson);
    const now = new Date();
    const weekStart = startOfUtcWeek(now);
    const weekEnd = endOfUtcWeek(weekStart);

    const [
      assetTotal,
      assetsLinkedToDrawing,
      openWo,
      inProgressWo,
      openTenantReq,
      inProgressTenantReq,
      maintRows,
      schedulesForWeek,
      recentWo,
      recentTenantReq,
    ] = await Promise.all([
      prisma.asset.count({ where: { projectId } }),
      prisma.asset.count({ where: { projectId, fileId: { not: null } } }),
      prisma.issue.count({
        where: { projectId, issueKind: IssueKind.WORK_ORDER, status: IssueStatus.OPEN },
      }),
      prisma.issue.count({
        where: { projectId, issueKind: IssueKind.WORK_ORDER, status: IssueStatus.IN_PROGRESS },
      }),
      prisma.issue.count({
        where: { projectId, issueKind: IssueKind.OCCUPANT, status: IssueStatus.OPEN },
      }),
      prisma.issue.count({
        where: { projectId, issueKind: IssueKind.OCCUPANT, status: IssueStatus.IN_PROGRESS },
      }),
      prisma.maintenanceSchedule.findMany({
        where: { asset: { projectId }, isActive: true, nextDueAt: { not: null } },
        select: { nextDueAt: true },
      }),
      prisma.maintenanceSchedule.findMany({
        where: {
          asset: { projectId },
          isActive: true,
          nextDueAt: { gte: weekStart, lt: weekEnd },
        },
        include: {
          asset: { select: { tag: true, name: true } },
        },
        orderBy: { nextDueAt: "asc" },
        take: 12,
      }),
      prisma.issue.findMany({
        where: { projectId, issueKind: IssueKind.WORK_ORDER },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          updatedAt: true,
        },
      }),
      prisma.issue.findMany({
        where: { projectId, issueKind: IssueKind.OCCUPANT },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          updatedAt: true,
        },
      }),
    ]);

    let maintenanceOverdue = 0;
    let maintenanceDueSoon = 0;
    for (const row of maintRows) {
      if (!row.nextDueAt) continue;
      const h = ppmHealthLabel(row.nextDueAt, now);
      if (h === "overdue") maintenanceOverdue++;
      else if (h === "dueSoon") maintenanceDueSoon++;
    }

    const buildingHealthPct =
      assetTotal === 0 ? 100 : Math.round((assetsLinkedToDrawing / assetTotal) * 100);

    return c.json({
      projectId,
      projectName: ctx.project.name,
      handoverCompletedAt: settings.omHandover.handoverCompletedAt,
      handoverDate: settings.omHandover.handoverDate,
      buildingLabel: settings.omHandover.buildingLabel,
      facilityManagerUserId: settings.omHandover.facilityManagerUserId,
      handoverWizardCompletedAt: settings.omHandover.handoverWizardCompletedAt,
      kpis: {
        openWorkOrders: openWo,
        inProgressWorkOrders: inProgressWo,
        openTenantRequests: openTenantReq,
        inProgressTenantRequests: inProgressTenantReq,
        maintenanceScheduledThisWeek: schedulesForWeek.length,
        assetsTracked: assetTotal,
        overdueMaintenanceTasks: maintenanceOverdue,
        maintenanceDueSoon,
      },
      buildingHealthPct,
      upcomingMaintenanceThisWeek: schedulesForWeek.map((s) => ({
        id: s.id,
        title: s.title,
        nextDueAt: s.nextDueAt!.toISOString(),
        assetTag: s.asset.tag,
        assetName: s.asset.name,
        vendor: s.assignedVendorLabel,
        health: ppmHealthLabel(s.nextDueAt, now),
      })),
      recentWorkOrders: recentWo.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        priority: i.priority,
        updatedAt: i.updatedAt.toISOString(),
      })),
      recentTenantRequests: recentTenantReq.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        priority: i.priority,
        updatedAt: i.updatedAt.toISOString(),
      })),
    });
  });

  /** CSV export: asset register. */
  r.get("/projects/:projectId/om/reports/asset-register.csv", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
      return c.json({ error: "Operations assets are not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const rows = await prisma.asset.findMany({
      where: { projectId },
      orderBy: [{ tag: "asc" }],
      include: {
        file: { select: { name: true } },
      },
    });

    const header = ["Tag", "Name", "Location", "Manufacturer", "Model", "Serial", "Linked sheet"];
    const lines = [
      header.map(csvEscapeCell).join(","),
      ...rows.map((a) =>
        [
          a.tag,
          a.name,
          a.locationLabel ?? "",
          a.manufacturer ?? "",
          a.model ?? "",
          a.serialNumber ?? "",
          a.file?.name ?? "",
        ]
          .map((x) => csvEscapeCell(x))
          .join(","),
      ),
    ];
    const body = lines.join("\r\n");
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header(
      "Content-Disposition",
      `attachment; filename="asset-register-${projectId.slice(0, 8)}.csv"`,
    );
    return c.body(body);
  });

  /** CSV export: occupant QR URLs per asset (uses primary active building link). */
  r.get("/projects/:projectId/om/reports/occupant-asset-qr-urls.csv", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (
      !ctx.project.operationsMode ||
      !ctx.settings.modules.omAssets ||
      !ctx.settings.modules.omTenantPortal
    ) {
      return c.json({ error: "Not enabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const now = new Date();
    const tokenRow = await prisma.occupantPortalToken.findFirst({
      where: {
        projectId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!tokenRow) {
      return c.json({ error: "Create a building portal link on the Tenant portal first." }, 400);
    }

    const base = env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
    const assets = await prisma.asset.findMany({
      where: { projectId, occupantScanSecret: { not: null } },
      orderBy: [{ tag: "asc" }],
      select: { tag: true, name: true, occupantScanSecret: true },
    });

    const header = ["Asset tag", "Asset name", "Occupant QR URL"];
    const lines = [
      header.map(csvEscapeCell).join(","),
      ...assets.map((a) =>
        [a.tag, a.name, `${base}/occupant/${tokenRow.token}?a=${a.occupantScanSecret}`]
          .map((x) => csvEscapeCell(x))
          .join(","),
      ),
    ];
    const csvBody = lines.join("\r\n");
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header(
      "Content-Disposition",
      `attachment; filename="occupant-asset-qr-${projectId.slice(0, 8)}.csv"`,
    );
    return c.body(csvBody);
  });

  /** Create a work order from an inspection checklist item (failed / follow-up). */
  r.post("/projects/:projectId/om/inspection-runs/:runId/work-order", needUser, async (c) => {
    const projectId = c.req.param("projectId")!;
    const runId = c.req.param("runId")!;
    const auth = await loadProjectWithAuth(projectId, c.get("user").id);
    if ("error" in auth) return c.json({ error: auth.error }, auth.status);
    const { ctx } = auth;
    if (ctx.workspaceMember.isExternal) return c.json({ error: "Forbidden" }, 403);
    if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
      return c.json({ error: "Inspections are not enabled" }, 403);
    }
    if (!ctx.settings.modules.issues) {
      return c.json({ error: "Issues module is disabled" }, 403);
    }
    const gate = requireOmBilling(ctx.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        itemId: z.string().min(1),
        title: z.string().min(1).max(500),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const run = await prisma.inspectionRun.findFirst({
      where: { id: runId, projectId },
      include: { template: true },
    });
    if (!run) return c.json({ error: "Not found" }, 404);

    const checklist = Array.isArray(run.template.checklistJson)
      ? (run.template.checklistJson as { id?: string; label?: string }[])
      : [];
    const found = checklist.find((it) => it.id === body.data.itemId);
    if (!found) return c.json({ error: "Checklist item not found" }, 400);

    const itemLabel =
      typeof found.label === "string" && found.label.trim() ? found.label.trim() : body.data.itemId;

    const created = await createInspectionRunWorkOrderIssue(
      projectId,
      ctx.project.workspaceId,
      c.get("user").id,
      run,
      { title: body.data.title.trim(), itemLabel },
    );
    if ("error" in created) {
      const st = created.error === "No project drawing to attach" ? 400 : 404;
      return c.json({ error: created.error }, st);
    }

    await logActivity(ctx.project.workspaceId, ActivityType.ISSUE_CREATED, {
      actorUserId: c.get("user").id,
      entityId: created.id,
      projectId,
      metadata: { title: created.title, fromInspectionRun: runId },
    });

    return c.json({ id: created.id, title: created.title });
  });
}

function occupantPortalHeadlineFromSettingsJson(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ui = o.omTenantPortalUi;
  if (!ui || typeof ui !== "object") return null;
  const h = (ui as Record<string, unknown>).headline;
  return typeof h === "string" && h.trim() ? h.trim().slice(0, 200) : null;
}

/** Public occupant routes (no session). */
export function registerOccupantPublicRoutes(r: Hono, env: Env) {
  r.get("/occupant/:token/meta", async (c) => {
    const token = c.req.param("token")!;
    const assetSecretRaw = c.req.query("a")?.trim();
    if (assetSecretRaw && assetSecretRaw.length > 80) {
      return c.json({ error: "Invalid equipment link" }, 400);
    }

    const row = await prisma.occupantPortalToken.findFirst({
      where: { token, revokedAt: null },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            operationsMode: true,
            workspaceId: true,
            settingsJson: true,
          },
        },
      },
    });
    if (!row) return c.json({ error: "Invalid or expired link" }, 404);
    if (!row.project.operationsMode) return c.json({ error: "This portal is not active" }, 403);
    if (row.expiresAt && row.expiresAt < new Date()) {
      return c.json({ error: "This link has expired" }, 403);
    }

    let asset: {
      tag: string;
      name: string;
      category: string | null;
      locationLabel: string | null;
    } | null = null;
    if (assetSecretRaw) {
      const a = await prisma.asset.findFirst({
        where: { projectId: row.projectId, occupantScanSecret: assetSecretRaw },
        select: { tag: true, name: true, category: true, locationLabel: true },
      });
      if (!a) return c.json({ error: "Invalid equipment link" }, 404);
      asset = a;
    }

    const occupantHeadline = occupantPortalHeadlineFromSettingsJson(row.project.settingsJson);
    return c.json({
      projectId: row.project.id,
      projectName: row.project.name,
      occupantHeadline,
      asset,
    });
  });

  r.post("/occupant/:token/submit", async (c) => {
    const token = c.req.param("token")!;
    const body = z
      .object({
        description: z.string().min(1).max(4000),
        floor: z.string().max(120).optional(),
        room: z.string().max(120).optional(),
        reporterName: z.string().min(1).max(200),
        reporterEmail: z.string().email(),
        assetSecret: z.string().min(1).max(80).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const link = await prisma.occupantPortalToken.findFirst({
      where: { token, revokedAt: null },
      include: {
        project: {
          include: { workspace: true },
        },
      },
    });
    if (!link) return c.json({ error: "Invalid or expired link" }, 404);
    if (!link.project.operationsMode) return c.json({ error: "This portal is not active" }, 403);
    if (link.expiresAt && link.expiresAt < new Date()) {
      return c.json({ error: "This link has expired" }, 403);
    }

    const settings = parseProjectSettingsJson(link.project.settingsJson);
    if (!settings.modules.omTenantPortal || !settings.modules.issues) {
      return c.json({ error: "Reporting is disabled for this building" }, 403);
    }

    const gate = requireOmBilling(link.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const clientIp =
      c.req.header("cf-connecting-ip")?.trim() ||
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip")?.trim() ||
      undefined;
    if (occupantSubmitRateLimited(token, clientIp)) {
      return c.json({ error: "Too many requests. Please try again in a minute." }, 429);
    }

    const assetSecret = body.data.assetSecret?.trim();
    let boundAsset: {
      id: string;
      tag: string;
      name: string;
      locationLabel: string | null;
      fileId: string | null;
      fileVersionId: string | null;
      pageNumber: number | null;
      annotationId: string | null;
    } | null = null;
    if (assetSecret) {
      const a = await prisma.asset.findFirst({
        where: { projectId: link.projectId, occupantScanSecret: assetSecret },
        select: {
          id: true,
          tag: true,
          name: true,
          locationLabel: true,
          fileId: true,
          fileVersionId: true,
          pageNumber: true,
          annotationId: true,
        },
      });
      if (!a) return c.json({ error: "Invalid equipment link" }, 400);
      boundAsset = a;
    }

    type ResolvedDrawing = {
      fileId: string;
      fileVersionId: string;
      pageNumber: number | null;
      annotationId: string | null;
      sheetName: string | null;
      sheetVersion: number | null;
    };

    let resolvedDrawing: ResolvedDrawing | undefined;
    if (boundAsset?.fileId && boundAsset?.fileVersionId) {
      const fv = await prisma.fileVersion.findFirst({
        where: {
          id: boundAsset.fileVersionId,
          fileId: boundAsset.fileId,
          file: { projectId: link.projectId },
        },
        include: { file: { select: { name: true } } },
      });
      if (fv) {
        resolvedDrawing = {
          fileId: boundAsset.fileId,
          fileVersionId: boundAsset.fileVersionId,
          pageNumber: boundAsset.pageNumber ?? null,
          annotationId: boundAsset.annotationId ?? null,
          sheetName: fv.file.name,
          sheetVersion: fv.version,
        };
      }
    }

    if (!resolvedDrawing) {
      const defaultFv = await getDefaultFileVersion(link.projectId);
      if (!defaultFv) {
        return c.json(
          { error: "This building has no drawings yet — please contact facilities." },
          400,
        );
      }
      resolvedDrawing = {
        fileId: defaultFv.fileId,
        fileVersionId: defaultFv.fileVersionId,
        pageNumber: null,
        annotationId: null,
        sheetName: defaultFv.file.name,
        sheetVersion: defaultFv.fileVersion.version,
      };
    }

    const { fileId, fileVersionId, pageNumber, annotationId, sheetName, sheetVersion } =
      resolvedDrawing;

    const floorRoom = [
      body.data.floor && `Floor ${body.data.floor}`,
      body.data.room && `Room ${body.data.room}`,
    ]
      .filter(Boolean)
      .join(" · ");

    const location = [boundAsset?.locationLabel?.trim() || null, floorRoom || null]
      .filter(Boolean)
      .join(" · ");

    const title = boundAsset
      ? `Occupant request — ${boundAsset.tag} — ${boundAsset.name}${floorRoom ? ` (${floorRoom})` : ""}`
      : `Occupant request${floorRoom ? ` — ${floorRoom}` : ""}`;

    const photoToken = randomBytes(32).toString("hex");
    const photoExpires = new Date(Date.now() + OCCUPANT_PHOTO_TOKEN_MS);

    const issue = await prisma.issue.create({
      data: {
        workspaceId: link.project.workspaceId,
        projectId: link.projectId,
        fileId,
        fileVersionId,
        sheetName,
        sheetVersion,
        pageNumber,
        annotationId,
        title,
        description: body.data.description,
        location: location || null,
        issueKind: IssueKind.OCCUPANT,
        status: IssueStatus.OPEN,
        priority: IssuePriority.MEDIUM,
        reporterName: body.data.reporterName.trim(),
        reporterEmail: body.data.reporterEmail.trim().toLowerCase(),
        assetId: boundAsset?.id ?? null,
        occupantPhotoToken: photoToken,
        occupantPhotoTokenExpiresAt: photoExpires,
      },
    });

    await logActivity(link.project.workspaceId, ActivityType.ISSUE_CREATED, {
      entityId: issue.id,
      projectId: link.projectId,
      metadata: { occupantPortal: true, title: issue.title, assetId: boundAsset?.id },
    });

    const admins = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: link.project.workspaceId,
        role: { in: ["SUPER_ADMIN", "ADMIN"] },
        isExternal: false,
      },
      select: { userId: true },
    });

    const projectInternals = await prisma.projectMember.findMany({
      where: { projectId: link.projectId, projectRole: "INTERNAL" },
      select: { userId: true },
    });

    const notifyUserIds = new Set<string>();
    for (const a of admins) notifyUserIds.add(a.userId);
    for (const p of projectInternals) notifyUserIds.add(p.userId);

    const viewerParams = {
      issueId: issue.id,
      fileId: issue.fileId,
      fileVersionId: issue.fileVersionId,
      projectId: issue.projectId,
      fileName: sheetName?.trim() ? sheetName.trim() : "Drawing",
      version: sheetVersion ?? 1,
    };
    const viewerPath = buildViewerIssuePath(viewerParams);
    const baseUrl = env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
    const viewerAbs = baseUrl ? `${baseUrl}${viewerPath}` : viewerPath;
    const tenantListAbs = baseUrl
      ? `${baseUrl}/projects/${link.projectId}/om/tenant-requests/${issue.id}`
      : `/projects/${link.projectId}/om/tenant-requests/${issue.id}`;

    const key = env.RESEND_API_KEY?.trim();
    const from = inviteFromAddress(env);
    if (key && from) {
      const resend = new Resend(key);
      for (const uid of notifyUserIds) {
        const u = await prisma.user.findUnique({
          where: { id: uid },
          select: { email: true },
        });
        if (!u?.email) continue;
        void resend.emails
          .send({
            from,
            to: u.email,
            subject: `PlanSync O&M: New occupant request — ${issue.title.slice(0, 80)}`,
            text: `A new request was submitted via the occupant portal.\n\n${issue.title}\n\nReporter: ${body.data.reporterName} <${body.data.reporterEmail}>\n\nOpen request: ${tenantListAbs}\nOpen in viewer: ${viewerAbs}`,
          })
          .catch((e) => console.error("[occupant-email]", e));
      }

      void resend.emails
        .send({
          from,
          to: body.data.reporterEmail.trim().toLowerCase(),
          subject: `We received your request — ${link.project.name}`,
          text: `Hello ${body.data.reporterName.trim()},\n\nThank you for contacting us about ${link.project.name}. We have received your maintenance request and our team will review it soon. If we need more information, we will reach out to you.\n\n— Facilities team`,
        })
        .catch((e) => console.error("[occupant-reporter-email]", e));
    }

    if (notifyUserIds.size > 0) {
      void createUserNotifications({
        workspaceId: link.project.workspaceId,
        projectId: link.projectId,
        recipientUserIds: [...notifyUserIds],
        kind: "ISSUE_CREATED",
        title: `Occupant request: ${issue.title.length > 100 ? `${issue.title.slice(0, 100)}…` : issue.title}`,
        body: body.data.reporterName,
        href: `/projects/${link.projectId}/om/tenant-requests/${issue.id}`,
      }).catch((e) => console.error("[occupant-notify]", e));
    }

    return c.json({
      ok: true as const,
      issueId: issue.id,
      occupantPhotoToken: photoToken,
      occupantPhotoExpiresAt: photoExpires.toISOString(),
    });
  });

  r.post("/occupant/:token/issues/:issueId/reference-photos/presign", async (c) => {
    const portalToken = c.req.param("token")!;
    const issueId = c.req.param("issueId")!;

    const link = await prisma.occupantPortalToken.findFirst({
      where: { token: portalToken, revokedAt: null },
      include: { project: { include: { workspace: true } } },
    });
    if (!link) return c.json({ error: "Invalid or expired link" }, 404);
    if (!link.project.operationsMode) return c.json({ error: "This portal is not active" }, 403);
    if (link.expiresAt && link.expiresAt < new Date()) {
      return c.json({ error: "This link has expired" }, 403);
    }

    const settings = parseProjectSettingsJson(link.project.settingsJson);
    if (!settings.modules.omTenantPortal || !settings.modules.issues) {
      return c.json({ error: "Reporting is disabled for this building" }, 403);
    }

    const gate = requireOmBilling(link.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        occupantPhotoToken: z.string().min(1).max(200),
        fileName: z.string().min(1),
        contentType: z.string().default("application/octet-stream"),
        sizeBytes: z.coerce.bigint(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const issue = await prisma.issue.findFirst({
      where: { id: issueId, projectId: link.projectId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        fileVersionId: true,
        referencePhotos: true,
        occupantPhotoToken: true,
        occupantPhotoTokenExpiresAt: true,
      },
    });
    if (!issue) return c.json({ error: "Not found" }, 404);
    if (
      !issue.occupantPhotoToken ||
      issue.occupantPhotoToken !== body.data.occupantPhotoToken.trim()
    ) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (!issue.occupantPhotoTokenExpiresAt || issue.occupantPhotoTokenExpiresAt < new Date()) {
      return c.json({ error: "Upload window expired" }, 403);
    }

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

    const existing = parseReferencePhotos(issue.referencePhotos);
    if (existing.length >= MAX_ISSUE_REFERENCE_PHOTOS) {
      return c.json(
        { error: `At most ${MAX_ISSUE_REFERENCE_PHOTOS} reference photos per issue` },
        400,
      );
    }

    const ws = link.project.workspace;
    const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
    if (newUsed > ws.storageQuotaBytes) {
      return c.json({ error: "Storage quota exceeded" }, 400);
    }

    const uploadId = newUploadId();
    const s3Key = buildIssueReferencePhotoKey(
      issue.workspaceId,
      issue.projectId,
      uploadId,
      body.data.fileName,
    );
    let uploadUrl: string | null;
    try {
      uploadUrl = await presignPut(env, s3Key, ct);
    } catch (e) {
      console.error("[occupant issue photo presign]", e);
      return c.json(
        { error: "Could not create upload URL. Check S3 credentials and bucket configuration." },
        503,
      );
    }
    if (!uploadUrl) {
      return c.json({ error: "S3 not configured" }, 503);
    }
    return c.json({ uploadUrl, key: s3Key });
  });

  r.post("/occupant/:token/issues/:issueId/reference-photos/complete", async (c) => {
    const portalToken = c.req.param("token")!;
    const issueId = c.req.param("issueId")!;

    const link = await prisma.occupantPortalToken.findFirst({
      where: { token: portalToken, revokedAt: null },
      include: { project: { include: { workspace: true } } },
    });
    if (!link) return c.json({ error: "Invalid or expired link" }, 404);
    if (!link.project.operationsMode) return c.json({ error: "This portal is not active" }, 403);
    if (link.expiresAt && link.expiresAt < new Date()) {
      return c.json({ error: "This link has expired" }, 403);
    }

    const settings = parseProjectSettingsJson(link.project.settingsJson);
    if (!settings.modules.omTenantPortal || !settings.modules.issues) {
      return c.json({ error: "Reporting is disabled for this building" }, 403);
    }

    const gate = requireOmBilling(link.project.workspace);
    if (gate) return c.json({ error: gate.error }, gate.status);

    const body = z
      .object({
        occupantPhotoToken: z.string().min(1).max(200),
        key: z.string().min(1),
        fileName: z.string().min(1),
        contentType: z.string().default("image/jpeg"),
        sizeBytes: z.coerce.bigint(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const issue = await prisma.issue.findFirst({
      where: { id: issueId, projectId: link.projectId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        fileVersionId: true,
        referencePhotos: true,
        occupantPhotoToken: true,
        occupantPhotoTokenExpiresAt: true,
      },
    });
    if (!issue) return c.json({ error: "Not found" }, 404);
    if (
      !issue.occupantPhotoToken ||
      issue.occupantPhotoToken !== body.data.occupantPhotoToken.trim()
    ) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (!issue.occupantPhotoTokenExpiresAt || issue.occupantPhotoTokenExpiresAt < new Date()) {
      return c.json({ error: "Upload window expired" }, 403);
    }

    if (body.data.sizeBytes <= 0n) {
      return c.json({ error: "File is empty" }, 400);
    }
    if (body.data.sizeBytes > MAX_ISSUE_PHOTO_BYTES) {
      return c.json({ error: "File too large (max 15 MB per reference photo)" }, 400);
    }

    if (!s3KeyMatchesIssueReferencePhoto(body.data.key, issue.workspaceId, issue.projectId)) {
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

    const ws = link.project.workspace;
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
        where: { id: issue.workspaceId },
        data: { storageUsedBytes: { increment: body.data.sizeBytes } },
      });
      return tx.issue.update({
        where: { id: issue.id },
        data: { referencePhotos: referencePhotosToJsonValue(next) },
        select: { fileVersionId: true },
      });
    });

    if (collaborationGloballyEnabled(env)) {
      broadcastIssuesChanged(updated.fileVersionId);
    }

    return c.json({ ok: true as const, photoId });
  });
}
