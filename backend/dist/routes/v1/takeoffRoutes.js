import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { jsonObjectForResponse } from "../../lib/materialTemplate.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { loadProjectForMember } from "../../lib/projectAccess.js";
function requirePro(workspace) {
    if (!isWorkspacePro(workspace)) {
        return { error: "Pro subscription required", status: 402 };
    }
    return null;
}
const takeoffInclude = {
    file: { select: { name: true } },
    fileVersion: { select: { version: true } },
    material: {
        select: {
            id: true,
            name: true,
            unit: true,
            unitPrice: true,
            currency: true,
            customAttributes: true,
            category: { select: { name: true } },
        },
    },
};
function takeoffRowJson(row) {
    return {
        id: row.id,
        workspaceId: row.workspaceId,
        projectId: row.projectId,
        fileId: row.fileId,
        fileVersionId: row.fileVersionId,
        fileVersion: row.fileVersion.version,
        fileName: row.file.name,
        materialId: row.materialId,
        label: row.label,
        quantity: row.quantity.toString(),
        unit: row.unit,
        notes: row.notes,
        sourceType: row.sourceType,
        sourceFileVersionAtCreate: row.sourceFileVersionAtCreate,
        sourceZoneId: row.sourceZoneId,
        tags: row.tags,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        material: row.material
            ? {
                id: row.material.id,
                name: row.material.name,
                unit: row.material.unit,
                unitPrice: row.material.unitPrice != null ? row.material.unitPrice.toString() : null,
                currency: row.material.currency,
                categoryName: row.material.category.name,
                customAttributes: jsonObjectForResponse(row.material.customAttributes),
            }
            : null,
    };
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
async function loadFileVersionForTakeoff(fileVersionId) {
    return prisma.fileVersion.findUnique({
        where: { id: fileVersionId },
        include: { file: { include: { project: { include: { workspace: true } } } } },
    });
}
function parseDrawingTakeoffLinesFromViewerBlob(blob, fileId, fileVersionId, fileVersion) {
    if (!blob || typeof blob !== "object")
        return [];
    const rec = blob;
    const items = Array.isArray(rec.takeoffItems) ? rec.takeoffItems : [];
    const zones = Array.isArray(rec.takeoffZones) ? rec.takeoffZones : [];
    const itemById = new Map();
    for (const it of items) {
        if (!it || typeof it !== "object")
            continue;
        const r = it;
        if (typeof r.id === "string")
            itemById.set(r.id, r);
    }
    const out = [];
    for (const z of zones) {
        if (!z || typeof z !== "object")
            continue;
        const zr = z;
        if (typeof zr.id !== "string" || typeof zr.itemId !== "string")
            continue;
        const item = itemById.get(zr.itemId);
        const qty = typeof zr.computedQuantity === "number" ? zr.computedQuantity : Number(zr.computedQuantity);
        if (!Number.isFinite(qty))
            continue;
        const tags = Array.isArray(zr.tags)
            ? zr.tags
                .filter((t) => typeof t === "string")
                .map((t) => t.trim())
                .filter(Boolean)
            : [];
        const label = item && typeof item.name === "string" ? item.name : "Takeoff item";
        const unit = item && typeof item.unit === "string" ? item.unit : "ea";
        const notes = (typeof zr.notes === "string" && zr.notes.trim()) ||
            (item && typeof item.notes === "string" && item.notes.trim()) ||
            null;
        out.push({
            fileId,
            fileVersionId,
            fileVersion,
            sourceZoneId: zr.id,
            label,
            quantity: qty,
            unit,
            notes,
            tags,
        });
    }
    return out;
}
async function buildProjectDrawingSyncSource(projectId) {
    const versions = await prisma.fileVersion.findMany({
        where: { file: { projectId } },
        select: {
            id: true,
            version: true,
            annotationBlob: true,
            fileId: true,
            createdAt: true,
        },
        orderBy: [{ fileId: "asc" }, { version: "desc" }, { createdAt: "desc" }],
    });
    const latestByFile = new Map();
    for (const fv of versions) {
        if (!latestByFile.has(fv.fileId))
            latestByFile.set(fv.fileId, fv);
    }
    const lines = [];
    const sourceFileVersionIds = [];
    for (const fv of latestByFile.values()) {
        sourceFileVersionIds.push(fv.id);
        lines.push(...parseDrawingTakeoffLinesFromViewerBlob(fv.annotationBlob, fv.fileId, fv.id, fv.version));
    }
    return { lines, sourceFileVersionIds };
}
export function registerTakeoffRoutes(r, needUser) {
    r.get("/file-versions/:fileVersionId/takeoff-lines", needUser, async (c) => {
        const fileVersionId = c.req.param("fileVersionId");
        const fv = await loadFileVersionForTakeoff(fileVersionId);
        if (!fv)
            return c.json({ error: "Not found" }, 404);
        const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.takeoffLine.findMany({
            where: { fileVersionId },
            include: takeoffInclude,
            orderBy: { createdAt: "desc" },
        });
        return c.json(rows.map(takeoffRowJson));
    });
    r.get("/projects/:projectId/takeoff-lines", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.takeoffLine.findMany({
            where: { projectId },
            include: takeoffInclude,
            orderBy: [{ fileId: "asc" }, { createdAt: "desc" }],
        });
        const versions = await prisma.fileVersion.findMany({
            where: { file: { projectId } },
            select: { fileId: true, version: true, createdAt: true },
            orderBy: [{ fileId: "asc" }, { version: "desc" }, { createdAt: "desc" }],
        });
        const latestByFile = new Map();
        for (const fv of versions) {
            if (!latestByFile.has(fv.fileId))
                latestByFile.set(fv.fileId, fv.version);
        }
        return c.json(rows.map((row) => {
            const base = takeoffRowJson(row);
            const latest = latestByFile.get(row.fileId);
            const mismatch = row.sourceFileVersionAtCreate != null &&
                latest != null &&
                row.sourceFileVersionAtCreate !== latest;
            return {
                ...base,
                revisionMismatch: mismatch,
                latestFileVersion: latest ?? row.fileVersion.version,
            };
        }));
    });
    r.post("/projects/:projectId/takeoff/sync/preview", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const current = await prisma.takeoffLine.findMany({ where: { projectId } });
        const { lines, sourceFileVersionIds } = await buildProjectDrawingSyncSource(projectId);
        const byZone = new Map(lines.map((l) => [l.sourceZoneId, l]));
        const currentZoneRows = current.filter((r) => Boolean(r.sourceZoneId));
        let added = 0;
        let updated = 0;
        let removed = 0;
        for (const line of lines) {
            const ex = currentZoneRows.find((r) => r.sourceZoneId === line.sourceZoneId);
            if (!ex) {
                added += 1;
                continue;
            }
            if (ex.label !== line.label ||
                Number(ex.quantity) !== line.quantity ||
                ex.unit !== line.unit ||
                (ex.notes ?? null) !== (line.notes ?? null)) {
                updated += 1;
            }
        }
        for (const row of currentZoneRows) {
            if (!row.sourceZoneId || byZone.has(row.sourceZoneId))
                continue;
            removed += 1;
        }
        return c.json({
            mode: "merge",
            sourceFileVersionIds,
            counts: { added, updated, removed },
            sample: {
                added: lines
                    .filter((l) => !currentZoneRows.some((r) => r.sourceZoneId === l.sourceZoneId))
                    .slice(0, 8),
                updated: lines
                    .filter((l) => currentZoneRows.some((r) => r.sourceZoneId === l.sourceZoneId))
                    .slice(0, 8),
            },
        });
    });
    r.post("/projects/:projectId/takeoff/sync/apply", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            mode: z.enum(["merge", "replace"]).default("merge"),
            protectManualEdits: z.boolean().optional(),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const before = await prisma.takeoffLine.findMany({ where: { projectId } });
        const { lines, sourceFileVersionIds } = await buildProjectDrawingSyncSource(projectId);
        const run = await prisma.takeoffSyncRun.create({
            data: {
                workspaceId: access.project.workspaceId,
                projectId,
                userId: c.get("user").id,
                mode: body.data.mode,
                sourceFileVersionIds,
            },
        });
        const snapshot = await prisma.takeoffSnapshot.create({
            data: {
                workspaceId: access.project.workspaceId,
                projectId,
                userId: c.get("user").id,
                reason: `sync:${body.data.mode}`,
                payloadJson: {
                    lines: before.map((r) => ({
                        id: r.id,
                        workspaceId: r.workspaceId,
                        projectId: r.projectId,
                        fileId: r.fileId,
                        fileVersionId: r.fileVersionId,
                        materialId: r.materialId,
                        label: r.label,
                        quantity: r.quantity.toString(),
                        unit: r.unit,
                        notes: r.notes,
                        sourceType: r.sourceType,
                        sourceFileVersionAtCreate: r.sourceFileVersionAtCreate,
                        sourceZoneId: r.sourceZoneId,
                        tags: r.tags,
                    })),
                },
            },
        });
        const byZone = new Map(lines.map((l) => [l.sourceZoneId, l]));
        const zoneRows = before.filter((r) => Boolean(r.sourceZoneId));
        let added = 0;
        let updated = 0;
        let removed = 0;
        if (body.data.mode === "replace") {
            const keepIds = body.data.protectManualEdits === false
                ? []
                : before.filter((r) => !r.sourceZoneId).map((r) => r.id);
            await prisma.takeoffLine.deleteMany({
                where: {
                    projectId,
                    ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
                },
            });
            removed = Math.max(0, before.length - keepIds.length);
            for (const line of lines) {
                await prisma.takeoffLine.create({
                    data: {
                        workspaceId: access.project.workspaceId,
                        projectId,
                        fileId: line.fileId,
                        fileVersionId: line.fileVersionId,
                        label: line.label,
                        quantity: new Prisma.Decimal(line.quantity),
                        unit: line.unit,
                        notes: line.notes,
                        sourceType: "zone",
                        sourceFileVersionAtCreate: line.fileVersion,
                        sourceZoneId: line.sourceZoneId,
                        tags: line.tags,
                    },
                });
                added += 1;
            }
        }
        else {
            for (const line of lines) {
                const ex = zoneRows.find((r) => r.sourceZoneId === line.sourceZoneId);
                if (!ex) {
                    await prisma.takeoffLine.create({
                        data: {
                            workspaceId: access.project.workspaceId,
                            projectId,
                            fileId: line.fileId,
                            fileVersionId: line.fileVersionId,
                            label: line.label,
                            quantity: new Prisma.Decimal(line.quantity),
                            unit: line.unit,
                            notes: line.notes,
                            sourceType: "zone",
                            sourceFileVersionAtCreate: line.fileVersion,
                            sourceZoneId: line.sourceZoneId,
                            tags: line.tags,
                        },
                    });
                    added += 1;
                    continue;
                }
                await prisma.takeoffLine.update({
                    where: { id: ex.id },
                    data: {
                        label: line.label,
                        quantity: new Prisma.Decimal(line.quantity),
                        unit: line.unit,
                        notes: line.notes,
                        fileId: line.fileId,
                        fileVersionId: line.fileVersionId,
                        sourceType: "zone",
                        sourceFileVersionAtCreate: line.fileVersion,
                        tags: line.tags,
                    },
                });
                updated += 1;
            }
            for (const row of zoneRows) {
                if (!row.sourceZoneId || byZone.has(row.sourceZoneId))
                    continue;
                await prisma.takeoffLine.delete({ where: { id: row.id } });
                removed += 1;
            }
        }
        await prisma.takeoffSyncRun.update({
            where: { id: run.id },
            data: {
                finishedAt: new Date(),
                addedCount: added,
                updatedCount: updated,
                removedCount: removed,
                summaryJson: { protectManualEdits: body.data.protectManualEdits ?? true },
            },
        });
        return c.json({
            ok: true,
            syncRunId: run.id,
            snapshotId: snapshot.id,
            counts: { added, updated, removed },
        });
    });
    r.get("/projects/:projectId/takeoff/sync-history", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.takeoffSyncRun.findMany({
            where: { projectId },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        return c.json(rows.map((r0) => ({
            id: r0.id,
            mode: r0.mode,
            addedCount: r0.addedCount,
            updatedCount: r0.updatedCount,
            removedCount: r0.removedCount,
            startedAt: r0.startedAt.toISOString(),
            finishedAt: r0.finishedAt?.toISOString() ?? null,
            createdAt: r0.createdAt.toISOString(),
            actor: r0.user,
        })));
    });
    r.get("/projects/:projectId/takeoff/snapshots", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const rows = await prisma.takeoffSnapshot.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
            take: 30,
        });
        return c.json(rows.map((s) => ({
            id: s.id,
            reason: s.reason,
            createdAt: s.createdAt.toISOString(),
        })));
    });
    r.get("/projects/:projectId/takeoff/views", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const rows = await prisma.takeoffViewPreset.findMany({
            where: { projectId, userId: c.get("user").id },
            orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        });
        return c.json(rows);
    });
    r.post("/projects/:projectId/takeoff/views", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const body = z
            .object({
            name: z.string().min(1).max(80),
            isDefault: z.boolean().optional(),
            configJson: z.record(z.string(), z.unknown()),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        if (body.data.isDefault) {
            await prisma.takeoffViewPreset.updateMany({
                where: { projectId, userId: c.get("user").id, isDefault: true },
                data: { isDefault: false },
            });
        }
        const row = await prisma.takeoffViewPreset.create({
            data: {
                workspaceId: access.project.workspaceId,
                projectId,
                userId: c.get("user").id,
                name: body.data.name.trim(),
                isDefault: body.data.isDefault ?? false,
                configJson: body.data.configJson,
            },
        });
        return c.json(row);
    });
    r.patch("/projects/:projectId/takeoff/views/:viewId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const viewId = c.req.param("viewId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const body = z
            .object({
            name: z.string().min(1).max(80).optional(),
            isDefault: z.boolean().optional(),
            configJson: z.record(z.string(), z.unknown()).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        if (body.data.isDefault === true) {
            await prisma.takeoffViewPreset.updateMany({
                where: { projectId, userId: c.get("user").id, isDefault: true },
                data: { isDefault: false },
            });
        }
        const row = await prisma.takeoffViewPreset.update({
            where: { id: viewId },
            data: {
                ...(body.data.name !== undefined ? { name: body.data.name.trim() } : {}),
                ...(body.data.isDefault !== undefined ? { isDefault: body.data.isDefault } : {}),
                ...(body.data.configJson !== undefined
                    ? { configJson: body.data.configJson }
                    : {}),
            },
        });
        return c.json(row);
    });
    r.delete("/projects/:projectId/takeoff/views/:viewId", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const viewId = c.req.param("viewId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const d = await prisma.takeoffViewPreset.deleteMany({
            where: { id: viewId, projectId, userId: c.get("user").id },
        });
        if (d.count === 0)
            return c.json({ error: "View not found" }, 404);
        return c.json({ ok: true, affected: d.count });
    });
    r.post("/projects/:projectId/takeoff/snapshots/:snapshotId/restore", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const snapshotId = c.req.param("snapshotId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const snap = await prisma.takeoffSnapshot.findFirst({
            where: { id: snapshotId, projectId },
        });
        if (!snap)
            return c.json({ error: "Snapshot not found" }, 404);
        const payload = snap.payloadJson;
        const lines = Array.isArray(payload?.lines) ? payload.lines : [];
        await prisma.takeoffLine.deleteMany({ where: { projectId } });
        for (const row of lines) {
            const qty = Number(row.quantity);
            if (!Number.isFinite(qty))
                continue;
            await prisma.takeoffLine.create({
                data: {
                    workspaceId: access.project.workspaceId,
                    projectId,
                    fileId: String(row.fileId ?? ""),
                    fileVersionId: String(row.fileVersionId ?? ""),
                    materialId: row.materialId ? String(row.materialId) : null,
                    label: String(row.label ?? ""),
                    quantity: new Prisma.Decimal(qty),
                    unit: String(row.unit ?? "ea"),
                    notes: row.notes == null ? null : String(row.notes),
                    sourceType: String(row.sourceType ?? "zone"),
                    sourceFileVersionAtCreate: row.sourceFileVersionAtCreate == null ? null : Number(row.sourceFileVersionAtCreate),
                    sourceZoneId: row.sourceZoneId == null ? null : String(row.sourceZoneId),
                    tags: Array.isArray(row.tags)
                        ? row.tags.filter((t) => typeof t === "string")
                        : [],
                },
            });
        }
        return c.json({ ok: true, restored: lines.length });
    });
    r.post("/projects/:projectId/takeoff/bulk", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const body = z
            .object({
            ids: z.array(z.string()).min(1).max(500),
            action: z.enum(["delete", "set_tags", "set_rate_placeholder"]),
            tags: z.array(z.string()).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const ids = body.data.ids;
        if (body.data.action === "delete") {
            const rows = await prisma.takeoffLine.findMany({ where: { projectId, id: { in: ids } } });
            await prisma.takeoffSnapshot.create({
                data: {
                    workspaceId: access.project.workspaceId,
                    projectId,
                    userId: c.get("user").id,
                    reason: "bulk:delete",
                    payloadJson: {
                        lines: rows.map((r0) => ({
                            id: r0.id,
                            workspaceId: r0.workspaceId,
                            projectId: r0.projectId,
                            fileId: r0.fileId,
                            fileVersionId: r0.fileVersionId,
                            materialId: r0.materialId,
                            label: r0.label,
                            quantity: r0.quantity.toString(),
                            unit: r0.unit,
                            notes: r0.notes,
                            sourceType: r0.sourceType,
                            sourceFileVersionAtCreate: r0.sourceFileVersionAtCreate,
                            sourceZoneId: r0.sourceZoneId,
                            tags: r0.tags,
                        })),
                    },
                },
            });
            const d = await prisma.takeoffLine.deleteMany({ where: { projectId, id: { in: ids } } });
            return c.json({ ok: true, affected: d.count });
        }
        if (body.data.action === "set_tags") {
            const tags = body.data.tags?.map((t) => t.trim()).filter(Boolean) ?? [];
            const d = await prisma.takeoffLine.updateMany({
                where: { projectId, id: { in: ids } },
                data: { tags },
            });
            return c.json({ ok: true, affected: d.count });
        }
        return c.json({ ok: true, affected: 0 });
    });
    /** Catalog line: attach a workspace material to project takeoff (uses latest file revision in project as anchor). */
    r.post("/projects/:projectId/takeoff-lines", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const body = z
            .object({
            materialId: z.string(),
            quantity: z.union([z.number(), z.string()]).optional(),
            label: z.string().optional(),
            unit: z.string().optional(),
            notes: z.string().optional(),
            tags: z.array(z.string()).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const wsId = access.project.workspaceId;
        const mat = await prisma.material.findFirst({
            where: { id: body.data.materialId, workspaceId: wsId },
            include: { category: { select: { name: true } } },
        });
        if (!mat)
            return c.json({ error: "Material not found" }, 400);
        const fv = await prisma.fileVersion.findFirst({
            where: { file: { projectId } },
            orderBy: { createdAt: "desc" },
            select: { id: true, fileId: true },
        });
        if (!fv) {
            return c.json({
                error: "Add at least one drawing or file to this project before adding catalog lines to takeoff.",
            }, 400);
        }
        if (await fileVersionWriteBlocked(fv.id, c.get("user").id)) {
            return c.json({
                error: "The latest sheet revision is locked by another user. Try again in a moment or upload a new revision.",
            }, 409);
        }
        const qtyRaw = body.data.quantity !== undefined
            ? typeof body.data.quantity === "number"
                ? body.data.quantity
                : Number(body.data.quantity)
            : 1;
        if (!Number.isFinite(qtyRaw))
            return c.json({ error: "Invalid quantity" }, 400);
        const tags = body.data.tags?.map((t) => t.trim()).filter(Boolean) ?? [];
        const defaultCatalogLabel = `Catalog · ${mat.category.name} — ${mat.name}`;
        const row = await prisma.takeoffLine.create({
            data: {
                workspaceId: wsId,
                projectId,
                fileId: fv.fileId,
                fileVersionId: fv.id,
                materialId: mat.id,
                label: body.data.label?.trim() || defaultCatalogLabel,
                quantity: new Prisma.Decimal(qtyRaw),
                unit: body.data.unit?.trim() || mat.unit || "ea",
                notes: body.data.notes?.trim() || null,
                sourceType: "manual",
                sourceFileVersionAtCreate: null,
                sourceZoneId: null,
                tags,
            },
            include: takeoffInclude,
        });
        return c.json(takeoffRowJson(row));
    });
    r.post("/file-versions/:fileVersionId/takeoff-lines", needUser, async (c) => {
        const fileVersionId = c.req.param("fileVersionId");
        const body = z
            .object({
            materialId: z.string().optional(),
            label: z.string().optional(),
            quantity: z.union([z.number(), z.string()]),
            unit: z.string().optional(),
            notes: z.string().optional(),
            sourceZoneId: z.string().optional(),
            tags: z.array(z.string()).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const fv = await loadFileVersionForTakeoff(fileVersionId);
        if (!fv)
            return c.json({ error: "Not found" }, 404);
        const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        if (await fileVersionWriteBlocked(fv.id, c.get("user").id)) {
            return c.json({ error: "File is locked by another user" }, 409);
        }
        const wsId = access.project.workspaceId;
        if (body.data.materialId) {
            const mat = await prisma.material.findFirst({
                where: { id: body.data.materialId, workspaceId: wsId },
            });
            if (!mat)
                return c.json({ error: "Material not found" }, 400);
        }
        const qty = typeof body.data.quantity === "number" ? body.data.quantity : Number(body.data.quantity);
        if (!Number.isFinite(qty))
            return c.json({ error: "Invalid quantity" }, 400);
        const tags = body.data.tags?.map((t) => t.trim()).filter(Boolean) ?? [];
        const sourceZoneId = body.data.sourceZoneId?.trim() || null;
        if (sourceZoneId) {
            const existing = await prisma.takeoffLine.findFirst({
                where: { fileVersionId: fv.id, sourceZoneId },
            });
            if (existing) {
                const row = await prisma.takeoffLine.update({
                    where: { id: existing.id },
                    data: {
                        materialId: body.data.materialId ?? existing.materialId,
                        label: body.data.label?.trim() ?? existing.label,
                        quantity: new Prisma.Decimal(qty),
                        unit: body.data.unit?.trim() || existing.unit,
                        notes: body.data.notes !== undefined ? body.data.notes?.trim() || null : existing.notes,
                        sourceType: sourceZoneId ? "zone" : "manual",
                        sourceFileVersionAtCreate: sourceZoneId
                            ? fv.version
                            : existing.sourceFileVersionAtCreate,
                        tags: tags.length > 0 ? tags : existing.tags,
                    },
                    include: takeoffInclude,
                });
                return c.json(takeoffRowJson(row));
            }
        }
        const row = await prisma.takeoffLine.create({
            data: {
                workspaceId: wsId,
                projectId: fv.file.projectId,
                fileId: fv.fileId,
                fileVersionId: fv.id,
                materialId: body.data.materialId ?? null,
                label: body.data.label?.trim() ?? "",
                quantity: new Prisma.Decimal(qty),
                unit: body.data.unit?.trim() || "ea",
                notes: body.data.notes?.trim() || null,
                sourceType: sourceZoneId ? "zone" : "manual",
                sourceFileVersionAtCreate: sourceZoneId ? fv.version : null,
                sourceZoneId,
                tags,
            },
            include: takeoffInclude,
        });
        return c.json(takeoffRowJson(row));
    });
    r.patch("/takeoff-lines/:takeoffLineId", needUser, async (c) => {
        const takeoffLineId = c.req.param("takeoffLineId");
        const existing = await prisma.takeoffLine.findUnique({
            where: { id: takeoffLineId },
            include: { file: { include: { project: { include: { workspace: true } } } } },
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const access = await loadProjectForMember(existing.projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        if (await fileVersionWriteBlocked(existing.fileVersionId, c.get("user").id)) {
            return c.json({ error: "File is locked by another user" }, 409);
        }
        const body = z
            .object({
            materialId: z.string().nullable().optional(),
            label: z.string().optional(),
            quantity: z.union([z.number(), z.string()]).optional(),
            unit: z.string().optional(),
            notes: z.string().nullable().optional(),
            tags: z.array(z.string()).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const wsId = access.project.workspaceId;
        if (body.data.materialId) {
            const mat = await prisma.material.findFirst({
                where: { id: body.data.materialId, workspaceId: wsId },
            });
            if (!mat)
                return c.json({ error: "Material not found" }, 400);
        }
        let quantityDec;
        if (body.data.quantity !== undefined) {
            const qty = typeof body.data.quantity === "number" ? body.data.quantity : Number(body.data.quantity);
            if (!Number.isFinite(qty))
                return c.json({ error: "Invalid quantity" }, 400);
            quantityDec = new Prisma.Decimal(qty);
        }
        const row = await prisma.takeoffLine.update({
            where: { id: takeoffLineId },
            data: {
                ...(body.data.materialId !== undefined ? { materialId: body.data.materialId } : {}),
                ...(body.data.label !== undefined ? { label: body.data.label.trim() } : {}),
                ...(quantityDec !== undefined ? { quantity: quantityDec } : {}),
                ...(body.data.unit !== undefined ? { unit: body.data.unit.trim() } : {}),
                ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
                ...(body.data.tags !== undefined
                    ? {
                        tags: body.data.tags.map((t) => t.trim()).filter(Boolean),
                    }
                    : {}),
            },
            include: takeoffInclude,
        });
        return c.json(takeoffRowJson(row));
    });
    r.delete("/takeoff-lines/:takeoffLineId", needUser, async (c) => {
        const takeoffLineId = c.req.param("takeoffLineId");
        const existing = await prisma.takeoffLine.findUnique({
            where: { id: takeoffLineId },
            include: { file: { include: { project: { include: { workspace: true } } } } },
        });
        if (!existing)
            return c.json({ error: "Not found" }, 404);
        const access = await loadProjectForMember(existing.projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        if (await fileVersionWriteBlocked(existing.fileVersionId, c.get("user").id)) {
            return c.json({ error: "File is locked by another user" }, 409);
        }
        await prisma.takeoffLine.delete({ where: { id: takeoffLineId } });
        return c.json({ ok: true });
    });
}
