import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { ActivityType, AssetMeterType, InspectionRunStatus, IssueKind, IssuePriority, IssueStatus, MaintenanceFrequency, Prisma, PunchStatus, WorkOrderType, } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isWorkspaceOmBilling, isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectWithAuth } from "../../lib/permissions.js";
import { assertUserAssignableToProject } from "../../lib/projectAccess.js";
import { mergeProjectSettingsPatch, parseProjectSettingsJson } from "../../lib/projectSettings.js";
import { cloneSettingsJson } from "../../lib/takeoffPricing.js";
import { logActivity, logActivitySafe } from "../../lib/activity.js";
import { Resend } from "resend";
import { createUserNotifications } from "../../lib/userNotifications.js";
import { buildAssetDocumentKey, buildAssetImageKey, buildIssueReferencePhotoKey, newUploadId, s3KeyMatchesAssetDocument, s3KeyMatchesAssetImage, s3KeyMatchesIssueReferencePhoto, } from "../../lib/fileUpload.js";
import { ALLOWED_ISSUE_PHOTO_CONTENT_TYPES, MAX_ISSUE_PHOTO_BYTES, MAX_ISSUE_REFERENCE_PHOTOS, parseReferencePhotos, referencePhotosToJsonValue, } from "../../lib/issueReferencePhotos.js";
import { deleteObject, presignGet, presignPut } from "../../lib/s3.js";
import { broadcastIssuesChanged } from "../../lib/viewerCollabHub.js";
import { collaborationGloballyEnabled } from "../../lib/viewerCollabPolicy.js";
import { inviteFromAddress } from "../../lib/inviteEmail.js";
import { buildViewerIssuePath } from "../../lib/issueAssignEmail.js";
import { occupantSubmitRateLimited } from "../../lib/occupantSubmitRateLimit.js";
import { buildTransactionalEmailHtml } from "../../lib/transactionalEmailLayout.js";
import { buildInspectionReportPdfBuffer } from "../../lib/omInspectionReportPdf.js";
import { resolveLevelForCreate, resolveLevelIdFromDrawing, } from "../../lib/locations/resolveLevelFromDrawing.js";
import { addUtcDays, inspectionFrequencyToIntervalDays, validateFailEvidence, } from "../../lib/omInspectionSchedule.js";
function startOfUtcWeek(d) {
    const x = new Date(d);
    const day = x.getUTCDay();
    const diff = (day + 6) % 7;
    x.setUTCDate(x.getUTCDate() - diff);
    x.setUTCHours(0, 0, 0, 0);
    return x;
}
function endOfUtcWeek(weekStart) {
    const e = new Date(weekStart);
    e.setUTCDate(e.getUTCDate() + 7);
    return e;
}
function csvEscapeCell(v) {
    if (/[",\n\r]/.test(v))
        return `"${v.replace(/"/g, '""')}"`;
    return v;
}
function requireOmBilling(workspace) {
    if (!isWorkspaceOmBilling(workspace)) {
        if (!isWorkspacePro(workspace)) {
            return { error: "Pro subscription required", status: 402 };
        }
        return {
            error: "PlanSync Enterprise is required for Operations & Maintenance. Upgrade under Dashboard → Billing (Enterprise includes O&M).",
            status: 402,
        };
    }
    return null;
}
const MAX_ASSET_DOCUMENT_BYTES = 25 * 1024 * 1024;
function addDays(d, n) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
}
function frequencyToNextFrom(frequency, intervalDays, from) {
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
function ppmHealthLabel(nextDueAt, now = new Date()) {
    if (!nextDueAt)
        return "onTrack";
    const d0 = new Date(now);
    d0.setUTCHours(0, 0, 0, 0);
    const due = new Date(nextDueAt);
    due.setUTCHours(0, 0, 0, 0);
    if (due < d0)
        return "overdue";
    const soon = addDays(d0, 30);
    if (due <= soon)
        return "dueSoon";
    return "onTrack";
}
function inspectionResultHasFail(resultJson) {
    if (!Array.isArray(resultJson))
        return false;
    return resultJson.some((r) => r != null &&
        typeof r === "object" &&
        String(r.outcome ?? "").toLowerCase() === "fail");
}
function inspectionRunJson(r) {
    return {
        ...r,
        dueAt: r.dueAt?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    };
}
function workspaceInspectionTemplateJson(t) {
    return {
        id: t.id,
        workspaceId: t.workspaceId,
        name: t.name,
        description: t.description,
        frequency: t.frequency,
        checklistJson: t.checklistJson,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
    };
}
function workspaceWorkOrderTemplateJson(t) {
    return {
        id: t.id,
        workspaceId: t.workspaceId,
        name: t.name,
        description: t.description,
        workOrderType: t.workOrderType,
        priority: t.priority,
        procedureJson: t.procedureJson,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
    };
}
const WORK_ORDER_TYPE_VALUES = [
    "CORRECTIVE",
    "PREVENTIVE",
    "INSPECTION_FOLLOWUP",
    "TENANT",
    "OCCUPANT",
];
const maintenanceScheduleInclude = {
    asset: { select: { id: true, tag: true, name: true, imageS3Key: true } },
    assignedTo: { select: { id: true, name: true, email: true, image: true } },
};
function maintenanceScheduleJson(r, now = new Date()) {
    return {
        id: r.id,
        assetId: r.assetId,
        title: r.title,
        frequency: r.frequency,
        intervalDays: r.intervalDays,
        nextDueAt: r.nextDueAt?.toISOString() ?? null,
        lastCompletedAt: r.lastCompletedAt?.toISOString() ?? null,
        assignedVendorLabel: r.assignedVendorLabel,
        assignedToUserId: r.assignedToUserId,
        assignedTo: r.assignedTo
            ? {
                id: r.assignedTo.id,
                name: r.assignedTo.name,
                email: r.assignedTo.email,
                image: r.assignedTo.image,
            }
            : null,
        isActive: r.isActive,
        meterType: r.meterType,
        meterThreshold: r.meterThreshold != null ? Number(r.meterThreshold) : null,
        asset: {
            id: r.asset.id,
            tag: r.asset.tag,
            name: r.asset.name,
            hasImage: Boolean(r.asset.imageS3Key),
        },
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        health: ppmHealthLabel(r.nextDueAt, now),
    };
}
function notifyMaintenanceAssigned(opts) {
    const label = opts.title.trim() || "Maintenance schedule";
    void createUserNotifications({
        workspaceId: opts.workspaceId,
        projectId: opts.projectId,
        recipientUserIds: [opts.assigneeUserId],
        excludeUserId: opts.actorUserId,
        kind: "MAINTENANCE_ASSIGNED",
        title: `Assigned: ${label.length > 120 ? `${label.slice(0, 120)}…` : label}`,
        body: `Asset ${opts.assetTag}`,
        href: `/projects/${opts.projectId}/om/maintenance`,
        actorUserId: opts.actorUserId,
    }).catch((e) => console.error("[maintenance-assignment-notification]", e));
}
function maintenanceAuditMetadata(row) {
    return {
        scheduleId: row.id,
        title: row.title.trim() || row.frequency,
        assetTag: row.asset.tag,
        assetName: row.asset.name,
        frequency: row.frequency,
        nextDueAt: row.nextDueAt?.toISOString() ?? null,
        lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
    };
}
const maintenanceCompletionInclude = {
    asset: { select: { id: true, tag: true, name: true } },
    schedule: { select: { id: true, title: true, frequency: true } },
    completedBy: { select: { id: true, name: true, email: true, image: true } },
    workOrder: { select: { id: true, title: true, status: true, issueKind: true } },
};
function maintenanceCompletionJson(row) {
    return {
        id: row.id,
        workspaceId: row.workspaceId,
        projectId: row.projectId,
        assetId: row.assetId,
        scheduleId: row.scheduleId,
        completedAt: row.completedAt.toISOString(),
        completedByUserId: row.completedByUserId,
        previousDueAt: row.previousDueAt?.toISOString() ?? null,
        nextDueAt: row.nextDueAt?.toISOString() ?? null,
        workOrderId: row.workOrderId,
        notes: row.notes,
        vendorLabel: row.vendorLabel,
        createdAt: row.createdAt.toISOString(),
        asset: row.asset,
        schedule: row.schedule,
        completedBy: row.completedBy,
        workOrder: row.workOrder,
    };
}
async function createWorkOrderForDueSchedule(opts, db = prisma) {
    if (!opts.schedule.nextDueAt) {
        throw new Error("Schedule has no due date.");
    }
    const existing = await db.issue.findFirst({
        where: {
            projectId: opts.projectId,
            issueKind: IssueKind.WORK_ORDER,
            maintenanceScheduleId: opts.schedule.id,
            maintenanceDueAt: opts.schedule.nextDueAt,
        },
        select: { id: true },
    });
    if (existing)
        return { created: false, issueId: existing.id };
    const title = opts.schedule.title.trim()
        ? opts.schedule.title.trim()
        : `PPM: ${opts.schedule.asset.tag} — ${opts.schedule.frequency}`;
    const issue = await db.issue.create({
        data: {
            workspaceId: opts.workspaceId,
            projectId: opts.projectId,
            fileId: opts.defaultFv.fileId,
            fileVersionId: opts.defaultFv.fileVersionId,
            title,
            description: `Preventive maintenance due for asset ${opts.schedule.asset.tag} (${opts.schedule.asset.name}). Schedule: ${opts.schedule.frequency}. Next due: ${opts.schedule.nextDueAt.toISOString()}.`,
            issueKind: IssueKind.WORK_ORDER,
            workOrderType: WorkOrderType.PREVENTIVE,
            assetId: opts.schedule.assetId,
            status: IssueStatus.OPEN,
            statusChangedAt: new Date(),
            priority: IssuePriority.MEDIUM,
            creatorId: opts.actorUserId,
            assigneeId: opts.schedule.assignedToUserId ?? null,
            maintenanceScheduleId: opts.schedule.id,
            maintenanceDueAt: opts.schedule.nextDueAt,
            sheetName: opts.defaultFv.file.name,
            sheetVersion: opts.defaultFv.fileVersion.version,
        },
        select: { id: true },
    });
    return { created: true, issueId: issue.id };
}
async function getDefaultFileVersion(projectId, db = prisma) {
    const file = await db.file.findFirst({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!file?.versions[0])
        return null;
    return {
        fileId: file.id,
        fileVersionId: file.versions[0].id,
        fileVersion: file.versions[0],
        file,
    };
}
const OCCUPANT_PHOTO_TOKEN_MS = 60 * 60 * 1000;
const omAssetBimAnchorSchema = z
    .object({
    ifcGuid: z.string().min(1).max(64),
    localId: z.number().int().optional(),
    name: z.string().max(300).optional(),
    ifcType: z.string().max(120).optional(),
    spatialPath: z.array(z.string().max(300)).max(20).optional(),
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
    fileVersionId: z.string().max(64).optional(),
})
    .nullable()
    .optional();
/** Shared optional fields on create/patch asset bodies (keeps routes from cloning). */
const omAssetSharedBodyFields = {
    category: z.string().max(120).nullable().optional(),
    manufacturer: z.string().max(200).nullable().optional(),
    model: z.string().max(200).nullable().optional(),
    serialNumber: z.string().max(200).nullable().optional(),
    locationLabel: z.string().max(500).nullable().optional(),
    hall: z.string().max(120).nullable().optional(),
    rowLabel: z.string().max(120).nullable().optional(),
    rack: z.string().max(120).nullable().optional(),
    positionU: z.string().max(120).nullable().optional(),
    installDate: z.string().datetime().nullable().optional(),
    warrantyExpires: z.string().datetime().nullable().optional(),
    lastServiceAt: z.string().datetime().nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    fileId: z.string().nullable().optional(),
    fileVersionId: z.string().nullable().optional(),
    pageNumber: z.number().int().min(1).nullable().optional(),
    annotationId: z.string().nullable().optional(),
    levelId: z.string().nullable().optional(),
    bimAnchor: omAssetBimAnchorSchema,
};
const omAssetInclude = {
    file: { select: { id: true, name: true } },
    fileVersion: { select: { id: true, version: true } },
    level: {
        select: {
            id: true,
            displayName: true,
            buildingId: true,
            building: { select: { id: true, name: true } },
        },
    },
};
function toOmAssetJson(a) {
    const { occupantScanSecret, imageS3Key, imageMimeType: _imageMimeType, imageFileName: _imageFileName, 
    // BigInt — must not be spread into JSON (throws "Do not know how to serialize a BigInt").
    imageSizeBytes: _imageSizeBytes, installDate, warrantyExpires, lastServiceAt, createdAt, updatedAt, level, ...rest } = a;
    return {
        ...rest,
        levelId: a.levelId ?? level?.id ?? null,
        levelName: level?.displayName ?? null,
        buildingId: level?.buildingId ?? level?.building?.id ?? null,
        buildingName: level?.building?.name ?? null,
        hasOccupantQr: Boolean(occupantScanSecret),
        hasImage: Boolean(imageS3Key),
        installDate: installDate?.toISOString() ?? null,
        warrantyExpires: warrantyExpires?.toISOString() ?? null,
        lastServiceAt: lastServiceAt?.toISOString() ?? null,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
    };
}
async function resolveInspectionRunDrawing(projectId, run, db = prisma) {
    let fileId = run.fileId;
    let fileVersionId = run.fileVersionId;
    let pageNumber = run.pageNumber ?? 1;
    if (!fileId || !fileVersionId) {
        const def = await getDefaultFileVersion(projectId, db);
        if (!def)
            return { ok: false, error: "No project drawing to attach" };
        fileId = def.fileId;
        fileVersionId = def.fileVersionId;
        pageNumber = 1;
    }
    return { ok: true, fileId, fileVersionId, pageNumber };
}
/** Create a work order issue linked to the inspection run’s sheet (or project default drawing). */
async function createInspectionRunWorkOrderIssue(projectId, workspaceId, userId, run, params, db = prisma) {
    const draw = await resolveInspectionRunDrawing(projectId, run, db);
    if (!draw.ok)
        return { error: draw.error };
    const file = await db.file.findFirst({
        where: { id: draw.fileId, projectId },
        include: { project: true },
    });
    if (!file)
        return { error: "File not found" };
    const fv = await db.fileVersion.findFirst({
        where: { id: draw.fileVersionId, fileId: file.id },
    });
    if (!fv)
        return { error: "File version not found" };
    const now = new Date();
    const descLines = [
        `From inspection: ${run.template.name}`,
        `Source inspection run: ${run.id}`,
        `Item: ${params.itemLabel}`,
    ];
    if (params.note?.trim())
        descLines.push(`Note: ${params.note.trim()}`);
    const levelResolve = await resolveLevelForCreate({
        projectId,
        fileId: file.id,
        pageNumber: draw.pageNumber,
    });
    const resolvedLevel = levelResolve.level;
    const issue = await db.issue.create({
        data: {
            workspaceId,
            projectId,
            fileId: file.id,
            fileVersionId: fv.id,
            title: params.title.trim(),
            description: descLines.join("\n"),
            status: IssueStatus.OPEN,
            statusChangedAt: now,
            priority: IssuePriority.MEDIUM,
            pageNumber: draw.pageNumber,
            sheetName: file.name,
            sheetVersion: fv.version,
            issueKind: IssueKind.WORK_ORDER,
            workOrderType: WorkOrderType.INSPECTION_FOLLOWUP,
            ...(run.assetId ? { assetId: run.assetId } : {}),
            ...(resolvedLevel
                ? { levelId: resolvedLevel.levelId, buildingId: resolvedLevel.buildingId }
                : {}),
            sourceInspectionRunId: run.id,
            creatorId: userId,
        },
    });
    return { id: issue.id, title: issue.title };
}
async function tryEmailInspectionReportToBuildingOwner(opts) {
    const key = opts.env.RESEND_API_KEY?.trim();
    const from = inviteFromAddress(opts.env);
    if (!key || !from)
        return { ok: false, reason: "resend_not_configured" };
    const resend = new Resend(key);
    const filename = `inspection-${opts.runId.slice(0, 8)}.pdf`;
    const subject = `Inspection report: ${opts.templateName} — ${opts.projectName}`;
    const lines = [
        `A completed inspection report is attached for ${opts.projectName}.`,
        `Template: ${opts.templateName}`,
        `Completed (UTC): ${opts.completedAt.toISOString().replace("T", " ").slice(0, 19)}`,
    ];
    if (opts.signedByName?.trim())
        lines.push(`Signed off by: ${opts.signedByName.trim()}`);
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
export function registerOmRoutes(r, needUser, env) {
    // --- Assets ---
    r.get("/projects/:projectId/om/assets", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const qRaw = c.req.query("q")?.trim();
        const searchWhere = qRaw && qRaw.length > 0
            ? {
                OR: [
                    { tag: { contains: qRaw, mode: "insensitive" } },
                    { name: { contains: qRaw, mode: "insensitive" } },
                    { manufacturer: { contains: qRaw, mode: "insensitive" } },
                    { model: { contains: qRaw, mode: "insensitive" } },
                    { serialNumber: { contains: qRaw, mode: "insensitive" } },
                    { locationLabel: { contains: qRaw, mode: "insensitive" } },
                    { hall: { contains: qRaw, mode: "insensitive" } },
                    { rowLabel: { contains: qRaw, mode: "insensitive" } },
                    { rack: { contains: qRaw, mode: "insensitive" } },
                    { positionU: { contains: qRaw, mode: "insensitive" } },
                    { notes: { contains: qRaw, mode: "insensitive" } },
                    { category: { contains: qRaw, mode: "insensitive" } },
                    { file: { name: { contains: qRaw, mode: "insensitive" } } },
                ],
            }
            : {};
        const rows = await prisma.asset.findMany({
            where: { projectId, ...searchWhere },
            orderBy: [{ tag: "asc" }],
            include: omAssetInclude,
        });
        return c.json(rows.map(toOmAssetJson));
    });
    // fallow-ignore-next-line complexity
    r.post("/projects/:projectId/om/assets", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            tag: z.string().min(1).max(80),
            name: z.string().min(1).max(500),
            ...omAssetSharedBodyFields,
            pinJson: z.unknown().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const d = body.data;
        if (d.fileId && d.fileVersionId) {
            const fv = await prisma.fileVersion.findFirst({
                where: { id: d.fileVersionId, fileId: d.fileId, file: { projectId } },
            });
            if (!fv)
                return c.json({ error: "File version not found in this project" }, 400);
        }
        else if (d.fileId || d.fileVersionId) {
            return c.json({ error: "fileId and fileVersionId must be set together" }, 400);
        }
        if (d.bimAnchor && !(d.fileId && d.fileVersionId)) {
            return c.json({ error: "bimAnchor requires fileId and fileVersionId" }, 400);
        }
        const levelResolve = await resolveLevelForCreate({
            projectId,
            fileId: d.fileId ?? null,
            pageNumber: d.pageNumber ?? null,
            explicitLevelId: d.levelId,
            bimStoreyName: d.bimAnchor?.spatialPath?.[0] ?? null,
        });
        if (levelResolve.error)
            return c.json({ error: levelResolve.error }, 400);
        const resolvedLevel = levelResolve.level;
        const locationLabel = d.locationLabel !== undefined ? d.locationLabel : (resolvedLevel?.levelName ?? null);
        const occupantScanSecret = ctx.settings.modules.omTenantPortal
            ? randomBytes(24).toString("hex")
            : null;
        let row;
        try {
            row = await prisma.asset.create({
                data: {
                    projectId,
                    tag: d.tag.trim(),
                    name: d.name.trim(),
                    category: d.category?.trim() ? d.category.trim() : null,
                    manufacturer: d.manufacturer ?? null,
                    model: d.model ?? null,
                    serialNumber: d.serialNumber ?? null,
                    locationLabel,
                    hall: d.hall ?? null,
                    rowLabel: d.rowLabel ?? null,
                    rack: d.rack ?? null,
                    positionU: d.positionU ?? null,
                    installDate: d.installDate ? new Date(d.installDate) : null,
                    warrantyExpires: d.warrantyExpires ? new Date(d.warrantyExpires) : null,
                    lastServiceAt: d.lastServiceAt ? new Date(d.lastServiceAt) : null,
                    notes: d.notes ?? null,
                    fileId: d.fileId ?? null,
                    fileVersionId: d.fileVersionId ?? null,
                    pageNumber: d.pageNumber ?? null,
                    annotationId: d.annotationId ?? null,
                    levelId: resolvedLevel?.levelId ?? null,
                    pinJson: d.pinJson === undefined ? undefined : d.pinJson,
                    bimAnchor: d.bimAnchor === undefined || d.bimAnchor === null
                        ? undefined
                        : d.bimAnchor,
                    ...(occupantScanSecret ? { occupantScanSecret } : {}),
                },
                include: omAssetInclude,
            });
        }
        catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === "P2002" &&
                Array.isArray(e.meta?.target) &&
                e.meta.target.includes("projectId") &&
                e.meta.target.includes("tag")) {
                return c.json({ error: "Asset tag already exists in this project" }, 409);
            }
            throw e;
        }
        await logActivity(ctx.project.workspaceId, ActivityType.PROJECT_UPDATED, {
            actorUserId: c.get("user").id,
            entityId: row.id,
            projectId,
            metadata: { omAssetCreated: row.tag },
        });
        return c.json(toOmAssetJson(row));
    });
    // fallow-ignore-next-line complexity
    r.patch("/projects/:projectId/om/assets/:assetId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            tag: z.string().min(1).max(80).optional(),
            name: z.string().min(1).max(500).optional(),
            ...omAssetSharedBodyFields,
            pinJson: z.unknown().nullable().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const d = body.data;
        if (d.fileId !== undefined || d.fileVersionId !== undefined) {
            const nf = d.fileId ?? existing.fileId;
            const nv = d.fileVersionId ?? existing.fileVersionId;
            if (nf && nv) {
                const fv = await prisma.fileVersion.findFirst({
                    where: { id: nv, fileId: nf, file: { projectId } },
                });
                if (!fv)
                    return c.json({ error: "File version not found in this project" }, 400);
            }
            else if (nf || nv) {
                return c.json({ error: "fileId and fileVersionId must be set together" }, 400);
            }
        }
        if (d.bimAnchor) {
            const nf = d.fileId !== undefined ? d.fileId : existing.fileId;
            const nv = d.fileVersionId !== undefined ? d.fileVersionId : existing.fileVersionId;
            if (!nf || !nv) {
                return c.json({ error: "bimAnchor requires fileId and fileVersionId" }, 400);
            }
        }
        let patchLevelId = undefined;
        if (d.levelId !== undefined) {
            if (d.levelId === null) {
                patchLevelId = null;
            }
            else {
                const resolved = await resolveLevelIdFromDrawing({
                    projectId,
                    explicitLevelId: d.levelId,
                });
                if (!resolved)
                    return c.json({ error: "Level not found in this project" }, 400);
                patchLevelId = resolved.levelId;
            }
        }
        else if (d.fileId !== undefined || d.pageNumber !== undefined) {
            const nextFileId = d.fileId !== undefined ? d.fileId : existing.fileId;
            const nextPage = d.pageNumber !== undefined ? d.pageNumber : existing.pageNumber;
            if (nextFileId) {
                const resolved = await resolveLevelIdFromDrawing({
                    projectId,
                    fileId: nextFileId,
                    pageNumber: nextPage,
                });
                if (resolved)
                    patchLevelId = resolved.levelId;
            }
            else if (d.fileId === null) {
                patchLevelId = null;
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
                ...(d.hall !== undefined ? { hall: d.hall } : {}),
                ...(d.rowLabel !== undefined ? { rowLabel: d.rowLabel } : {}),
                ...(d.rack !== undefined ? { rack: d.rack } : {}),
                ...(d.positionU !== undefined ? { positionU: d.positionU } : {}),
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
                ...(patchLevelId !== undefined ? { levelId: patchLevelId } : {}),
                ...(d.pinJson !== undefined
                    ? { pinJson: d.pinJson }
                    : {}),
                ...(d.bimAnchor !== undefined
                    ? {
                        bimAnchor: d.bimAnchor === null ? Prisma.DbNull : d.bimAnchor,
                    }
                    : {}),
            },
            include: omAssetInclude,
        });
        return c.json(toOmAssetJson(row));
    });
    r.post("/projects/:projectId/om/assets/:assetId/occupant-scan-secret", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
            return c.json({ error: "Forbidden" }, 403);
        }
        if (!ctx.project.operationsMode ||
            !ctx.settings.modules.omAssets ||
            !ctx.settings.modules.omTenantPortal) {
            return c.json({ error: "Not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({ rotate: z.boolean().optional() })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
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
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!asset)
            return c.json({ error: "Not found" }, 404);
        const docs = await prisma.assetDocument.findMany({
            where: { assetId },
            orderBy: { createdAt: "desc" },
            include: { uploadedBy: { select: { id: true, name: true } } },
        });
        return c.json(docs.map((d) => ({
            id: d.id,
            assetId: d.assetId,
            label: d.label,
            fileName: d.fileName,
            mimeType: d.mimeType,
            sizeBytes: d.sizeBytes.toString(),
            uploadedBy: d.uploadedBy,
            createdAt: d.createdAt.toISOString(),
        })));
    });
    r.post("/projects/:projectId/om/assets/:assetId/documents/presign", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!asset)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            fileName: z.string().min(1),
            contentType: z.string().default("application/octet-stream"),
            sizeBytes: z.coerce.bigint(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        if (body.data.sizeBytes <= 0n)
            return c.json({ error: "File is empty" }, 400);
        if (body.data.sizeBytes > BigInt(MAX_ASSET_DOCUMENT_BYTES)) {
            return c.json({ error: "File too large (max 25 MB per document)" }, 400);
        }
        const ws = ctx.project.workspace;
        const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        const uploadId = newUploadId();
        const key = buildAssetDocumentKey(ctx.project.workspaceId, projectId, assetId, uploadId, body.data.fileName);
        let url;
        try {
            url = await presignPut(env, key, body.data.contentType);
        }
        catch (e) {
            console.error("[asset document presign]", e);
            return c.json({ error: "Could not create upload URL. Check S3 credentials and bucket configuration." }, 503);
        }
        if (!url) {
            return c.json({ error: "S3 not configured — set AWS_* and S3_BUCKET", devKey: key }, 503);
        }
        return c.json({ uploadUrl: url, key });
    });
    r.post("/projects/:projectId/om/assets/:assetId/documents/complete", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!asset)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            key: z.string().min(1),
            label: z.string().max(200).optional(),
            fileName: z.string().min(1),
            mimeType: z.string().default("application/octet-stream"),
            sizeBytes: z.coerce.bigint(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        if (body.data.sizeBytes <= 0n)
            return c.json({ error: "File is empty" }, 400);
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
        const displayLabel = labelTrim.length > 0
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
    r.get("/projects/:projectId/om/assets/:assetId/documents/:documentId/presign-read", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const documentId = c.req.param("documentId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Not found" }, 404);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const doc = await prisma.assetDocument.findFirst({
            where: { id: documentId, assetId, asset: { projectId } },
        });
        if (!doc)
            return c.json({ error: "Not found" }, 404);
        let url;
        try {
            url = await presignGet(env, doc.s3Key);
        }
        catch (e) {
            console.error("[asset document presign-read]", e);
            return c.json({ error: "Could not create download link (S3)." }, 503);
        }
        if (!url)
            return c.json({ error: "S3 not configured" }, 503);
        return c.json({ url });
    });
    r.delete("/projects/:projectId/om/assets/:assetId/documents/:documentId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const documentId = c.req.param("documentId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const doc = await prisma.assetDocument.findFirst({
            where: { id: documentId, assetId, asset: { projectId } },
        });
        if (!doc)
            return c.json({ error: "Not found" }, 404);
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
        return c.json({ ok: true });
    });
    r.post("/projects/:projectId/om/assets/:assetId/image/presign", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!asset)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            fileName: z.string().min(1),
            contentType: z.string().default("application/octet-stream"),
            sizeBytes: z.coerce.bigint(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const ct = body.data.contentType.trim().toLowerCase();
        if (!ALLOWED_ISSUE_PHOTO_CONTENT_TYPES.has(ct)) {
            return c.json({ error: "Only JPEG, PNG, WebP, GIF, or HEIC/HEIF images are allowed" }, 400);
        }
        if (body.data.sizeBytes <= 0n)
            return c.json({ error: "File is empty" }, 400);
        if (body.data.sizeBytes > MAX_ISSUE_PHOTO_BYTES) {
            return c.json({ error: "File too large (max 15 MB per image)" }, 400);
        }
        const ws = ctx.project.workspace;
        const reclaim = asset.imageSizeBytes ?? 0n;
        const newUsed = ws.storageUsedBytes - reclaim + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        const uploadId = newUploadId();
        const key = buildAssetImageKey(ctx.project.workspaceId, projectId, assetId, uploadId, body.data.fileName);
        let url;
        try {
            url = await presignPut(env, key, ct);
        }
        catch (e) {
            console.error("[asset image presign]", e);
            return c.json({ error: "Could not create upload URL. Check S3 credentials and bucket configuration." }, 503);
        }
        if (!url) {
            return c.json({ error: "S3 not configured — set AWS_* and S3_BUCKET", devKey: key }, 503);
        }
        return c.json({ uploadUrl: url, key });
    });
    // fallow-ignore-next-line complexity
    r.post("/projects/:projectId/om/assets/:assetId/image/complete", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!asset)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            key: z.string().min(1),
            fileName: z.string().min(1),
            contentType: z.string().default("application/octet-stream"),
            sizeBytes: z.coerce.bigint(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const ct = body.data.contentType.trim().toLowerCase();
        if (!ALLOWED_ISSUE_PHOTO_CONTENT_TYPES.has(ct)) {
            return c.json({ error: "Only JPEG, PNG, WebP, GIF, or HEIC/HEIF images are allowed" }, 400);
        }
        if (body.data.sizeBytes <= 0n)
            return c.json({ error: "File is empty" }, 400);
        if (body.data.sizeBytes > MAX_ISSUE_PHOTO_BYTES) {
            return c.json({ error: "File too large (max 15 MB per image)" }, 400);
        }
        if (!s3KeyMatchesAssetImage(body.data.key, ctx.project.workspaceId, projectId, assetId)) {
            return c.json({ error: "Invalid upload key" }, 400);
        }
        const ws = ctx.project.workspace;
        const reclaim = asset.imageSizeBytes ?? 0n;
        const newUsed = ws.storageUsedBytes - reclaim + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        if (asset.imageS3Key && asset.imageS3Key !== body.data.key) {
            const del = await deleteObject(env, asset.imageS3Key);
            if (!del.ok && del.error !== "S3 not configured") {
                console.warn(`[asset image replace] deleteObject ${asset.imageS3Key}:`, del.error);
            }
        }
        const storageDelta = body.data.sizeBytes - reclaim;
        const row = await prisma.$transaction(async (tx) => {
            const updated = await tx.asset.update({
                where: { id: assetId },
                data: {
                    imageS3Key: body.data.key,
                    imageMimeType: ct,
                    imageFileName: body.data.fileName,
                    imageSizeBytes: body.data.sizeBytes,
                },
                include: omAssetInclude,
            });
            if (storageDelta !== 0n) {
                await tx.workspace.update({
                    where: { id: ctx.project.workspaceId },
                    data: { storageUsedBytes: { increment: storageDelta } },
                });
            }
            return updated;
        });
        await logActivity(ctx.project.workspaceId, ActivityType.PROJECT_UPDATED, {
            actorUserId: c.get("user").id,
            entityId: assetId,
            projectId,
            metadata: { omAssetImageUpdated: body.data.fileName, assetTag: asset.tag },
        });
        return c.json(toOmAssetJson(row));
    });
    r.get("/projects/:projectId/om/assets/:assetId/image/presign-read", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Not found" }, 404);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!asset?.imageS3Key)
            return c.json({ error: "Not found" }, 404);
        let url;
        try {
            url = await presignGet(env, asset.imageS3Key);
        }
        catch (e) {
            console.error("[asset image presign-read]", e);
            return c.json({ error: "Could not create download link (S3)." }, 503);
        }
        if (!url)
            return c.json({ error: "S3 not configured" }, 503);
        return c.json({ url });
    });
    r.delete("/projects/:projectId/om/assets/:assetId/image", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const asset = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!asset?.imageS3Key)
            return c.json({ error: "Not found" }, 404);
        const del = await deleteObject(env, asset.imageS3Key);
        if (!del.ok && del.error !== "S3 not configured") {
            return c.json({ error: del.error }, 503);
        }
        const dec = asset.imageSizeBytes ?? 0n;
        const row = await prisma.$transaction(async (tx) => {
            const updated = await tx.asset.update({
                where: { id: assetId },
                data: {
                    imageS3Key: null,
                    imageMimeType: null,
                    imageFileName: null,
                    imageSizeBytes: null,
                },
                include: omAssetInclude,
            });
            if (dec > 0n) {
                await tx.workspace.update({
                    where: { id: ctx.project.workspaceId },
                    data: { storageUsedBytes: { decrement: dec } },
                });
            }
            return updated;
        });
        return c.json(toOmAssetJson(row));
    });
    r.delete("/projects/:projectId/om/assets/:assetId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const docs = await prisma.assetDocument.findMany({ where: { assetId } });
        let dec = existing.imageSizeBytes ?? 0n;
        if (existing.imageS3Key) {
            const imgDel = await deleteObject(env, existing.imageS3Key);
            if (!imgDel.ok && imgDel.error !== "S3 not configured") {
                console.warn(`[asset delete] deleteObject ${existing.imageS3Key}:`, imgDel.error);
            }
        }
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
        return c.json({ ok: true });
    });
    // --- Maintenance (PPM) ---
    r.get("/projects/:projectId/om/maintenance", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
            return c.json({ error: "Maintenance module is not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.maintenanceSchedule.findMany({
            where: { asset: { projectId } },
            include: maintenanceScheduleInclude,
            orderBy: [{ nextDueAt: "asc" }],
        });
        const now = new Date();
        return c.json(rows.map((r) => maintenanceScheduleJson(r, now)));
    });
    r.get("/projects/:projectId/om/maintenance/completions", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
            return c.json({ error: "Maintenance module is not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const limit = Math.min(300, Math.max(1, Number(c.req.query("limit")) || 100));
        const assetId = c.req.query("assetId")?.trim();
        if (assetId) {
            const exists = await prisma.asset.count({ where: { id: assetId, projectId } });
            if (exists === 0)
                return c.json({ error: "Asset not found" }, 404);
        }
        const rows = await prisma.maintenanceCompletion.findMany({
            where: { projectId, ...(assetId ? { assetId } : {}) },
            include: maintenanceCompletionInclude,
            orderBy: [{ completedAt: "desc" }],
            take: limit,
        });
        return c.json(rows.map(maintenanceCompletionJson));
    });
    r.post("/projects/:projectId/om/maintenance", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
            return c.json({ error: "Maintenance module is not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            assetId: z.string(),
            title: z.string().max(200).optional(),
            frequency: z.nativeEnum(MaintenanceFrequency),
            intervalDays: z.number().int().min(1).max(3650).nullable().optional(),
            nextDueAt: z.string().datetime().nullable().optional(),
            assignedVendorLabel: z.string().max(200).nullable().optional(),
            assignedToUserId: z.string().nullable().optional(),
            meterType: z.nativeEnum(AssetMeterType).nullable().optional(),
            meterThreshold: z.number().min(0).nullable().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const asset = await prisma.asset.findFirst({ where: { id: body.data.assetId, projectId } });
        if (!asset)
            return c.json({ error: "Asset not found" }, 404);
        if (body.data.meterThreshold != null && !body.data.meterType) {
            return c.json({ error: "meterType is required when meterThreshold is set" }, 400);
        }
        if (body.data.assignedToUserId) {
            const assignCheck = await assertUserAssignableToProject(body.data.assignedToUserId, projectId, ctx.project.workspaceId);
            if ("error" in assignCheck)
                return c.json({ error: assignCheck.error }, assignCheck.status);
        }
        let nextDue = body.data.nextDueAt ? new Date(body.data.nextDueAt) : new Date();
        if (!body.data.nextDueAt) {
            nextDue = frequencyToNextFrom(body.data.frequency, body.data.intervalDays ?? null, new Date());
        }
        const row = await prisma.maintenanceSchedule.create({
            data: {
                assetId: asset.id,
                title: body.data.title?.trim() ?? "",
                frequency: body.data.frequency,
                intervalDays: body.data.intervalDays ?? null,
                nextDueAt: nextDue,
                assignedVendorLabel: body.data.assignedVendorLabel ?? null,
                assignedToUserId: body.data.assignedToUserId ?? null,
                meterType: body.data.meterType ?? null,
                meterThreshold: body.data.meterThreshold ?? null,
            },
            include: maintenanceScheduleInclude,
        });
        if (row.assignedToUserId) {
            notifyMaintenanceAssigned({
                workspaceId: ctx.project.workspaceId,
                projectId,
                assigneeUserId: row.assignedToUserId,
                actorUserId: c.get("user").id,
                assetTag: row.asset.tag,
                title: row.title,
            });
        }
        await logActivitySafe(ctx.project.workspaceId, ActivityType.MAINTENANCE_SCHEDULE_CREATED, {
            actorUserId: c.get("user").id,
            entityType: "MaintenanceSchedule",
            entityId: row.id,
            projectId,
            metadata: maintenanceAuditMetadata(row),
        });
        return c.json(maintenanceScheduleJson(row));
    });
    r.patch("/projects/:projectId/om/maintenance/:scheduleId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const scheduleId = c.req.param("scheduleId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
            return c.json({ error: "Maintenance module is not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.maintenanceSchedule.findFirst({
            where: { id: scheduleId, asset: { projectId } },
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            title: z.string().max(200).optional(),
            frequency: z.nativeEnum(MaintenanceFrequency).optional(),
            intervalDays: z.number().int().min(1).max(3650).nullable().optional(),
            nextDueAt: z.string().datetime().nullable().optional(),
            lastCompletedAt: z.string().datetime().nullable().optional(),
            assignedVendorLabel: z.string().max(200).nullable().optional(),
            assignedToUserId: z.string().nullable().optional(),
            isActive: z.boolean().optional(),
            meterType: z.nativeEnum(AssetMeterType).nullable().optional(),
            meterThreshold: z.number().min(0).nullable().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const d = body.data;
        if (d.meterThreshold != null && d.meterType === undefined && !existing.meterType) {
            return c.json({ error: "meterType is required when meterThreshold is set" }, 400);
        }
        if (d.assignedToUserId) {
            const assignCheck = await assertUserAssignableToProject(d.assignedToUserId, projectId, ctx.project.workspaceId);
            if ("error" in assignCheck)
                return c.json({ error: assignCheck.error }, assignCheck.status);
        }
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
                ...(d.assignedToUserId !== undefined ? { assignedToUserId: d.assignedToUserId } : {}),
                ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
                ...(d.meterType !== undefined ? { meterType: d.meterType } : {}),
                ...(d.meterThreshold !== undefined ? { meterThreshold: d.meterThreshold } : {}),
            },
            include: maintenanceScheduleInclude,
        });
        if (d.assignedToUserId &&
            d.assignedToUserId !== existing.assignedToUserId &&
            d.assignedToUserId !== c.get("user").id) {
            notifyMaintenanceAssigned({
                workspaceId: ctx.project.workspaceId,
                projectId,
                assigneeUserId: d.assignedToUserId,
                actorUserId: c.get("user").id,
                assetTag: row.asset.tag,
                title: row.title,
            });
        }
        await logActivitySafe(ctx.project.workspaceId, ActivityType.MAINTENANCE_SCHEDULE_UPDATED, {
            actorUserId: c.get("user").id,
            entityType: "MaintenanceSchedule",
            entityId: row.id,
            projectId,
            metadata: maintenanceAuditMetadata(row),
        });
        return c.json(maintenanceScheduleJson(row));
    });
    /** Create a work order for one due schedule occurrence. */
    r.post("/projects/:projectId/om/maintenance/:scheduleId/create-work-order", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const scheduleId = c.req.param("scheduleId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
            return c.json({ error: "Maintenance module is not enabled" }, 403);
        }
        if (!ctx.settings.modules.issues) {
            return c.json({ error: "Issues/work orders module is disabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const defaultFv = await getDefaultFileVersion(projectId);
        if (!defaultFv) {
            return c.json({ error: "Upload at least one PDF before generating work orders" }, 400);
        }
        const endToday = new Date();
        endToday.setUTCHours(23, 59, 59, 999);
        const schedule = await prisma.maintenanceSchedule.findFirst({
            where: {
                id: scheduleId,
                isActive: true,
                asset: { projectId },
            },
            include: { asset: true },
        });
        if (!schedule)
            return c.json({ error: "Schedule not found" }, 404);
        if (!schedule.nextDueAt || schedule.nextDueAt > endToday) {
            return c.json({ error: "Schedule is not due yet" }, 400);
        }
        const made = await createWorkOrderForDueSchedule({
            schedule,
            projectId,
            workspaceId: ctx.project.workspaceId,
            actorUserId: c.get("user").id,
            defaultFv,
        }, prisma);
        await logActivitySafe(ctx.project.workspaceId, ActivityType.MAINTENANCE_WORK_ORDERS_GENERATED, {
            actorUserId: c.get("user").id,
            entityType: "MaintenanceSchedule",
            entityId: schedule.id,
            projectId,
            metadata: {
                workOrderCount: made.created ? 1 : 0,
                workOrderIds: [made.issueId],
                scheduleIds: [schedule.id],
                deduped: !made.created,
            },
        });
        return c.json({ created: made.created, issueId: made.issueId });
    });
    /** Create work orders (issues) for schedules that are due or overdue. */
    r.post("/projects/:projectId/om/maintenance/generate-work-orders", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
            return c.json({ error: "Maintenance module is not enabled" }, 403);
        }
        if (!ctx.settings.modules.issues) {
            return c.json({ error: "Issues/work orders module is disabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
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
        const created = [];
        const existing = [];
        for (const s of due) {
            const made = await createWorkOrderForDueSchedule({
                schedule: s,
                projectId,
                workspaceId: ctx.project.workspaceId,
                actorUserId: c.get("user").id,
                defaultFv,
            }, prisma);
            if (made.created)
                created.push(made.issueId);
            else
                existing.push(made.issueId);
        }
        await logActivitySafe(ctx.project.workspaceId, ActivityType.MAINTENANCE_WORK_ORDERS_GENERATED, {
            actorUserId: c.get("user").id,
            entityType: "Project",
            entityId: projectId,
            projectId,
            metadata: {
                workOrderCount: created.length,
                workOrderIds: created,
                scheduleIds: due.map((s) => s.id),
                skippedExistingCount: existing.length,
                skippedExistingWorkOrderIds: existing,
            },
        });
        return c.json({ createdIds: created, existingIds: existing });
    });
    r.post("/projects/:projectId/om/maintenance/:scheduleId/complete", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const scheduleId = c.req.param("scheduleId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omMaintenance) {
            return c.json({ error: "Maintenance module is not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.maintenanceSchedule.findFirst({
            where: { id: scheduleId, asset: { projectId } },
            include: { asset: true },
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            notes: z.string().max(2000).optional(),
            workOrderId: z.string().optional(),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        let workOrderId = null;
        if (body.data.workOrderId?.trim()) {
            const wo = await prisma.issue.findFirst({
                where: {
                    id: body.data.workOrderId.trim(),
                    projectId,
                    issueKind: IssueKind.WORK_ORDER,
                },
                select: {
                    id: true,
                    maintenanceScheduleId: true,
                    completionEvidenceRequired: true,
                    procedureJson: true,
                    procedureResultJson: true,
                    referencePhotos: true,
                    status: true,
                },
            });
            if (!wo)
                return c.json({ error: "Work order not found" }, 404);
            if (wo.maintenanceScheduleId && wo.maintenanceScheduleId !== existing.id) {
                return c.json({ error: "Work order is linked to another schedule" }, 400);
            }
            if (wo.status !== IssueStatus.RESOLVED && wo.status !== IssueStatus.CLOSED) {
                return c.json({ error: "Complete the linked work order before marking PM done" }, 400);
            }
            workOrderId = wo.id;
        }
        const completedAt = new Date();
        const previousDueAt = existing.nextDueAt;
        const next = frequencyToNextFrom(existing.frequency, existing.intervalDays, completedAt);
        const { row, completion } = await prisma.$transaction(async (tx) => {
            const row = await tx.maintenanceSchedule.update({
                where: { id: scheduleId },
                data: {
                    lastCompletedAt: completedAt,
                    nextDueAt: next,
                },
                include: maintenanceScheduleInclude,
            });
            const completion = await tx.maintenanceCompletion.create({
                data: {
                    workspaceId: ctx.project.workspaceId,
                    projectId,
                    assetId: existing.assetId,
                    scheduleId,
                    completedAt,
                    completedByUserId: c.get("user").id,
                    previousDueAt,
                    nextDueAt: next,
                    workOrderId,
                    notes: body.data.notes?.trim() || null,
                    vendorLabel: row.assignedVendorLabel ?? null,
                },
                include: maintenanceCompletionInclude,
            });
            return { row, completion };
        });
        await logActivitySafe(ctx.project.workspaceId, ActivityType.MAINTENANCE_SCHEDULE_COMPLETED, {
            actorUserId: c.get("user").id,
            entityType: "MaintenanceSchedule",
            entityId: row.id,
            projectId,
            metadata: {
                ...maintenanceAuditMetadata(row),
                completionId: completion.id,
                workOrderId: completion.workOrderId,
                notes: completion.notes,
                completedAt: completedAt.toISOString(),
            },
        });
        return c.json({
            ...maintenanceScheduleJson(row),
            completion: maintenanceCompletionJson(completion),
        });
    });
    // --- Workspace inspection templates (org library) ---
    // fallow-ignore-next-line code-duplication
    r.get("/workspaces/:workspaceId/om/inspection-templates", needUser, async (c) => {
        const workspaceId = c.req.param("workspaceId");
        const m = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
            include: {
                workspace: {
                    select: {
                        subscriptionStatus: true,
                        currentPeriodEnd: true,
                        stripeSubscriptionId: true,
                        billingPlan: true,
                    },
                },
            },
        });
        if (!m || m.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requireOmBilling(m.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.workspaceInspectionTemplate.findMany({
            where: { workspaceId },
            orderBy: { name: "asc" },
        });
        return c.json(rows.map(workspaceInspectionTemplateJson));
    });
    // fallow-ignore-next-line code-duplication
    r.post("/workspaces/:workspaceId/om/inspection-templates", needUser, async (c) => {
        const workspaceId = c.req.param("workspaceId");
        const m = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
            include: {
                workspace: {
                    select: {
                        subscriptionStatus: true,
                        currentPeriodEnd: true,
                        stripeSubscriptionId: true,
                        billingPlan: true,
                    },
                },
            },
        });
        if (!m || m.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requireOmBilling(m.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            name: z.string().min(1).max(300),
            description: z.string().max(2000).nullable().optional(),
            // fallow-ignore-next-line code-duplication
            frequency: z.string().max(80).nullable().optional(),
            checklistJson: z.array(z.object({
                id: z.string(),
                label: z.string(),
                type: z.enum(["checkbox", "passfail", "text", "photo"]),
                level: z.string().max(120).optional(),
            })),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const row = await prisma.workspaceInspectionTemplate.create({
            data: {
                workspaceId,
                name: body.data.name.trim(),
                description: body.data.description ?? null,
                frequency: body.data.frequency?.trim() || null,
                checklistJson: body.data.checklistJson,
            },
        });
        return c.json(workspaceInspectionTemplateJson(row));
    });
    // fallow-ignore-next-line code-duplication
    r.patch("/workspaces/:workspaceId/om/inspection-templates/:id", needUser, async (c) => {
        const workspaceId = c.req.param("workspaceId");
        const id = c.req.param("id");
        const m = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
            include: {
                workspace: {
                    select: {
                        subscriptionStatus: true,
                        currentPeriodEnd: true,
                        stripeSubscriptionId: true,
                        billingPlan: true,
                    },
                },
            },
        });
        if (!m || m.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requireOmBilling(m.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.workspaceInspectionTemplate.findFirst({
            where: { id, workspaceId },
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            name: z.string().min(1).max(300).optional(),
            description: z.string().max(2000).nullable().optional(),
            // fallow-ignore-next-line code-duplication
            frequency: z.string().max(80).nullable().optional(),
            checklistJson: z
                .array(z.object({
                id: z.string(),
                label: z.string(),
                type: z.enum(["checkbox", "passfail", "text", "photo"]),
                level: z.string().max(120).optional(),
                // fallow-ignore-next-line code-duplication
            }))
                .optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const row = await prisma.workspaceInspectionTemplate.update({
            where: { id },
            data: {
                ...(body.data.name !== undefined ? { name: body.data.name.trim() } : {}),
                ...(body.data.description !== undefined ? { description: body.data.description } : {}),
                ...(body.data.frequency !== undefined
                    ? { frequency: body.data.frequency?.trim() || null }
                    : {}),
                ...(body.data.checklistJson !== undefined
                    ? { checklistJson: body.data.checklistJson }
                    : {}),
            },
        });
        return c.json(workspaceInspectionTemplateJson(row));
    });
    // fallow-ignore-next-line code-duplication
    r.delete("/workspaces/:workspaceId/om/inspection-templates/:id", needUser, async (c) => {
        const workspaceId = c.req.param("workspaceId");
        const id = c.req.param("id");
        const m = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
            include: {
                workspace: {
                    select: {
                        subscriptionStatus: true,
                        currentPeriodEnd: true,
                        stripeSubscriptionId: true,
                        billingPlan: true,
                    },
                },
            },
        });
        if (!m || m.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requireOmBilling(m.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.workspaceInspectionTemplate.findFirst({
            where: { id, workspaceId },
            select: { id: true },
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        await prisma.workspaceInspectionTemplate.delete({ where: { id } });
        return c.json({ ok: true });
    });
    // --- Workspace work-order templates (org library) ---
    // fallow-ignore-next-line code-duplication
    r.get("/workspaces/:workspaceId/om/work-order-templates", needUser, async (c) => {
        const workspaceId = c.req.param("workspaceId");
        const m = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
            include: {
                workspace: {
                    select: {
                        subscriptionStatus: true,
                        currentPeriodEnd: true,
                        stripeSubscriptionId: true,
                        billingPlan: true,
                    },
                },
            },
        });
        if (!m || m.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requireOmBilling(m.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.workspaceWorkOrderTemplate.findMany({
            where: { workspaceId },
            orderBy: { name: "asc" },
        });
        return c.json(rows.map(workspaceWorkOrderTemplateJson));
    });
    // fallow-ignore-next-line code-duplication
    r.post("/workspaces/:workspaceId/om/work-order-templates", needUser, async (c) => {
        const workspaceId = c.req.param("workspaceId");
        const m = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
            include: {
                workspace: {
                    select: {
                        subscriptionStatus: true,
                        currentPeriodEnd: true,
                        stripeSubscriptionId: true,
                        billingPlan: true,
                    },
                },
            },
        });
        if (!m || m.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requireOmBilling(m.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            name: z.string().min(1).max(300),
            description: z.string().max(2000).nullable().optional(),
            workOrderType: z.enum(WORK_ORDER_TYPE_VALUES).optional(),
            priority: z.nativeEnum(IssuePriority).nullable().optional(),
            procedureJson: z.array(z.object({
                id: z.string(),
                label: z.string(),
                type: z.enum(["checkbox", "passfail", "text", "photo"]).optional(),
                required: z.boolean().optional(),
            })),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const row = await prisma.workspaceWorkOrderTemplate.create({
            data: {
                workspaceId,
                name: body.data.name.trim(),
                description: body.data.description ?? null,
                workOrderType: body.data.workOrderType ?? "CORRECTIVE",
                priority: body.data.priority ?? null,
                procedureJson: body.data.procedureJson,
            },
        });
        return c.json(workspaceWorkOrderTemplateJson(row));
    });
    // fallow-ignore-next-line code-duplication
    r.patch("/workspaces/:workspaceId/om/work-order-templates/:id", needUser, async (c) => {
        const workspaceId = c.req.param("workspaceId");
        const id = c.req.param("id");
        const m = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
            include: {
                workspace: {
                    select: {
                        subscriptionStatus: true,
                        currentPeriodEnd: true,
                        stripeSubscriptionId: true,
                        billingPlan: true,
                    },
                },
            },
        });
        if (!m || m.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requireOmBilling(m.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.workspaceWorkOrderTemplate.findFirst({
            where: { id, workspaceId },
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            name: z.string().min(1).max(300).optional(),
            description: z.string().max(2000).nullable().optional(),
            workOrderType: z.enum(WORK_ORDER_TYPE_VALUES).optional(),
            priority: z.nativeEnum(IssuePriority).nullable().optional(),
            procedureJson: z
                .array(z.object({
                id: z.string(),
                label: z.string(),
                type: z.enum(["checkbox", "passfail", "text", "photo"]).optional(),
                required: z.boolean().optional(),
                // fallow-ignore-next-line code-duplication
            }))
                .optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const row = await prisma.workspaceWorkOrderTemplate.update({
            where: { id },
            data: {
                ...(body.data.name !== undefined ? { name: body.data.name.trim() } : {}),
                ...(body.data.description !== undefined ? { description: body.data.description } : {}),
                ...(body.data.workOrderType !== undefined
                    ? { workOrderType: body.data.workOrderType }
                    : {}),
                ...(body.data.priority !== undefined ? { priority: body.data.priority } : {}),
                ...(body.data.procedureJson !== undefined
                    ? { procedureJson: body.data.procedureJson }
                    : {}),
            },
        });
        return c.json(workspaceWorkOrderTemplateJson(row));
    });
    // fallow-ignore-next-line code-duplication
    r.delete("/workspaces/:workspaceId/om/work-order-templates/:id", needUser, async (c) => {
        const workspaceId = c.req.param("workspaceId");
        const id = c.req.param("id");
        const m = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: c.get("user").id } },
            include: {
                workspace: {
                    select: {
                        subscriptionStatus: true,
                        currentPeriodEnd: true,
                        stripeSubscriptionId: true,
                        billingPlan: true,
                    },
                },
            },
        });
        if (!m || m.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requireOmBilling(m.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.workspaceWorkOrderTemplate.findFirst({
            where: { id, workspaceId },
            select: { id: true },
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        await prisma.workspaceWorkOrderTemplate.delete({ where: { id } });
        return c.json({ ok: true });
    });
    // --- Inspection templates ---
    // fallow-ignore-next-line code-duplication
    r.get("/projects/:projectId/om/inspection-templates", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.inspectionTemplate.findMany({
            where: { projectId },
            orderBy: { name: "asc" },
        });
        return c.json(rows.map((t) => ({
            ...t,
            nextDueAt: t.nextDueAt?.toISOString() ?? null,
            lastCompletedAt: t.lastCompletedAt?.toISOString() ?? null,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
        })));
    });
    // fallow-ignore-next-line code-duplication
    r.post("/projects/:projectId/om/inspection-templates", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            name: z.string().min(1).max(300),
            description: z.string().max(2000).nullable().optional(),
            frequency: z.string().max(80).nullable().optional(),
            // fallow-ignore-next-line code-duplication
            requireFailEvidence: z.boolean().optional(),
            checklistJson: z.array(z.object({
                id: z.string(),
                label: z.string(),
                type: z.enum(["checkbox", "passfail", "text", "photo"]),
                level: z.string().max(120).optional(),
            })),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const frequency = body.data.frequency?.trim() || null;
        const intervalDays = inspectionFrequencyToIntervalDays(frequency);
        const now = new Date();
        // fallow-ignore-next-line code-duplication
        const row = await prisma.inspectionTemplate.create({
            data: {
                projectId,
                name: body.data.name.trim(),
                description: body.data.description ?? null,
                frequency,
                intervalDays,
                nextDueAt: intervalDays != null ? addUtcDays(now, intervalDays) : null,
                requireFailEvidence: body.data.requireFailEvidence ?? true,
                checklistJson: body.data.checklistJson,
            },
        });
        return c.json({
            ...row,
            nextDueAt: row.nextDueAt?.toISOString() ?? null,
            lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        });
    });
    r.patch("/projects/:projectId/om/inspection-templates/:templateId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const templateId = c.req.param("templateId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.inspectionTemplate.findFirst({
            where: { id: templateId, projectId },
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            name: z.string().min(1).max(300).optional(),
            description: z.string().max(2000).nullable().optional(),
            frequency: z.string().max(80).nullable().optional(),
            // fallow-ignore-next-line code-duplication
            requireFailEvidence: z.boolean().optional(),
            checklistJson: z
                .array(z.object({
                id: z.string(),
                label: z.string(),
                type: z.enum(["checkbox", "passfail", "text", "photo"]),
                level: z.string().max(120).optional(),
            }))
                .optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const data = {};
        if (body.data.name !== undefined)
            data.name = body.data.name.trim();
        if (body.data.description !== undefined)
            data.description = body.data.description;
        if (body.data.requireFailEvidence !== undefined) {
            data.requireFailEvidence = body.data.requireFailEvidence;
        }
        if (body.data.frequency !== undefined) {
            const frequency = body.data.frequency?.trim() || null;
            data.frequency = frequency;
            const intervalDays = inspectionFrequencyToIntervalDays(frequency);
            data.intervalDays = intervalDays;
            if (intervalDays != null) {
                const base = existing.lastCompletedAt ?? new Date();
                data.nextDueAt = addUtcDays(base, intervalDays);
            }
            else {
                data.nextDueAt = null;
            }
        }
        if (body.data.checklistJson !== undefined) {
            data.checklistJson = body.data.checklistJson;
        }
        // fallow-ignore-next-line code-duplication
        const row = await prisma.inspectionTemplate.update({
            where: { id: templateId },
            data,
        });
        return c.json({
            ...row,
            nextDueAt: row.nextDueAt?.toISOString() ?? null,
            lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        });
    });
    r.delete("/projects/:projectId/om/inspection-templates/:templateId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        // fallow-ignore-next-line code-duplication
        const templateId = c.req.param("templateId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const tpl = await prisma.inspectionTemplate.findFirst({
            where: { id: templateId, projectId },
            select: { id: true },
        });
        if (!tpl)
            return c.json({ error: "Not found" }, 404);
        await prisma.inspectionTemplate.delete({ where: { id: templateId } });
        return c.json({ ok: true });
    });
    /** Clone a workspace inspection template into this project. */
    // fallow-ignore-next-line code-duplication
    r.post("/projects/:projectId/om/inspection-templates/from-workspace", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z.object({ workspaceTemplateId: z.string().min(1) }).safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const src = await prisma.workspaceInspectionTemplate.findFirst({
            where: {
                id: body.data.workspaceTemplateId,
                workspaceId: ctx.project.workspaceId,
            },
        });
        if (!src)
            return c.json({ error: "Workspace template not found" }, 404);
        const frequency = src.frequency?.trim() || null;
        const intervalDays = inspectionFrequencyToIntervalDays(frequency);
        const now = new Date();
        const row = await prisma.inspectionTemplate.create({
            data: {
                projectId,
                name: src.name,
                description: src.description,
                frequency,
                intervalDays,
                nextDueAt: intervalDays != null ? addUtcDays(now, intervalDays) : null,
                requireFailEvidence: true,
                checklistJson: src.checklistJson,
            },
        });
        return c.json({
            ...row,
            nextDueAt: row.nextDueAt?.toISOString() ?? null,
            lastCompletedAt: row.lastCompletedAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        });
    });
    // --- Inspection runs ---
    // fallow-ignore-next-line code-duplication
    r.get("/projects/:projectId/om/inspection-runs", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.inspectionRun.findMany({
            where: { projectId },
            orderBy: { updatedAt: "desc" },
            include: {
                template: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true, email: true, image: true } },
            },
        });
        return c.json(rows.map((r) => inspectionRunJson(r)));
    });
    // fallow-ignore-next-line code-duplication
    r.post("/projects/:projectId/om/inspection-runs", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            templateId: z.string(),
            assetId: z.string().nullable().optional(),
            dueAt: z.string().datetime().nullable().optional(),
            fileId: z.string().nullable().optional(),
            fileVersionId: z.string().nullable().optional(),
            pageNumber: z.number().int().min(1).nullable().optional(),
            // fallow-ignore-next-line code-duplication
            resultJson: z.array(z.unknown()).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const tpl = await prisma.inspectionTemplate.findFirst({
            where: { id: body.data.templateId, projectId },
        });
        if (!tpl)
            return c.json({ error: "Template not found" }, 404);
        if (body.data.assetId) {
            const asset = await prisma.asset.findFirst({
                where: { id: body.data.assetId, projectId },
                select: { id: true },
            });
            if (!asset)
                return c.json({ error: "Asset not found" }, 400);
        }
        if (body.data.fileId && body.data.fileVersionId) {
            const ok = await prisma.fileVersion.findFirst({
                where: { id: body.data.fileVersionId, fileId: body.data.fileId, file: { projectId } },
            });
            if (!ok)
                return c.json({ error: "File version not found" }, 400);
        }
        const dueAt = body.data.dueAt !== undefined
            ? body.data.dueAt
                ? new Date(body.data.dueAt)
                : null
            : (tpl.nextDueAt ?? null);
        const row = await prisma.inspectionRun.create({
            data: {
                projectId,
                templateId: tpl.id,
                assetId: body.data.assetId ?? null,
                dueAt,
                fileId: body.data.fileId ?? null,
                fileVersionId: body.data.fileVersionId ?? null,
                pageNumber: body.data.pageNumber ?? null,
                resultJson: (body.data.resultJson ?? []),
                createdById: c.get("user").id,
                status: InspectionRunStatus.DRAFT,
            },
            include: { template: { select: { id: true, name: true } } },
        });
        return c.json(inspectionRunJson(row));
    });
    r.patch("/projects/:projectId/om/inspection-runs/:runId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const runId = c.req.param("runId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.inspectionRun.findFirst({ where: { id: runId, projectId } });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const body = z
            .object({
            resultJson: z.array(z.unknown()).optional(),
            attachmentsJson: z.array(z.unknown()).optional(),
            status: z.nativeEnum(InspectionRunStatus).optional(),
            completedAt: z.string().datetime().nullable().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const d = body.data;
        const markComplete = d.status === InspectionRunStatus.COMPLETED ||
            (d.completedAt !== undefined && d.completedAt !== null);
        const row = await prisma.inspectionRun.update({
            where: { id: runId },
            data: {
                ...(d.resultJson !== undefined
                    ? { resultJson: d.resultJson }
                    : {}),
                ...(d.attachmentsJson !== undefined
                    ? { attachmentsJson: d.attachmentsJson }
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
        return c.json(inspectionRunJson(row));
    });
    r.delete("/projects/:projectId/om/inspection-runs/:runId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const runId = c.req.param("runId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const existing = await prisma.inspectionRun.findFirst({ where: { id: runId, projectId } });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        await prisma.inspectionRun.delete({ where: { id: runId } });
        return c.json({ ok: true });
    });
    /**
     * Complete inspection: persist results, mark run completed, optionally create work orders for failed items.
     */
    // fallow-ignore-next-line code-duplication
    r.post("/projects/:projectId/om/inspection-runs/:runId/complete", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const runId = c.req.param("runId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            resultJson: z.array(z.object({
                itemId: z.string(),
                outcome: z.enum(["pass", "fail", "na"]),
                note: z.string().max(4000).optional(),
                photoDataUrl: z.string().max(2_000_000).optional(),
                /** Original filename when uploaded (shown on PDF). Camera captures use a generated label. */
                photoFileName: z.string().max(260).optional(),
                /** When set, complete will not create another work order for this failed item. */
                followUpIssueId: z.string().optional(),
            })),
            createWorkOrdersForFailures: z.boolean().default(true),
            signatureDataUrl: z.string().max(2_000_000).nullable().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const run = await prisma.inspectionRun.findFirst({
            where: { id: runId, projectId },
            include: { template: true },
        });
        if (!run)
            return c.json({ error: "Not found" }, 404);
        if (run.status !== InspectionRunStatus.DRAFT) {
            return c.json({ error: "Inspection is already completed or archived" }, 400);
        }
        const checklist = Array.isArray(run.template.checklistJson)
            ? run.template.checklistJson
            : [];
        const idList = checklist
            .map((x) => x.id)
            .filter((x) => typeof x === "string" && x.length > 0);
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
        const evidenceIssues = validateFailEvidence({
            requireFailEvidence: run.template.requireFailEvidence,
            checklist: checklist.map((it) => ({
                id: it.id,
                label: it.label,
                type: it.type,
            })),
            results: body.data.resultJson,
        });
        if (evidenceIssues.length > 0) {
            const first = evidenceIssues[0];
            return c.json({
                error: `Fail evidence required for “${first.label}”: add ${first.missing.join(" and ")}.`,
                evidenceIssues,
            }, 400);
        }
        const userId = c.get("user").id;
        const wantWo = body.data.createWorkOrdersForFailures;
        const fails = body.data.resultJson.filter((r) => r.outcome === "fail");
        if (wantWo && fails.length > 0 && !ctx.settings.modules.issues) {
            return c.json({ error: "Issues module is disabled; turn off work order creation or enable issues." }, 403);
        }
        let updated;
        const createdWorkOrders = [];
        try {
            updated = await prisma.$transaction(async (tx) => {
                const resultRows = body.data.resultJson.map((r) => ({ ...r }));
                if (wantWo && fails.length > 0) {
                    for (const f of fails) {
                        if (f.followUpIssueId?.trim())
                            continue;
                        const label = checklist.find((it) => it.id === f.itemId)?.label?.trim() || f.itemId;
                        const created = await createInspectionRunWorkOrderIssue(projectId, ctx.project.workspaceId, userId, run, {
                            title: `Work order: ${label}`,
                            itemLabel: label,
                            note: f.note,
                        }, tx);
                        if ("error" in created) {
                            throw new Error(`WORK_ORDER_CREATE_FAILED:${created.error}`);
                        }
                        createdWorkOrders.push({ id: created.id, title: created.title });
                        const row = resultRows.find((r) => r.itemId === f.itemId);
                        if (row)
                            row.followUpIssueId = created.id;
                    }
                }
                const completedAt = new Date();
                const txUpdated = await tx.inspectionRun.update({
                    where: { id: runId },
                    data: {
                        resultJson: resultRows,
                        status: InspectionRunStatus.COMPLETED,
                        completedAt,
                        signedOffById: userId,
                        signatureDataUrl: body.data.signatureDataUrl?.trim() || null,
                    },
                    include: { template: { select: { id: true, name: true } } },
                });
                const interval = run.template.intervalDays ?? inspectionFrequencyToIntervalDays(run.template.frequency);
                if (interval != null && interval > 0) {
                    await tx.inspectionTemplate.update({
                        where: { id: run.templateId },
                        data: {
                            lastCompletedAt: completedAt,
                            nextDueAt: addUtcDays(completedAt, interval),
                            intervalDays: interval,
                        },
                    });
                }
                else {
                    await tx.inspectionTemplate.update({
                        where: { id: run.templateId },
                        data: { lastCompletedAt: completedAt },
                    });
                }
                return txUpdated;
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to complete inspection";
            if (msg.startsWith("WORK_ORDER_CREATE_FAILED:")) {
                return c.json({ error: msg.slice("WORK_ORDER_CREATE_FAILED:".length) || "Failed to create work order" }, 400);
            }
            console.error("[inspection-complete] transaction failed", err);
            return c.json({ error: "Failed to complete inspection" }, 500);
        }
        for (const created of createdWorkOrders) {
            try {
                await logActivity(ctx.project.workspaceId, ActivityType.ISSUE_CREATED, {
                    actorUserId: userId,
                    entityId: created.id,
                    projectId,
                    metadata: { title: created.title, fromInspectionRun: runId },
                });
            }
            catch (err) {
                console.error("[inspection-complete] log issue activity", err);
            }
        }
        const runForPdf = await prisma.inspectionRun.findFirst({
            where: { id: runId, projectId },
            include: {
                template: true,
                project: { select: { name: true } },
                file: { select: { name: true } },
                fileVersion: { select: { version: true } },
                signedOffBy: { select: { name: true, email: true } },
                createdBy: { select: { name: true, email: true } },
            },
        });
        const handover = parseProjectSettingsJson(ctx.project.settingsJson).omHandover;
        const ownerEmail = handover.buildingOwnerEmail;
        const signer = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        let buildingOwnerNotify;
        if (!ownerEmail) {
            buildingOwnerNotify = { sent: false, skippedReason: "no_recipient" };
        }
        else if (!runForPdf) {
            buildingOwnerNotify = { sent: false, skippedReason: "send_failed" };
        }
        else {
            try {
                const pdfBuf = await buildInspectionReportPdfBuffer(runForPdf);
                const emailed = await tryEmailInspectionReportToBuildingOwner({
                    env,
                    to: ownerEmail,
                    projectName: runForPdf.project.name,
                    templateName: runForPdf.template.name,
                    completedAt: updated.completedAt,
                    signedByName: signer?.name ?? null,
                    pdfBuffer: pdfBuf,
                    runId,
                });
                buildingOwnerNotify = emailed.ok
                    ? { sent: true }
                    : { sent: false, skippedReason: emailed.reason };
            }
            catch (e) {
                console.error("[inspection-complete] building owner email", e);
                buildingOwnerNotify = { sent: false, skippedReason: "send_failed" };
            }
        }
        return c.json({
            id: updated.id,
            status: updated.status,
            workOrderIds: createdWorkOrders.map((w) => w.id),
            reportPdfPath: `/api/v1/projects/${projectId}/om/inspection-runs/${runId}/report.pdf`,
            completedAt: updated.completedAt.toISOString(),
            buildingOwnerNotify,
        });
    });
    // fallow-ignore-next-line code-duplication
    r.get("/projects/:projectId/om/inspection-runs/:runId/report.pdf", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        // fallow-ignore-next-line code-duplication
        const runId = c.req.param("runId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const run = await prisma.inspectionRun.findFirst({
            where: { id: runId, projectId },
            include: {
                template: true,
                project: { select: { name: true } },
                file: { select: { name: true } },
                fileVersion: { select: { version: true } },
                signedOffBy: { select: { name: true, email: true } },
                createdBy: { select: { name: true, email: true } },
            },
        });
        if (!run)
            return c.json({ error: "Not found" }, 404);
        const buf = await buildInspectionReportPdfBuffer(run);
        c.header("Content-Type", "application/pdf");
        c.header("Content-Disposition", `inline; filename="inspection-${runId.slice(0, 12)}.pdf"`);
        return c.body(new Uint8Array(buf));
    });
    // --- Occupant portal tokens (admin) ---
    r.get("/projects/:projectId/om/occupant-tokens", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
            return c.json({ error: "Forbidden" }, 403);
        }
        if (!ctx.project.operationsMode || !ctx.settings.modules.omTenantPortal) {
            return c.json({ error: "Occupant portal is not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
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
        return c.json(rows.map((t) => ({
            id: t.id,
            token: t.token,
            label: t.label,
            expiresAt: t.expiresAt?.toISOString() ?? null,
            createdAt: t.createdAt.toISOString(),
        })));
    });
    r.get("/projects/:projectId/om/occupant-tokens/revoked", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
            return c.json({ error: "Forbidden" }, 403);
        }
        if (!ctx.project.operationsMode || !ctx.settings.modules.omTenantPortal) {
            return c.json({ error: "Occupant portal is not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.occupantPortalToken.findMany({
            where: { projectId, revokedAt: { not: null } },
            orderBy: { revokedAt: "desc" },
            take: 40,
            select: { id: true, label: true, token: true, createdAt: true, revokedAt: true },
        });
        return c.json(rows.map((t) => ({
            id: t.id,
            label: t.label,
            createdAt: t.createdAt.toISOString(),
            revokedAt: t.revokedAt.toISOString(),
            tokenSuffix: t.token.length > 8 ? t.token.slice(-6) : t.token,
        })));
    });
    r.post("/projects/:projectId/om/occupant-tokens/:tokenId/revoke", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const tokenId = c.req.param("tokenId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
            return c.json({ error: "Forbidden" }, 403);
        }
        if (!ctx.project.operationsMode || !ctx.settings.modules.omTenantPortal) {
            return c.json({ error: "Occupant portal is not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const now = new Date();
        const activeCount = await prisma.occupantPortalToken.count({
            where: {
                projectId,
                revokedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
        });
        if (activeCount <= 1) {
            return c.json({ error: "Keep at least one active building link. Add another before revoking." }, 400);
        }
        const row = await prisma.occupantPortalToken.findFirst({
            where: { id: tokenId, projectId, revokedAt: null },
        });
        if (!row)
            return c.json({ error: "Not found or already revoked" }, 404);
        await prisma.occupantPortalToken.update({
            where: { id: row.id },
            data: { revokedAt: now },
        });
        return c.json({ ok: true });
    });
    r.post("/projects/:projectId/om/occupant-tokens", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
            return c.json({ error: "Forbidden" }, 403);
        }
        if (!ctx.project.operationsMode || !ctx.settings.modules.omTenantPortal) {
            return c.json({ error: "Occupant portal is not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            label: z.string().max(120).optional(),
            expiresAt: z.string().datetime().nullable().optional(),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
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
    // fallow-ignore-next-line code-duplication
    r.get("/projects/:projectId/om/handover-summary", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode) {
            return c.json({ error: "Operations mode is not enabled for this project" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const settings = parseProjectSettingsJson(ctx.project.settingsJson);
        const now = new Date();
        const [assetTotal, assetsLinkedToDrawing, assetsWithOccupantSecret, openWorkOrders, maintRows, inspectionTemplateCount, completedInspectionRuns, activeOccupantTokens, openPunchItems, constructionOpenIssues, openOccupantRequests,] = await Promise.all([
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
            if (!row.nextDueAt)
                continue;
            const h = ppmHealthLabel(row.nextDueAt, now);
            if (h === "overdue")
                maintenanceOverdue++;
            else if (h === "dueSoon")
                maintenanceDueSoon++;
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
    // fallow-ignore-next-line code-duplication
    r.patch("/projects/:projectId/om/handover-brief", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode) {
            return c.json({ error: "Operations mode is not enabled for this project" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
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
            // fallow-ignore-next-line code-duplication
            buildingOwnerEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const current = parseProjectSettingsJson(ctx.project.settingsJson);
        const prevWizardAt = current.omHandover.handoverWizardCompletedAt;
        const merged = mergeProjectSettingsPatch(current, { omHandover: body.data });
        const raw = cloneSettingsJson(ctx.project.settingsJson);
        raw.modules = merged.modules;
        raw.clientVisibility = merged.clientVisibility;
        raw.omHandover = merged.omHandover;
        const updated = await prisma.project.update({
            where: { id: projectId },
            data: { settingsJson: raw },
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
    // fallow-ignore-next-line code-duplication
    r.get("/projects/:projectId/om/fm-dashboard", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode) {
            return c.json({ error: "Operations mode is not enabled for this project" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const settings = parseProjectSettingsJson(ctx.project.settingsJson);
        const now = new Date();
        const weekStart = startOfUtcWeek(now);
        // fallow-ignore-next-line code-duplication
        const weekEnd = endOfUtcWeek(weekStart);
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
        const [assetTotal, assetsLinkedToDrawing, openWo, inProgressWo, openTenantReq, inProgressTenantReq, maintRows, schedulesForWeek, recentWo, recentTenantReq, backlogOver7, backlogOver30, pmCompletions, openInspectionDrafts, overdueInspectionTemplates, completedInspectionsLast30,] = await Promise.all([
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
            prisma.issue.count({
                where: {
                    projectId,
                    issueKind: IssueKind.WORK_ORDER,
                    status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
                    createdAt: { lt: sevenDaysAgo },
                },
            }),
            prisma.issue.count({
                where: {
                    projectId,
                    issueKind: IssueKind.WORK_ORDER,
                    status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
                    createdAt: { lt: thirtyDaysAgo },
                },
            }),
            prisma.maintenanceCompletion.findMany({
                where: { projectId },
                select: { completedAt: true, previousDueAt: true },
                orderBy: { completedAt: "desc" },
                take: 200,
            }),
            prisma.inspectionRun.count({
                where: { projectId, status: InspectionRunStatus.DRAFT },
            }),
            prisma.inspectionTemplate.count({
                where: { projectId, nextDueAt: { not: null, lt: now } },
            }),
            prisma.inspectionRun.findMany({
                where: {
                    projectId,
                    status: InspectionRunStatus.COMPLETED,
                    completedAt: { gte: thirtyDaysAgo },
                },
                select: {
                    id: true,
                    templateId: true,
                    assetId: true,
                    completedAt: true,
                    resultJson: true,
                    template: { select: { id: true, name: true } },
                },
                orderBy: { completedAt: "desc" },
                take: 100,
            }),
        ]);
        const deficientLast30 = completedInspectionsLast30.filter((r) => inspectionResultHasFail(r.resultJson));
        const recentDeficientInspections = deficientLast30.slice(0, 6).map((r) => ({
            id: r.id,
            templateId: r.templateId,
            templateName: r.template.name,
            assetId: r.assetId,
            completedAt: r.completedAt?.toISOString() ?? null,
        }));
        let maintenanceOverdue = 0;
        let maintenanceDueSoon = 0;
        for (const row of maintRows) {
            if (!row.nextDueAt)
                continue;
            const h = ppmHealthLabel(row.nextDueAt, now);
            if (h === "overdue")
                maintenanceOverdue++;
            else if (h === "dueSoon")
                maintenanceDueSoon++;
        }
        const buildingHealthPct = assetTotal === 0 ? 100 : Math.round((assetsLinkedToDrawing / assetTotal) * 100);
        let pmOnTime = 0;
        let pmLate = 0;
        for (const cpl of pmCompletions) {
            if (!cpl.previousDueAt)
                continue;
            if (cpl.completedAt <= cpl.previousDueAt)
                pmOnTime++;
            else
                pmLate++;
        }
        const pmTotal = pmOnTime + pmLate;
        const pmCompliancePct = pmTotal === 0 ? 100 : Math.round((pmOnTime / pmTotal) * 100);
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
                workOrderBacklogOver7Days: backlogOver7,
                workOrderBacklogOver30Days: backlogOver30,
                pmCompliancePct,
                openInspectionDrafts,
                deficientInspectionsLast30Days: deficientLast30.length,
                overdueInspectionTemplates,
            },
            buildingHealthPct,
            upcomingMaintenanceThisWeek: schedulesForWeek.map((s) => ({
                id: s.id,
                title: s.title,
                nextDueAt: s.nextDueAt.toISOString(),
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
            recentDeficientInspections,
        });
    });
    /** Recent inspection runs for an asset (asset hub). */
    r.get("/projects/:projectId/om/assets/:assetId/inspections", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        // fallow-ignore-next-line code-duplication
        const assetId = c.req.param("assetId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, projectId },
            select: { id: true, tag: true, name: true },
        });
        if (!asset)
            return c.json({ error: "Asset not found" }, 404);
        const rows = await prisma.inspectionRun.findMany({
            where: { projectId, assetId },
            orderBy: { updatedAt: "desc" },
            take: 50,
            include: {
                template: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true, email: true, image: true } },
            },
        });
        return c.json({
            assetId: asset.id,
            assetTag: asset.tag,
            assetName: asset.name,
            runs: rows.map((r) => inspectionRunJson(r)),
        });
    });
    /**
     * Period export pack (JSON): asset register summary, completed inspections,
     * maintenance completions, and closed work orders in [from, to].
     */
    // fallow-ignore-next-line code-duplication
    r.get("/projects/:projectId/om/reports/period-pack.json", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode) {
            return c.json({ error: "Operations mode is not enabled for this project" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const fromRaw = c.req.query("from")?.trim();
        const toRaw = c.req.query("to")?.trim();
        if (!fromRaw || !toRaw) {
            return c.json({ error: "Query params from and to (ISO dates) are required" }, 400);
        }
        const from = new Date(fromRaw);
        const to = new Date(toRaw);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            return c.json({ error: "Invalid from/to date" }, 400);
        }
        if (from > to)
            return c.json({ error: "from must be before to" }, 400);
        const [assets, completedInspections, maintenanceCompletions, closedWorkOrders] = await Promise.all([
            prisma.asset.findMany({
                where: { projectId },
                orderBy: { tag: "asc" },
                select: {
                    id: true,
                    tag: true,
                    name: true,
                    category: true,
                    locationLabel: true,
                    manufacturer: true,
                    model: true,
                    serialNumber: true,
                    warrantyExpires: true,
                    lastServiceAt: true,
                },
            }),
            prisma.inspectionRun.findMany({
                where: {
                    projectId,
                    status: InspectionRunStatus.COMPLETED,
                    completedAt: { gte: from, lte: to },
                },
                orderBy: { completedAt: "asc" },
                include: {
                    template: { select: { id: true, name: true } },
                    asset: { select: { id: true, tag: true, name: true } },
                },
            }),
            prisma.maintenanceCompletion.findMany({
                where: { projectId, completedAt: { gte: from, lte: to } },
                orderBy: { completedAt: "asc" },
                include: {
                    asset: { select: { id: true, tag: true, name: true } },
                    schedule: { select: { id: true, title: true, frequency: true } },
                },
            }),
            prisma.issue.findMany({
                where: {
                    projectId,
                    issueKind: IssueKind.WORK_ORDER,
                    status: IssueStatus.RESOLVED,
                    OR: [
                        { resolvedAt: { gte: from, lte: to } },
                        { resolvedAt: null, updatedAt: { gte: from, lte: to } },
                    ],
                },
                orderBy: { updatedAt: "asc" },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    priority: true,
                    assetId: true,
                    resolvedAt: true,
                    updatedAt: true,
                    createdAt: true,
                },
            }),
        ]);
        const pack = {
            projectId,
            projectName: ctx.project.name,
            from: from.toISOString(),
            to: to.toISOString(),
            generatedAt: new Date().toISOString(),
            assetRegisterSummary: {
                total: assets.length,
                assets: assets.map((a) => ({
                    ...a,
                    warrantyExpires: a.warrantyExpires?.toISOString() ?? null,
                    lastServiceAt: a.lastServiceAt?.toISOString() ?? null,
                })),
            },
            completedInspections: completedInspections.map((r) => ({
                id: r.id,
                templateId: r.templateId,
                templateName: r.template.name,
                assetId: r.assetId,
                assetTag: r.asset?.tag ?? null,
                assetName: r.asset?.name ?? null,
                completedAt: r.completedAt?.toISOString() ?? null,
                hasFail: inspectionResultHasFail(r.resultJson),
                signaturePresent: Boolean(r.signatureDataUrl),
            })),
            maintenanceCompletions: maintenanceCompletions.map((m) => ({
                id: m.id,
                scheduleId: m.scheduleId,
                scheduleTitle: m.schedule?.title ?? null,
                frequency: m.schedule?.frequency ?? null,
                assetId: m.assetId,
                assetTag: m.asset?.tag ?? null,
                assetName: m.asset?.name ?? null,
                completedAt: m.completedAt.toISOString(),
                previousDueAt: m.previousDueAt?.toISOString() ?? null,
                workOrderId: m.workOrderId,
            })),
            closedWorkOrders: closedWorkOrders.map((i) => ({
                id: i.id,
                title: i.title,
                status: i.status,
                priority: i.priority,
                assetId: i.assetId,
                resolvedAt: i.resolvedAt?.toISOString() ?? null,
                updatedAt: i.updatedAt.toISOString(),
                createdAt: i.createdAt.toISOString(),
            })),
        };
        c.header("Content-Type", "application/json; charset=utf-8");
        c.header("Content-Disposition", `attachment; filename="period-pack-${projectId.slice(0, 8)}.json"`);
        return c.body(JSON.stringify(pack, null, 2));
    });
    /** CSV export: asset register. */
    r.get("/projects/:projectId/om/reports/asset-register.csv", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!ctx.project.operationsMode || !ctx.settings.modules.omAssets) {
            return c.json({ error: "Operations assets are not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
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
            ...rows.map((a) => [
                a.tag,
                a.name,
                a.locationLabel ?? "",
                a.manufacturer ?? "",
                a.model ?? "",
                a.serialNumber ?? "",
                a.file?.name ?? "",
            ]
                .map((x) => csvEscapeCell(x))
                .join(",")),
        ];
        const body = lines.join("\r\n");
        c.header("Content-Type", "text/csv; charset=utf-8");
        c.header("Content-Disposition", `attachment; filename="asset-register-${projectId.slice(0, 8)}.csv"`);
        return c.body(body);
    });
    /** CSV export: occupant QR URLs per asset (uses primary active building link). */
    r.get("/projects/:projectId/om/reports/occupant-asset-qr-urls.csv", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.role !== "SUPER_ADMIN" && ctx.workspaceMember.role !== "ADMIN") {
            return c.json({ error: "Forbidden" }, 403);
        }
        if (!ctx.project.operationsMode ||
            !ctx.settings.modules.omAssets ||
            !ctx.settings.modules.omTenantPortal) {
            return c.json({ error: "Not enabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
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
            ...assets.map((a) => [a.tag, a.name, `${base}/occupant/${tokenRow.token}?a=${a.occupantScanSecret}`]
                .map((x) => csvEscapeCell(x))
                .join(",")),
        ];
        const csvBody = lines.join("\r\n");
        c.header("Content-Type", "text/csv; charset=utf-8");
        c.header("Content-Disposition", `attachment; filename="occupant-asset-qr-${projectId.slice(0, 8)}.csv"`);
        return c.body(csvBody);
    });
    /** Create a work order from an inspection checklist item (failed / follow-up). */
    r.post("/projects/:projectId/om/inspection-runs/:runId/work-order", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const runId = c.req.param("runId");
        const auth = await loadProjectWithAuth(projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!ctx.project.operationsMode || !ctx.settings.modules.omInspections) {
            return c.json({ error: "Inspections are not enabled" }, 403);
        }
        if (!ctx.settings.modules.issues) {
            return c.json({ error: "Issues module is disabled" }, 403);
        }
        const gate = requireOmBilling(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            itemId: z.string().min(1),
            title: z.string().min(1).max(500),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const run = await prisma.inspectionRun.findFirst({
            where: { id: runId, projectId },
            include: { template: true },
        });
        if (!run)
            return c.json({ error: "Not found" }, 404);
        const checklist = Array.isArray(run.template.checklistJson)
            ? run.template.checklistJson
            : [];
        const found = checklist.find((it) => it.id === body.data.itemId);
        if (!found)
            return c.json({ error: "Checklist item not found" }, 400);
        const itemLabel = typeof found.label === "string" && found.label.trim() ? found.label.trim() : body.data.itemId;
        const created = await createInspectionRunWorkOrderIssue(projectId, ctx.project.workspaceId, c.get("user").id, run, { title: body.data.title.trim(), itemLabel });
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
function occupantPortalHeadlineFromSettingsJson(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const o = raw;
    const ui = o.omTenantPortalUi;
    if (!ui || typeof ui !== "object")
        return null;
    const h = ui.headline;
    return typeof h === "string" && h.trim() ? h.trim().slice(0, 200) : null;
}
/** Public-safe element summary from an asset bimAnchor (null when unlinked / invalid). */
function occupantElementFromBimAnchor(bimAnchor) {
    const parsed = omAssetBimAnchorSchema.safeParse(bimAnchor);
    if (!parsed.success || !parsed.data)
        return null;
    return {
        name: parsed.data.name?.trim() ? parsed.data.name.trim() : null,
        ifcType: parsed.data.ifcType?.trim() ? parsed.data.ifcType.trim() : null,
    };
}
function occupantLevelFromBimAnchor(bimAnchor) {
    const parsed = omAssetBimAnchorSchema.safeParse(bimAnchor);
    if (!parsed.success || !parsed.data)
        return null;
    const level = parsed.data.spatialPath?.[0]?.trim();
    return level ? level : null;
}
const occupantAssetPublicSelect = {
    tag: true,
    name: true,
    category: true,
    locationLabel: true,
    hall: true,
    rowLabel: true,
    rack: true,
    positionU: true,
    manufacturer: true,
    model: true,
    serialNumber: true,
    notes: true,
    imageS3Key: true,
    bimAnchor: true,
};
function toOccupantAssetPublicJson(a) {
    return {
        tag: a.tag,
        name: a.name,
        category: a.category,
        locationLabel: a.locationLabel,
        hall: a.hall,
        rowLabel: a.rowLabel,
        rack: a.rack,
        positionU: a.positionU,
        manufacturer: a.manufacturer,
        model: a.model,
        serialNumber: a.serialNumber,
        notes: a.notes,
        hasImage: Boolean(a.imageS3Key),
        level: occupantLevelFromBimAnchor(a.bimAnchor),
        element: occupantElementFromBimAnchor(a.bimAnchor),
    };
}
function bimAnchorJsonForIssue(bimAnchor) {
    const parsed = omAssetBimAnchorSchema.safeParse(bimAnchor);
    if (!parsed.success || !parsed.data)
        return null;
    return parsed.data;
}
/** Public occupant routes (no session). */
export function registerOccupantPublicRoutes(r, env) {
    r.get("/occupant/:token/meta", async (c) => {
        const token = c.req.param("token");
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
        if (!row)
            return c.json({ error: "Invalid or expired link" }, 404);
        if (!row.project.operationsMode)
            return c.json({ error: "This portal is not active" }, 403);
        if (row.expiresAt && row.expiresAt < new Date()) {
            return c.json({ error: "This link has expired" }, 403);
        }
        let asset = null;
        if (assetSecretRaw) {
            const a = await prisma.asset.findFirst({
                where: { projectId: row.projectId, occupantScanSecret: assetSecretRaw },
                select: occupantAssetPublicSelect,
            });
            if (!a)
                return c.json({ error: "Invalid equipment link" }, 404);
            asset = toOccupantAssetPublicJson(a);
        }
        const occupantHeadline = occupantPortalHeadlineFromSettingsJson(row.project.settingsJson);
        return c.json({
            projectId: row.project.id,
            projectName: row.project.name,
            occupantHeadline,
            asset,
        });
    });
    /** Public equipment photo for a scanned asset QR (token + asset secret). */
    r.get("/occupant/:token/asset-image", async (c) => {
        const token = c.req.param("token");
        const assetSecretRaw = c.req.query("a")?.trim();
        if (!assetSecretRaw || assetSecretRaw.length > 80) {
            return c.json({ error: "Invalid equipment link" }, 400);
        }
        const row = await prisma.occupantPortalToken.findFirst({
            where: { token, revokedAt: null },
            include: {
                project: {
                    select: {
                        id: true,
                        operationsMode: true,
                    },
                },
            },
        });
        if (!row)
            return c.json({ error: "Invalid or expired link" }, 404);
        if (!row.project.operationsMode)
            return c.json({ error: "This portal is not active" }, 403);
        if (row.expiresAt && row.expiresAt < new Date()) {
            return c.json({ error: "This link has expired" }, 403);
        }
        const asset = await prisma.asset.findFirst({
            where: { projectId: row.projectId, occupantScanSecret: assetSecretRaw },
            select: { imageS3Key: true },
        });
        if (!asset?.imageS3Key)
            return c.json({ error: "Not found" }, 404);
        let url;
        try {
            url = await presignGet(env, asset.imageS3Key);
        }
        catch (e) {
            console.error("[occupant asset image]", e);
            return c.json({ error: "Could not create download link (S3)." }, 503);
        }
        if (!url)
            return c.json({ error: "S3 not configured" }, 503);
        return c.json({ url });
    });
    // fallow-ignore-next-line complexity
    r.post("/occupant/:token/submit", async (c) => {
        const token = c.req.param("token");
        const body = z
            .object({
            description: z.string().min(1).max(4000),
            floor: z.string().max(120).optional(),
            room: z.string().max(120).optional(),
            reporterName: z.string().min(1).max(200),
            reporterEmail: z.string().email(),
            // fallow-ignore-next-line code-duplication
            assetSecret: z.string().min(1).max(80).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const link = await prisma.occupantPortalToken.findFirst({
            where: { token, revokedAt: null },
            include: {
                project: {
                    include: { workspace: true },
                },
            },
        });
        if (!link)
            return c.json({ error: "Invalid or expired link" }, 404);
        if (!link.project.operationsMode)
            return c.json({ error: "This portal is not active" }, 403);
        if (link.expiresAt && link.expiresAt < new Date()) {
            return c.json({ error: "This link has expired" }, 403);
        }
        const settings = parseProjectSettingsJson(link.project.settingsJson);
        if (!settings.modules.omTenantPortal || !settings.modules.issues) {
            return c.json({ error: "Reporting is disabled for this building" }, 403);
        }
        const gate = requireOmBilling(link.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const clientIp = c.req.header("cf-connecting-ip")?.trim() ||
            c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
            c.req.header("x-real-ip")?.trim() ||
            undefined;
        if (await occupantSubmitRateLimited(link.project.workspaceId, token, clientIp)) {
            return c.json({ error: "Too many requests. Please try again in a minute." }, 429);
        }
        const assetSecret = body.data.assetSecret?.trim();
        let boundAsset = null;
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
                    bimAnchor: true,
                },
            });
            if (!a)
                return c.json({ error: "Invalid equipment link" }, 400);
            boundAsset = a;
        }
        const issueBimAnchor = boundAsset ? bimAnchorJsonForIssue(boundAsset.bimAnchor) : null;
        let resolvedDrawing;
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
                return c.json({ error: "This building has no drawings yet — please contact facilities." }, 400);
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
        const { fileId, fileVersionId, pageNumber, annotationId, sheetName, sheetVersion } = resolvedDrawing;
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
                ...(issueBimAnchor ? { bimAnchor: issueBimAnchor } : {}),
                title,
                description: body.data.description,
                location: location || null,
                issueKind: IssueKind.OCCUPANT,
                status: IssueStatus.OPEN,
                statusChangedAt: new Date(),
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
        const notifyUserIds = new Set();
        for (const a of admins)
            notifyUserIds.add(a.userId);
        for (const p of projectInternals)
            notifyUserIds.add(p.userId);
        const viewerPath = issue.fileId && issue.fileVersionId
            ? buildViewerIssuePath({
                issueId: issue.id,
                fileId: issue.fileId,
                fileVersionId: issue.fileVersionId,
                projectId: issue.projectId,
                fileName: sheetName?.trim() ? sheetName.trim() : "Drawing",
                version: sheetVersion ?? 1,
                bimAnchor: issueBimAnchor,
            })
            : `/projects/${link.projectId}/om/tenant-requests/${issue.id}`;
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
                if (!u?.email)
                    continue;
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
            ok: true,
            issueId: issue.id,
            occupantPhotoToken: photoToken,
            occupantPhotoExpiresAt: photoExpires.toISOString(),
        });
    });
    r.post("/occupant/:token/issues/:issueId/reference-photos/presign", async (c) => {
        const portalToken = c.req.param("token");
        const issueId = c.req.param("issueId");
        const link = await prisma.occupantPortalToken.findFirst({
            where: { token: portalToken, revokedAt: null },
            include: { project: { include: { workspace: true } } },
        });
        if (!link)
            return c.json({ error: "Invalid or expired link" }, 404);
        if (!link.project.operationsMode)
            return c.json({ error: "This portal is not active" }, 403);
        if (link.expiresAt && link.expiresAt < new Date()) {
            return c.json({ error: "This link has expired" }, 403);
        }
        const settings = parseProjectSettingsJson(link.project.settingsJson);
        if (!settings.modules.omTenantPortal || !settings.modules.issues) {
            return c.json({ error: "Reporting is disabled for this building" }, 403);
        }
        const gate = requireOmBilling(link.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            occupantPhotoToken: z.string().min(1).max(200),
            fileName: z.string().min(1),
            contentType: z.string().default("application/octet-stream"),
            sizeBytes: z.coerce.bigint(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
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
        if (!issue)
            return c.json({ error: "Not found" }, 404);
        if (!issue.occupantPhotoToken ||
            issue.occupantPhotoToken !== body.data.occupantPhotoToken.trim()) {
            return c.json({ error: "Forbidden" }, 403);
        }
        if (!issue.occupantPhotoTokenExpiresAt || issue.occupantPhotoTokenExpiresAt < new Date()) {
            return c.json({ error: "Upload window expired" }, 403);
        }
        const ct = body.data.contentType.trim().toLowerCase();
        if (!ALLOWED_ISSUE_PHOTO_CONTENT_TYPES.has(ct)) {
            return c.json({
                error: "Only JPEG, PNG, WebP, GIF, or HEIC/HEIF images are allowed for reference photos",
            }, 400);
        }
        if (body.data.sizeBytes <= 0n) {
            return c.json({ error: "File is empty" }, 400);
        }
        if (body.data.sizeBytes > MAX_ISSUE_PHOTO_BYTES) {
            return c.json({ error: "File too large (max 15 MB per reference photo)" }, 400);
        }
        const existing = parseReferencePhotos(issue.referencePhotos);
        if (existing.length >= MAX_ISSUE_REFERENCE_PHOTOS) {
            return c.json({ error: `At most ${MAX_ISSUE_REFERENCE_PHOTOS} reference photos per issue` }, 400);
        }
        const ws = link.project.workspace;
        const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        const uploadId = newUploadId();
        const s3Key = buildIssueReferencePhotoKey(issue.workspaceId, issue.projectId, uploadId, body.data.fileName);
        let uploadUrl;
        try {
            uploadUrl = await presignPut(env, s3Key, ct);
        }
        catch (e) {
            console.error("[occupant issue photo presign]", e);
            return c.json({ error: "Could not create upload URL. Check S3 credentials and bucket configuration." }, 503);
        }
        if (!uploadUrl) {
            return c.json({ error: "S3 not configured" }, 503);
        }
        return c.json({ uploadUrl, key: s3Key });
    });
    r.post("/occupant/:token/issues/:issueId/reference-photos/complete", async (c) => {
        const portalToken = c.req.param("token");
        const issueId = c.req.param("issueId");
        const link = await prisma.occupantPortalToken.findFirst({
            where: { token: portalToken, revokedAt: null },
            include: { project: { include: { workspace: true } } },
        });
        if (!link)
            return c.json({ error: "Invalid or expired link" }, 404);
        if (!link.project.operationsMode)
            return c.json({ error: "This portal is not active" }, 403);
        if (link.expiresAt && link.expiresAt < new Date()) {
            return c.json({ error: "This link has expired" }, 403);
        }
        const settings = parseProjectSettingsJson(link.project.settingsJson);
        if (!settings.modules.omTenantPortal || !settings.modules.issues) {
            return c.json({ error: "Reporting is disabled for this building" }, 403);
        }
        const gate = requireOmBilling(link.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            occupantPhotoToken: z.string().min(1).max(200),
            key: z.string().min(1),
            fileName: z.string().min(1),
            contentType: z.string().default("image/jpeg"),
            sizeBytes: z.coerce.bigint(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
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
        if (!issue)
            return c.json({ error: "Not found" }, 404);
        if (!issue.occupantPhotoToken ||
            issue.occupantPhotoToken !== body.data.occupantPhotoToken.trim()) {
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
            return c.json({ error: `At most ${MAX_ISSUE_REFERENCE_PHOTOS} reference photos per issue` }, 400);
        }
        const ws = link.project.workspace;
        const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        const photoId = randomUUID();
        const entry = {
            id: photoId,
            s3Key: body.data.key,
            fileName: body.data.fileName,
            contentType: ct,
            createdAt: new Date().toISOString(),
            sizeBytes: Number(body.data.sizeBytes > BigInt(Number.MAX_SAFE_INTEGER)
                ? BigInt(Number.MAX_SAFE_INTEGER)
                : body.data.sizeBytes),
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
        if (updated.fileVersionId && collaborationGloballyEnabled(env)) {
            broadcastIssuesChanged(updated.fileVersionId);
        }
        return c.json({ ok: true, photoId });
    });
}
