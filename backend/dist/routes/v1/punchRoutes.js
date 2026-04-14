import { randomUUID } from "node:crypto";
import { PunchPriority, PunchStatus, ActivityType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectForMember, assertUserAssignableToProject } from "../../lib/projectAccess.js";
import { logActivity, logActivitySafe } from "../../lib/activity.js";
import { buildPunchReferencePhotoKey, newUploadId, s3KeyMatchesPunchReferencePhoto, } from "../../lib/fileUpload.js";
import { deleteObject, presignGet, presignPut } from "../../lib/s3.js";
import { MAX_PUNCH_PHOTO_BYTES, MAX_PUNCH_REFERENCE_PHOTOS, parsePunchReferencePhotos, punchPhotosStorageBytes, punchReferencePhotosToJsonValue, } from "../../lib/punchReferencePhotos.js";
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
const ALLOWED_PUNCH_PHOTO_CONTENT_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
]);
const punchInclude = {
    assignee: { select: { id: true, name: true, email: true, image: true } },
};
function punchJson(row) {
    return {
        id: row.id,
        projectId: row.projectId,
        punchNumber: row.punchNumber,
        title: row.title,
        location: row.location,
        trade: row.trade,
        priority: row.priority,
        status: row.status,
        notes: row.notes,
        dueDate: row.dueDate ? row.dueDate.toISOString() : null,
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
        assigneeId: row.assigneeId,
        templateId: row.templateId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        assignee: row.assignee,
        referencePhotos: parsePunchReferencePhotos(row.referencePhotos),
    };
}
async function nextPunchNumber(tx, projectId) {
    const agg = await tx.punchItem.aggregate({
        where: { projectId },
        _max: { punchNumber: true },
    });
    return (agg._max.punchNumber ?? 0) + 1;
}
export function registerPunchRoutes(r, needUser, env) {
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
            orderBy: [{ punchNumber: "desc" }],
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
            assigneeId: z.union([z.string().min(1), z.null()]).optional(),
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
        const row = await prisma.$transaction(async (tx) => {
            const punchNumber = await nextPunchNumber(tx, projectId);
            return tx.punchItem.create({
                data: {
                    projectId,
                    punchNumber,
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
        });
        await logActivity(res.project.workspaceId, ActivityType.PUNCH_CREATED, {
            actorUserId: c.get("user").id,
            entityId: row.id,
            projectId,
            metadata: { location: row.location, trade: row.trade, punchNumber: row.punchNumber },
        });
        return c.json(punchJson(row));
    });
    r.post("/projects/:projectId/punch/:punchId/photos/presign", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const punchId = c.req.param("punchId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const punch = await prisma.punchItem.findFirst({
            where: { id: punchId, projectId },
            select: { id: true, referencePhotos: true },
        });
        if (!punch)
            return c.json({ error: "Not found" }, 404);
        const existing = parsePunchReferencePhotos(punch.referencePhotos);
        if (existing.length >= MAX_PUNCH_REFERENCE_PHOTOS) {
            return c.json({ error: `At most ${MAX_PUNCH_REFERENCE_PHOTOS} photos per punch item` }, 400);
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
        if (!ALLOWED_PUNCH_PHOTO_CONTENT_TYPES.has(ct)) {
            return c.json({ error: "Only JPEG, PNG, WebP, GIF, or HEIC/HEIF images are allowed for punch photos" }, 400);
        }
        if (body.data.sizeBytes <= 0n)
            return c.json({ error: "File is empty" }, 400);
        if (body.data.sizeBytes > MAX_PUNCH_PHOTO_BYTES) {
            return c.json({ error: "File too large (max 15 MB per photo)" }, 400);
        }
        const ws = res.project.workspace;
        const newUsed = ws.storageUsedBytes + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        const uploadId = newUploadId();
        const key = buildPunchReferencePhotoKey(res.project.workspaceId, projectId, uploadId, body.data.fileName);
        let url;
        try {
            url = await presignPut(env, key, ct);
        }
        catch (e) {
            console.error("[punch photo presign]", e);
            return c.json({ error: "Could not create upload URL. Check S3 credentials and bucket configuration." }, 503);
        }
        if (!url) {
            return c.json({ error: "S3 not configured — set AWS_* and S3_BUCKET", devKey: key }, 503);
        }
        return c.json({ uploadUrl: url, key });
    });
    r.post("/projects/:projectId/punch/:punchId/photos/complete", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const punchId = c.req.param("punchId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const punch = await prisma.punchItem.findFirst({
            where: { id: punchId, projectId },
            select: { id: true, referencePhotos: true },
        });
        if (!punch)
            return c.json({ error: "Not found" }, 404);
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
        if (body.data.sizeBytes <= 0n)
            return c.json({ error: "File is empty" }, 400);
        if (body.data.sizeBytes > MAX_PUNCH_PHOTO_BYTES) {
            return c.json({ error: "File too large (max 15 MB per photo)" }, 400);
        }
        if (!s3KeyMatchesPunchReferencePhoto(body.data.key, res.project.workspaceId, projectId)) {
            return c.json({ error: "Invalid upload key" }, 400);
        }
        const ct = body.data.contentType.trim().toLowerCase();
        if (!ALLOWED_PUNCH_PHOTO_CONTENT_TYPES.has(ct)) {
            return c.json({ error: "Invalid content type for punch photo" }, 400);
        }
        const prev = parsePunchReferencePhotos(punch.referencePhotos);
        if (prev.length >= MAX_PUNCH_REFERENCE_PHOTOS) {
            return c.json({ error: `At most ${MAX_PUNCH_REFERENCE_PHOTOS} photos per punch item` }, 400);
        }
        const ws = res.project.workspace;
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
        const next = [...prev, entry];
        const updated = await prisma.$transaction(async (tx) => {
            await tx.workspace.update({
                where: { id: res.project.workspaceId },
                data: { storageUsedBytes: { increment: body.data.sizeBytes } },
            });
            return tx.punchItem.update({
                where: { id: punch.id },
                data: { referencePhotos: punchReferencePhotosToJsonValue(next) },
                include: punchInclude,
            });
        });
        await logActivitySafe(res.project.workspaceId, ActivityType.PUNCH_UPDATED, {
            actorUserId: c.get("user").id,
            entityId: updated.id,
            projectId,
            metadata: { photoAdded: true },
        });
        return c.json(punchJson(updated));
    });
    r.get("/projects/:projectId/punch/:punchId/photos/:photoId/presign-read", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const punchId = c.req.param("punchId");
        const photoId = c.req.param("photoId");
        const res = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in res)
            return c.json({ error: res.error }, res.status);
        const gate = requirePro(res.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const row = await prisma.punchItem.findFirst({
            where: { id: punchId, projectId },
            select: { referencePhotos: true },
        });
        if (!row)
            return c.json({ error: "Not found" }, 404);
        const photos = parsePunchReferencePhotos(row.referencePhotos);
        const hit = photos.find((p) => p.id === photoId);
        if (!hit)
            return c.json({ error: "Photo not found" }, 404);
        let url;
        try {
            url = await presignGet(env, hit.s3Key);
        }
        catch (e) {
            console.error("[punch photo presign-read]", e);
            return c.json({ error: "Could not create download link (S3)." }, 503);
        }
        if (!url)
            return c.json({ error: "S3 not configured" }, 503);
        return c.json({ url });
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
            assigneeId: z.union([z.string().min(1), z.null()]).optional(),
            dueDateYmd: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .nullable()
                .optional(),
            notes: z.string().max(5000).nullable().optional(),
            referencePhotos: z
                .array(z.object({
                id: z.string().min(1).max(80),
                s3Key: z.string().min(1).max(500),
                fileName: z.string().min(1).max(220),
                contentType: z.string().max(120).optional(),
                createdAt: z.string().max(80).optional(),
                sizeBytes: z.number().int().min(0).max(80 * 1024 * 1024).optional(),
            }))
                .max(MAX_PUNCH_REFERENCE_PHOTOS)
                .nullable()
                .optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        if (body.data.assigneeId) {
            const check = await assertUserAssignableToProject(body.data.assigneeId, projectId, res.project.workspaceId);
            if ("error" in check)
                return c.json({ error: check.error }, check.status);
        }
        const prevPhotos = parsePunchReferencePhotos(existing.referencePhotos);
        let nextReferencePhotos;
        let photosToDeleteFromS3 = [];
        let bytesRemovedFromPhotos = 0n;
        const refRaw = body.data.referencePhotos;
        if (refRaw !== undefined) {
            const incoming = refRaw === null ? [] : refRaw;
            const seenIds = new Set();
            const seenKeys = new Set();
            for (const row of incoming) {
                if (seenIds.has(row.id))
                    return c.json({ error: "Duplicate photo id" }, 400);
                seenIds.add(row.id);
                if (seenKeys.has(row.s3Key))
                    return c.json({ error: "Duplicate photo storage key" }, 400);
                seenKeys.add(row.s3Key);
                if (!s3KeyMatchesPunchReferencePhoto(row.s3Key, res.project.workspaceId, projectId)) {
                    return c.json({ error: "Invalid photo storage key" }, 400);
                }
            }
            nextReferencePhotos = incoming.map((r) => {
                const match = prevPhotos.find((p) => p.id === r.id && p.s3Key === r.s3Key);
                const sizeBytes = typeof r.sizeBytes === "number" && r.sizeBytes > 0 ? r.sizeBytes : (match?.sizeBytes ?? 0);
                return {
                    id: r.id,
                    s3Key: r.s3Key,
                    fileName: r.fileName,
                    contentType: r.contentType,
                    createdAt: (r.createdAt && r.createdAt.trim()) || match?.createdAt || new Date().toISOString(),
                    sizeBytes,
                };
            });
            const nextKeys = new Set(nextReferencePhotos.map((p) => p.s3Key));
            photosToDeleteFromS3 = prevPhotos.filter((p) => !nextKeys.has(p.s3Key));
            bytesRemovedFromPhotos = punchPhotosStorageBytes(photosToDeleteFromS3);
        }
        const nextStatus = body.data.status;
        const dueDate = body.data.dueDateYmd === undefined
            ? undefined
            : body.data.dueDateYmd === null
                ? null
                : dateFromYmd(body.data.dueDateYmd);
        const completedAt = nextStatus === undefined
            ? undefined
            : nextStatus === PunchStatus.CLOSED
                ? new Date()
                : null;
        const row = await prisma.$transaction(async (tx) => {
            if (bytesRemovedFromPhotos > 0n) {
                await tx.workspace.update({
                    where: { id: res.project.workspaceId },
                    data: { storageUsedBytes: { decrement: bytesRemovedFromPhotos } },
                });
            }
            return tx.punchItem.update({
                where: { id: punchId },
                data: {
                    ...(body.data.title !== undefined ? { title: body.data.title } : {}),
                    ...(body.data.location !== undefined ? { location: body.data.location } : {}),
                    ...(body.data.trade !== undefined ? { trade: body.data.trade } : {}),
                    ...(body.data.priority !== undefined ? { priority: body.data.priority } : {}),
                    ...(body.data.status !== undefined ? { status: body.data.status } : {}),
                    ...(body.data.assigneeId !== undefined ? { assigneeId: body.data.assigneeId } : {}),
                    ...(dueDate !== undefined ? { dueDate } : {}),
                    ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
                    ...(completedAt !== undefined ? { completedAt } : {}),
                    ...(nextReferencePhotos !== undefined
                        ? {
                            referencePhotos: nextReferencePhotos.length === 0
                                ? Prisma.JsonNull
                                : punchReferencePhotosToJsonValue(nextReferencePhotos),
                        }
                        : {}),
                },
                include: punchInclude,
            });
        });
        for (const ph of photosToDeleteFromS3) {
            const del = await deleteObject(env, ph.s3Key);
            if (!del.ok && del.error !== "S3 not configured") {
                console.error("[punch photo delete]", ph.s3Key, del.error);
            }
        }
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
            assigneeId: z.union([z.string().min(1), z.null()]).optional(),
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
            metadata: {
                bulk: true,
                count: body.data.ids.length,
                status: body.data.status ?? null,
                assigneeChanged: body.data.assigneeId !== undefined,
            },
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
        const photos = parsePunchReferencePhotos(existing.referencePhotos);
        const photoBytes = punchPhotosStorageBytes(photos);
        await prisma.$transaction(async (tx) => {
            if (photoBytes > 0n) {
                await tx.workspace.update({
                    where: { id: res.project.workspaceId },
                    data: { storageUsedBytes: { decrement: photoBytes } },
                });
            }
            await tx.punchItem.delete({ where: { id: punchId } });
        });
        for (const ph of photos) {
            const del = await deleteObject(env, ph.s3Key);
            if (!del.ok && del.error !== "S3 not configured") {
                console.error("[punch delete photo]", ph.s3Key, del.error);
            }
        }
        await logActivitySafe(res.project.workspaceId, ActivityType.PUNCH_DELETED, {
            actorUserId: c.get("user").id,
            entityId: existing.id,
            projectId,
            metadata: { location: existing.location, trade: existing.trade },
        });
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
            orderBy: [{ punchNumber: "desc" }],
        });
        const escape = (v) => `"${v.replaceAll(`"`, `""`)}"`;
        const csv = [
            "punchNumber,id,title,location,trade,priority,status,assignee,dueDate,notes,updatedAt",
            ...rows.map((row) => [
                row.punchNumber,
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
        const created = await prisma.$transaction(async (tx) => {
            let n = await nextPunchNumber(tx, projectId);
            const createdIds = [];
            for (const it of items) {
                const row = await tx.punchItem.create({
                    data: {
                        projectId,
                        punchNumber: n,
                        templateId: template.id,
                        title: it.title?.trim() || "Punch item",
                        location: it.location?.trim() || "TBD",
                        trade: it.trade?.trim() || "General",
                        priority: it.priority ?? PunchPriority.P2,
                        status: PunchStatus.OPEN,
                        notes: it.notes?.trim() || null,
                    },
                });
                createdIds.push(row.id);
                n += 1;
            }
            return createdIds.length;
        });
        await logActivitySafe(res.project.workspaceId, ActivityType.PUNCH_CREATED, {
            actorUserId: c.get("user").id,
            projectId,
            metadata: { templateId: template.id, templateName: template.name, count: created },
        });
        return c.json({ ok: true, created });
    });
}
