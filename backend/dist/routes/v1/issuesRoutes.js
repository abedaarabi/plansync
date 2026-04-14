import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ActivityType, IssueKind, IssuePriority, IssueStatus, RfiStatus, } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "../../lib/prisma.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectForMember, assertUserAssignableToProject } from "../../lib/projectAccess.js";
import { canCreateIssues, issuesWhereForAuth, loadProjectWithAuth } from "../../lib/permissions.js";
import { logActivity } from "../../lib/activity.js";
import { buildIssueReferencePhotoKey, newUploadId, s3KeyMatchesIssueReferencePhoto, } from "../../lib/fileUpload.js";
import { inviteFromAddress } from "../../lib/inviteEmail.js";
import { deleteObject, presignGet, presignPut } from "../../lib/s3.js";
import { buildIssueAssignedEmailHtml, buildIssueAssignedEmailText, buildViewerIssuePath, buildViewerIssueUrl, } from "../../lib/issueAssignEmail.js";
import { createUserNotifications } from "../../lib/userNotifications.js";
import { broadcastViewerState } from "../../lib/viewerCollabHub.js";
import { collaborationGloballyEnabled } from "../../lib/viewerCollabPolicy.js";
function requirePro(workspace) {
    if (!isWorkspacePro(workspace)) {
        return { error: "Pro subscription required", status: 402 };
    }
    return null;
}
const MAX_ISSUE_REFERENCE_PHOTOS = 12;
const MAX_ISSUE_PHOTO_BYTES = 15n * 1024n * 1024n;
const MAX_ISSUE_PHOTO_SKETCH_BYTES = 48_000;
const ALLOWED_ISSUE_PHOTO_CONTENT_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    /** Common default from iPhone / iPad camera. */
    "image/heic",
    "image/heif",
]);
function sketchJsonByteSize(sk) {
    try {
        return new TextEncoder().encode(JSON.stringify(sk)).length;
    }
    catch {
        return MAX_ISSUE_PHOTO_SKETCH_BYTES + 1;
    }
}
function parseReferencePhotos(v) {
    if (!Array.isArray(v))
        return [];
    const out = [];
    for (const x of v) {
        if (!x || typeof x !== "object")
            continue;
        const o = x;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 80) : "";
        const s3Key = typeof o.s3Key === "string" && o.s3Key.trim() ? o.s3Key.trim().slice(0, 500) : "";
        const fileName = typeof o.fileName === "string" && o.fileName.trim() ? o.fileName.trim().slice(0, 200) : "";
        if (!id || !s3Key || !fileName)
            continue;
        const contentType = typeof o.contentType === "string" ? o.contentType.trim().slice(0, 120) : undefined;
        const createdAt = typeof o.createdAt === "string" && o.createdAt.trim()
            ? o.createdAt.trim().slice(0, 80)
            : new Date().toISOString();
        let sizeBytes = 0;
        if (typeof o.sizeBytes === "number" && Number.isFinite(o.sizeBytes) && o.sizeBytes >= 0) {
            sizeBytes = Math.min(Math.floor(o.sizeBytes), 80 * 1024 * 1024);
        }
        const sketchRaw = "sketch" in o ? o.sketch : undefined;
        const sketch = sketchRaw !== undefined && sketchJsonByteSize(sketchRaw) <= MAX_ISSUE_PHOTO_SKETCH_BYTES
            ? sketchRaw
            : undefined;
        out.push({
            id,
            s3Key,
            fileName,
            contentType,
            createdAt,
            sizeBytes,
            ...(sketch !== undefined ? { sketch } : {}),
        });
    }
    return out.slice(0, MAX_ISSUE_REFERENCE_PHOTOS);
}
function referencePhotosToJsonValue(photos) {
    return JSON.parse(JSON.stringify(photos));
}
function issuePhotosStorageBytes(photos) {
    return photos.reduce((n, p) => n + BigInt(p.sizeBytes || 0), 0n);
}
/** Parse `YYYY-MM-DD` from client date inputs; noon UTC avoids TZ edge shifts. */
function dateFromYmd(s) {
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
        orderBy: { createdAt: "asc" },
    },
};
const CARRY_FORWARD_META_KEY = "__carryForwardFromFileVersionId";
function issueRowJson(row) {
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
        attachedMarkupAnnotationIds: parseAttachedMarkupAnnotationIds(row.attachedMarkupAnnotationIds),
        referencePhotos: parseReferencePhotos(row.referencePhotos),
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
function asObject(v) {
    if (!v || typeof v !== "object" || Array.isArray(v))
        return null;
    return v;
}
/** Normalized list of viewer annotation ids for markups linked to an issue (not the pin). */
function parseAttachedMarkupAnnotationIds(v) {
    if (!Array.isArray(v))
        return [];
    const out = [];
    for (const x of v) {
        if (typeof x === "string" && x.trim())
            out.push(x.trim());
    }
    return [...new Set(out)].slice(0, 30);
}
/** Annotation ids to drop from `FileVersion.annotationBlob` when an issue is deleted (pin + linked markups). */
function annotationIdsToRemoveForDeletedIssue(issueId, issueAnnotationId, attachedMarkupAnnotationIdsJson, blobAnnotations) {
    const ids = new Set();
    const pin = typeof issueAnnotationId === "string" ? issueAnnotationId.trim() : "";
    if (pin)
        ids.add(pin);
    for (const id of parseAttachedMarkupAnnotationIds(attachedMarkupAnnotationIdsJson)) {
        ids.add(id);
    }
    for (const ann of blobAnnotations) {
        if (!ann || typeof ann !== "object")
            continue;
        const o = ann;
        const id = typeof o.id === "string" ? o.id : "";
        const linked = typeof o.linkedIssueId === "string" ? o.linkedIssueId : null;
        if (linked === issueId && id)
            ids.add(id);
    }
    return ids;
}
function stripIssueLinkedAnnotationsFromViewerBlob(blobUnknown, issueId, issueAnnotationId, attachedMarkupAnnotationIdsJson) {
    const blobObj = asObject(blobUnknown) ?? {};
    const annotations = Array.isArray(blobObj.annotations) ? blobObj.annotations : [];
    const idsToRemove = annotationIdsToRemoveForDeletedIssue(issueId, issueAnnotationId, attachedMarkupAnnotationIdsJson, annotations);
    const nextAnnotations = annotations.filter((ann) => {
        if (!ann || typeof ann !== "object")
            return true;
        const o = ann;
        const id = typeof o.id === "string" ? o.id : "";
        if (!id)
            return true;
        return !idsToRemove.has(id);
    });
    if (nextAnnotations.length === annotations.length)
        return null;
    return { ...blobObj, annotations: nextAnnotations };
}
async function fileVersionWriteBlocked(fileVersionId, userId) {
    const fv = await prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        select: { lockedByUserId: true, lockExpiresAt: true },
    });
    if (!fv?.lockedByUserId)
        return false;
    if (fv.lockExpiresAt && fv.lockExpiresAt < new Date())
        return false;
    return fv.lockedByUserId !== userId;
}
async function sendIssueAssignedEmail(env, input) {
    const key = env.RESEND_API_KEY?.trim();
    const from = inviteFromAddress(env);
    if (!key || !from)
        return;
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
export function registerIssuesRoutes(r, needUser, env, opts) {
    const notifyIssues = (fileVersionId) => opts?.onIssuesMutated?.(fileVersionId);
    r.get("/file-versions/:fileVersionId/issues", needUser, async (c) => {
        const fileVersionId = c.req.param("fileVersionId");
        const fv = await prisma.fileVersion.findUnique({
            where: { id: fileVersionId },
            include: { file: { include: { project: { include: { workspace: true } } } } },
        });
        if (!fv)
            return c.json({ error: "Not found" }, 404);
        const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const issueKindRaw = c.req.query("issueKind")?.trim();
        const issueKind = issueKindRaw === "WORK_ORDER" || issueKindRaw === "CONSTRUCTION"
            ? issueKindRaw
            : undefined;
        const rows = await prisma.issue.findMany({
            where: { fileVersionId, ...(issueKind ? { issueKind } : {}) },
            include: issueInclude,
            orderBy: { createdAt: "desc" },
        });
        return c.json(rows.map(issueRowJson));
    });
    r.get("/projects/:projectId/issues", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const fileVersionId = c.req.query("fileVersionId")?.trim() || undefined;
        const assetIdFilter = c.req.query("assetId")?.trim() || undefined;
        const issueKindRaw = c.req.query("issueKind")?.trim();
        const issueKind = issueKindRaw === "WORK_ORDER" || issueKindRaw === "CONSTRUCTION"
            ? issueKindRaw
            : undefined;
        const userId = c.get("user").id;
        const auth = await loadProjectWithAuth(projectId, userId);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!ctx.settings.modules.issues) {
            return c.json([]);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
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
        const issueId = c.req.param("issueId");
        const row = await prisma.issue.findUnique({
            where: { id: issueId },
            include: issueInclude,
        });
        if (!row)
            return c.json({ error: "Not found" }, 404);
        const userId = c.get("user").id;
        const auth = await loadProjectWithAuth(row.projectId, userId);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!ctx.settings.modules.issues) {
            return c.json({ error: "Not found" }, 404);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const scope = issuesWhereForAuth(ctx, userId);
        const allowed = await prisma.issue.count({
            where: { id: issueId, projectId: row.projectId, ...scope },
        });
        if (allowed === 0)
            return c.json({ error: "Not found" }, 404);
        return c.json(issueRowJson(row));
    });
    r.post("/issues/:issueId/reference-photos/presign", needUser, async (c) => {
        const issueId = c.req.param("issueId");
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
        if (!issue)
            return c.json({ error: "Not found" }, 404);
        const auth = await loadProjectWithAuth(issue.projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!ctx.settings.modules.issues) {
            return c.json({ error: "Not found" }, 404);
        }
        if (!canCreateIssues(ctx)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        if (await fileVersionWriteBlocked(issue.fileVersionId, c.get("user").id)) {
            return c.json({ error: "File is locked by another user" }, 409);
        }
        const existing = parseReferencePhotos(issue.referencePhotos);
        if (existing.length >= MAX_ISSUE_REFERENCE_PHOTOS) {
            return c.json({ error: `At most ${MAX_ISSUE_REFERENCE_PHOTOS} reference photos per issue` }, 400);
        }
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
        const ws = ctx.project.workspace;
        const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        const uploadId = newUploadId();
        const key = buildIssueReferencePhotoKey(ctx.project.workspaceId, issue.projectId, uploadId, body.data.fileName);
        let url;
        try {
            url = await presignPut(env, key, ct);
        }
        catch (e) {
            console.error("[issue reference photo presign]", e);
            return c.json({ error: "Could not create upload URL. Check S3 credentials and bucket configuration." }, 503);
        }
        if (!url) {
            return c.json({ error: "S3 not configured — set AWS_* and S3_BUCKET", devKey: key }, 503);
        }
        return c.json({ uploadUrl: url, key });
    });
    r.post("/issues/:issueId/reference-photos/complete", needUser, async (c) => {
        const issueId = c.req.param("issueId");
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
        if (!issue)
            return c.json({ error: "Not found" }, 404);
        const auth = await loadProjectWithAuth(issue.projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!ctx.settings.modules.issues) {
            return c.json({ error: "Not found" }, 404);
        }
        if (!canCreateIssues(ctx)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        if (await fileVersionWriteBlocked(issue.fileVersionId, c.get("user").id)) {
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
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
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
            return c.json({ error: `At most ${MAX_ISSUE_REFERENCE_PHOTOS} reference photos per issue` }, 400);
        }
        const ws = ctx.project.workspace;
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
                where: { id: ctx.project.workspaceId },
                data: { storageUsedBytes: { increment: body.data.sizeBytes } },
            });
            return tx.issue.update({
                where: { id: issue.id },
                data: { referencePhotos: referencePhotosToJsonValue(next) },
                include: issueInclude,
            });
        });
        notifyIssues(updated.fileVersionId);
        return c.json(issueRowJson(updated));
    });
    r.get("/issues/:issueId/reference-photos/:photoId/presign-read", needUser, async (c) => {
        const issueId = c.req.param("issueId");
        const photoId = c.req.param("photoId");
        const row = await prisma.issue.findUnique({
            where: { id: issueId },
            include: issueInclude,
        });
        if (!row)
            return c.json({ error: "Not found" }, 404);
        const userId = c.get("user").id;
        const auth = await loadProjectWithAuth(row.projectId, userId);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!ctx.settings.modules.issues) {
            return c.json({ error: "Not found" }, 404);
        }
        const gate = requirePro(ctx.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const scope = issuesWhereForAuth(ctx, userId);
        const allowed = await prisma.issue.count({
            where: { id: issueId, projectId: row.projectId, ...scope },
        });
        if (allowed === 0)
            return c.json({ error: "Not found" }, 404);
        const photos = parseReferencePhotos(row.referencePhotos);
        const hit = photos.find((p) => p.id === photoId);
        if (!hit)
            return c.json({ error: "Not found" }, 404);
        let url;
        try {
            url = await presignGet(env, hit.s3Key);
        }
        catch (e) {
            console.error("[issue reference photo presign-read]", e);
            return c.json({ error: "Could not create download link (S3)." }, 503);
        }
        if (!url)
            return c.json({ error: "S3 not configured" }, 503);
        return c.json({ url });
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
            /** Extra sheet markups (annotation ids) to associate with this issue (same revision). */
            attachedMarkupAnnotationIds: z.array(z.string().min(1)).max(30).optional(),
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
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const file = await prisma.file.findFirst({
            where: { id: body.data.fileId, project: { workspaceId: body.data.workspaceId } },
            include: { project: { include: { workspace: true } } },
        });
        if (!file)
            return c.json({ error: "File not found" }, 404);
        const auth = await loadProjectWithAuth(file.projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const { ctx } = auth;
        if (!ctx.settings.modules.issues) {
            return c.json({ error: "Issues are disabled for this project" }, 403);
        }
        if (!canCreateIssues(ctx)) {
            return c.json({ error: "Forbidden" }, 403);
        }
        const gate = requirePro(file.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const fv = await prisma.fileVersion.findFirst({
            where: { id: body.data.fileVersionId, fileId: file.id },
        });
        if (!fv)
            return c.json({ error: "File version not found" }, 404);
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
            const a = await assertUserAssignableToProject(body.data.assigneeId, file.projectId, body.data.workspaceId);
            if ("error" in a)
                return c.json({ error: a.error }, a.status);
        }
        if (body.data.assetId) {
            const ast = await prisma.asset.findFirst({
                where: { id: body.data.assetId, projectId: file.projectId },
            });
            if (!ast)
                return c.json({ error: "Asset not found on this project" }, 400);
        }
        const extEmail = body.data.externalAssigneeEmail?.trim();
        const extName = body.data.externalAssigneeName?.trim();
        const startDate = body.data.startDate === undefined
            ? undefined
            : body.data.startDate === null
                ? null
                : dateFromYmd(body.data.startDate);
        const dueDate = body.data.dueDate === undefined
            ? undefined
            : body.data.dueDate === null
                ? null
                : dateFromYmd(body.data.dueDate);
        const primaryAnnId = body.data.annotationId?.trim();
        const attachedCreate = parseAttachedMarkupAnnotationIds(body.data.attachedMarkupAnnotationIds ?? []).filter((id) => !primaryAnnId || id !== primaryAnnId);
        const issue = await prisma.$transaction(async (tx) => {
            const iss = await tx.issue.create({
                data: {
                    workspaceId: body.data.workspaceId,
                    projectId: file.projectId,
                    fileId: body.data.fileId,
                    fileVersionId: body.data.fileVersionId,
                    title: body.data.title,
                    description: body.data.description,
                    annotationId: primaryAnnId,
                    ...(attachedCreate.length > 0
                        ? { attachedMarkupAnnotationIds: attachedCreate }
                        : {}),
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
        const newFileVersionId = c.req.param("newFileVersionId");
        const body = z
            .object({
            fromFileVersionId: z.string().min(1),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
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
        if (!fromVersion || !toVersion)
            return c.json({ error: "File version not found" }, 404);
        if (fromVersion.fileId !== toVersion.fileId) {
            return c.json({ error: "Versions must belong to the same file" }, 400);
        }
        if (fromVersion.version >= toVersion.version) {
            return c.json({ error: "Source version must be older than destination version" }, 400);
        }
        const carryAccess = await loadProjectForMember(fromVersion.file.projectId, c.get("user").id);
        if ("error" in carryAccess)
            return c.json({ error: carryAccess.error }, carryAccess.status);
        const gate = requirePro(carryAccess.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        if (await fileVersionWriteBlocked(toVersion.id, c.get("user").id)) {
            return c.json({ error: "File is locked by another user" }, 409);
        }
        const toBlobObj = asObject(toVersion.annotationBlob);
        if (toBlobObj?.[CARRY_FORWARD_META_KEY] === body.data.fromFileVersionId) {
            notifyIssues(newFileVersionId);
            return c.json({ ok: true, copiedIssueCount: 0, idempotent: true });
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
                    },
                },
            });
            notifyIssues(newFileVersionId);
            return c.json({ ok: true, copiedIssueCount: 0, idempotent: false });
        }
        const sourceBlobObj = asObject(fromVersion.annotationBlob);
        const sourceAnnotations = Array.isArray(sourceBlobObj?.annotations)
            ? sourceBlobObj?.annotations
            : [];
        const result = await prisma.$transaction(async (tx) => {
            const createdRows = await Promise.all(sourceIssues.map((issue) => tx.issue.create({
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
                            attachedMarkupAnnotationIds: parseAttachedMarkupAnnotationIds(issue.attachedMarkupAnnotationIds),
                        }
                        : {}),
                    ...(parseReferencePhotos(issue.referencePhotos).length > 0
                        ? {
                            referencePhotos: referencePhotosToJsonValue(parseReferencePhotos(issue.referencePhotos)),
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
            })));
            const issueIdMap = new Map();
            sourceIssues.forEach((oldIssue, idx) => issueIdMap.set(oldIssue.id, createdRows[idx].id));
            const nextAnnotations = sourceAnnotations.map((ann) => {
                const linked = typeof ann.linkedIssueId === "string" ? ann.linkedIssueId : null;
                if (!linked)
                    return ann;
                const mapped = issueIdMap.get(linked);
                if (!mapped)
                    return ann;
                return { ...ann, linkedIssueId: mapped };
            });
            const nextBlob = {
                ...(sourceBlobObj ?? {}),
                annotations: nextAnnotations,
                [CARRY_FORWARD_META_KEY]: body.data.fromFileVersionId,
            };
            await tx.fileVersion.update({
                where: { id: toVersion.id },
                data: { annotationBlob: nextBlob },
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
        return c.json({ ok: true, copiedIssueCount: result, idempotent: false });
    });
    r.patch("/issues/:issueId", needUser, async (c) => {
        const issueId = c.req.param("issueId");
        const issue = await prisma.issue.findUnique({
            where: { id: issueId },
            include: {
                workspace: true,
                assignee: { select: { id: true, email: true } },
                file: { select: { name: true } },
                fileVersion: { select: { version: true } },
            },
        });
        if (!issue)
            return c.json({ error: "Not found" }, 404);
        const issuePatchAccess = await loadProjectForMember(issue.projectId, c.get("user").id);
        if ("error" in issuePatchAccess)
            return c.json({ error: issuePatchAccess.error }, issuePatchAccess.status);
        const gate = requirePro(issuePatchAccess.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
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
                .array(z.object({
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
            }))
                .max(MAX_ISSUE_REFERENCE_PHOTOS)
                .nullable()
                .optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const prevPhotosForRef = parseReferencePhotos(issue.referencePhotos);
        let nextReferencePhotos;
        let photosToDeleteFromS3 = [];
        let bytesRemovedFromPhotos = 0n;
        const refRaw = body.data.referencePhotos;
        if (refRaw !== undefined) {
            const incoming = refRaw === null ? [] : refRaw;
            const seenIds = new Set();
            const seenKeys = new Set();
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
                const sizeBytes = typeof r.sizeBytes === "number" && r.sizeBytes > 0
                    ? r.sizeBytes
                    : (match?.sizeBytes ?? 0);
                const sketch = r.sketch === null ? undefined : r.sketch !== undefined ? r.sketch : match?.sketch;
                return {
                    id: r.id,
                    s3Key: r.s3Key,
                    fileName: r.fileName,
                    contentType: r.contentType,
                    createdAt: (r.createdAt && r.createdAt.trim()) || match?.createdAt || new Date().toISOString(),
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
        const nextAnnotationId = body.data.annotationId === undefined ? undefined : body.data.annotationId;
        const nextAttachedRaw = body.data.attachedMarkupAnnotationIds;
        const nextAttachedIds = nextAttachedRaw === undefined
            ? undefined
            : nextAttachedRaw === null
                ? null
                : parseAttachedMarkupAnnotationIds(nextAttachedRaw).filter((id) => !issue.annotationId || id !== issue.annotationId);
        if (nextAssigneeId) {
            const a = await assertUserAssignableToProject(nextAssigneeId, issue.projectId, issue.workspaceId);
            if ("error" in a)
                return c.json({ error: a.error }, a.status);
        }
        if (body.data.assetId) {
            const ast = await prisma.asset.findFirst({
                where: { id: body.data.assetId, projectId: issue.projectId },
            });
            if (!ast)
                return c.json({ error: "Asset not found on this project" }, 400);
        }
        const patchStart = body.data.startDate === undefined
            ? undefined
            : body.data.startDate === null
                ? null
                : dateFromYmd(body.data.startDate);
        const patchDue = body.data.dueDate === undefined
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
        const shouldStampResolved = nextStatus === IssueStatus.RESOLVED || nextStatus === IssueStatus.CLOSED;
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
                    sheetName: fileFresh?.name ?? issue.file.name,
                    sheetVersion: fvFresh?.version ?? issue.fileVersion.version,
                    ...(body.data.status !== undefined ? { status: body.data.status } : {}),
                    ...(body.data.title !== undefined ? { title: body.data.title } : {}),
                    ...(body.data.description !== undefined ? { description: body.data.description } : {}),
                    ...(nextAssigneeId !== undefined ? { assigneeId: nextAssigneeId } : {}),
                    ...(nextAnnotationId !== undefined ? { annotationId: nextAnnotationId } : {}),
                    ...(nextAttachedIds !== undefined
                        ? {
                            attachedMarkupAnnotationIds: nextAttachedIds === null || nextAttachedIds.length === 0
                                ? null
                                : nextAttachedIds,
                        }
                        : {}),
                    ...(nextReferencePhotos !== undefined
                        ? {
                            referencePhotos: nextReferencePhotos.length === 0
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
        const shouldNotifyAssignee = nextAssigneeId !== undefined && nextAssigneeId !== null && nextAssigneeId !== prevAssigneeId;
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
        for (const p of photosToDeleteFromS3) {
            void deleteObject(env, p.s3Key).catch((e) => console.error("[issue reference photo delete after patch]", p.s3Key, e));
        }
        notifyIssues(issue.fileVersionId);
        return c.json(issueRowJson(updated));
    });
    r.delete("/issues/:issueId", needUser, async (c) => {
        const issueId = c.req.param("issueId");
        const issue = await prisma.issue.findUnique({
            where: { id: issueId },
            include: { workspace: true },
        });
        if (!issue)
            return c.json({ error: "Not found" }, 404);
        const delAccess = await loadProjectForMember(issue.projectId, c.get("user").id);
        if ("error" in delAccess)
            return c.json({ error: delAccess.error }, delAccess.status);
        const gate = requirePro(delAccess.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        if (await fileVersionWriteBlocked(issue.fileVersionId, c.get("user").id)) {
            return c.json({ error: "File is locked by another user" }, 409);
        }
        const title = issue.title;
        const photos = parseReferencePhotos(issue.referencePhotos);
        const photoBytes = issuePhotosStorageBytes(photos);
        const viewerRevision = await prisma.$transaction(async (tx) => {
            const fv = await tx.fileVersion.findUnique({
                where: { id: issue.fileVersionId },
                select: { annotationBlob: true },
            });
            const nextBlob = stripIssueLinkedAnnotationsFromViewerBlob(fv?.annotationBlob, issueId, issue.annotationId, issue.attachedMarkupAnnotationIds);
            let rev;
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
            await tx.issue.delete({ where: { id: issueId } });
            if (photoBytes > 0n) {
                await tx.workspace.update({
                    where: { id: issue.workspaceId },
                    data: { storageUsedBytes: { decrement: photoBytes } },
                });
            }
            return rev;
        });
        if (viewerRevision !== undefined && collaborationGloballyEnabled(env)) {
            broadcastViewerState(issue.fileVersionId, viewerRevision, c.get("user").id);
        }
        for (const p of photos) {
            void deleteObject(env, p.s3Key).catch((e) => console.error("[issue reference photo delete on issue delete]", p.s3Key, e));
        }
        await logActivity(issue.workspaceId, ActivityType.ISSUE_DELETED, {
            actorUserId: c.get("user").id,
            entityId: issueId,
            projectId: issue.projectId,
            metadata: { title },
        });
        notifyIssues(issue.fileVersionId);
        return c.json({ ok: true });
    });
}
