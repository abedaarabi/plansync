import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { loadProjectForMember } from "../../lib/projectAccess.js";
import { getObjectStream } from "../../lib/s3.js";
import { toQuantityIndexSummary } from "../../lib/bim/quantityIndexBuilder.js";
import { enqueueBimConversion, processBimConversion, storeFragmentsBuffer, } from "../../lib/bim/conversionProcessor.js";
import { clearCoordTransform, getDrawingLevelMaps, getDrawingSheets, getPublishedModelLevels, getPublishStatusCounts, getStoreysForFileVersion, getSyncContext, publishModel, saveCoordTransform, suggestMappingsForVersion, updateDrawingMaps, } from "../../lib/bim/bimPublish.js";
import { drawingCoordTransformPutSchema } from "../../lib/bim/coordTransformSchema.js";
import { authorizeBimFileVersion, loadBimFileVersion, readBimQuantityIndex, requireBimPro, } from "./bimRouteHelpers.js";
function rollupQuantities(entries) {
    let length = 0;
    let area = 0;
    let volume = 0;
    let count = entries.length;
    let hasLength = false;
    let hasArea = false;
    let hasVolume = false;
    for (const e of entries) {
        if (e.quantities.length != null) {
            length += e.quantities.length;
            hasLength = true;
        }
        if (e.quantities.area != null) {
            area += e.quantities.area;
            hasArea = true;
        }
        if (e.quantities.volume != null) {
            volume += e.quantities.volume;
            hasVolume = true;
        }
        if (e.quantities.count != null)
            count = Math.max(count, e.quantities.count);
    }
    return {
        count,
        length: hasLength ? length : null,
        area: hasArea ? area : null,
        volume: hasVolume ? volume : null,
    };
}
function cleanIfcTypeLabel(ifcType) {
    return ifcType.replace(/^Ifc/i, "").replace(/^IFC/i, "");
}
function takeoffQuantityFromRollup(rollup) {
    if (rollup.volume != null && Number.isFinite(rollup.volume)) {
        return { quantity: new Prisma.Decimal(rollup.volume), unit: "m³" };
    }
    if (rollup.area != null && Number.isFinite(rollup.area)) {
        return { quantity: new Prisma.Decimal(rollup.area), unit: "m²" };
    }
    const count = Number.isFinite(rollup.count) ? rollup.count : 0;
    return { quantity: new Prisma.Decimal(Math.max(count, 0)), unit: "ea" };
}
export function registerBimRoutes(r, needUser, env) {
    // fallow-ignore-next-line complexity, code-duplication
    r.get("/file-versions/:fileVersionId/bim/status", needUser, async (c) => {
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
            requirePro: true,
        });
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const [statusCounts, jobRun] = await Promise.all([
            getPublishStatusCounts(fv.id),
            fv.bimConversionJobRunId
                ? prisma.jobRun.findUnique({
                    where: { id: fv.bimConversionJobRunId },
                    select: { resultJson: true },
                })
                : Promise.resolve(null),
        ]);
        const resultJson = jobRun?.resultJson;
        const conversionStatus = fv.bimConversionStatus;
        const quantityIndexReady = conversionStatus === "ready";
        const quantityIndexSummaryReady = Boolean(fv.quantityIndexS3Key) &&
            (conversionStatus === "summary_ready" || !quantityIndexReady);
        return c.json({
            fileVersionId: fv.id,
            conversionStatus,
            fragmentsReady: Boolean(fv.fragmentsS3Key),
            quantityIndexSummaryReady,
            quantityIndexReady,
            partial: quantityIndexSummaryReady,
            indexProgress: typeof resultJson?.progress === "number" ? resultJson.progress : null,
            indexPhase: resultJson?.phase === "summary" || resultJson?.phase === "full" ? resultJson.phase : null,
            loq: fv.bimLoqReport,
            jobRunId: fv.bimConversionJobRunId,
            bimPublishedAt: statusCounts.bimPublishedAt,
            levelCount: statusCounts.levelCount,
            mappedSheetCount: statusCounts.mappedSheetCount,
        });
    });
    // fallow-ignore-next-line code-duplication
    r.get("/file-versions/:fileVersionId/bim/publish-summary", needUser, async (c) => {
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
            requirePro: true,
        });
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const counts = await getPublishStatusCounts(fv.id);
        const alignedMapCount = await prisma.drawingLevelMap.count({
            where: { ifcFileVersionId: fv.id, coordTransformJson: { not: Prisma.DbNull } },
        });
        return c.json({
            fileVersionId: fv.id,
            published: Boolean(counts.bimPublishedAt),
            publishedAt: counts.bimPublishedAt,
            levelCount: counts.levelCount,
            mapCount: counts.mappedSheetCount,
            alignedMapCount,
        });
    });
    r.post("/file-versions/:fileVersionId/bim/convert", needUser, async (c) => {
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
            requirePro: true,
        });
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const jobId = await enqueueBimConversion(env, fv.id, c.get("user").id);
        return c.json({ jobRunId: jobId, status: "queued" });
    });
    r.get("/file-versions/:fileVersionId/bim/fragments", needUser, async (c) => {
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        if (!fv.fragmentsS3Key)
            return c.json({ error: "Fragments not ready" }, 404);
        const obj = await getObjectStream(env, fv.fragmentsS3Key);
        if (!obj.ok)
            return c.json({ error: obj.error }, obj.error === "S3 not configured" ? 503 : 502);
        return new Response(obj.stream, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Cache-Control": "private, max-age=3600",
                ...(obj.contentLength != null ? { "Content-Length": String(obj.contentLength) } : {}),
            },
        });
    });
    r.put("/file-versions/:fileVersionId/bim/fragments", needUser, async (c) => {
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const buf = Buffer.from(await c.req.arrayBuffer());
        const key = await storeFragmentsBuffer(env, fv.id, buf);
        return c.json({ fragmentsS3Key: key });
    });
    // fallow-ignore-next-line code-duplication
    r.get("/file-versions/:fileVersionId/bim/quantity-index/summary", needUser, async (c) => {
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const index = await readBimQuantityIndex(env, fv);
        if (!index)
            return c.json({ error: "Quantity index not ready" }, 404);
        return c.json(toQuantityIndexSummary(index));
    });
    r.get("/file-versions/:fileVersionId/bim/quantity-index", needUser, async (c) => {
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const index = await readBimQuantityIndex(env, fv);
        if (!index)
            return c.json({ error: "Quantity index not ready" }, 404);
        if (index.partial || index.elements.length === 0) {
            return c.json({ error: "Full quantity index not ready" }, 404);
        }
        return c.json(index);
    });
    r.get("/file-versions/:fileVersionId/bim/quantity-export.csv", needUser, async (c) => {
        // fallow-ignore-next-line code-duplication
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const index = await readBimQuantityIndex(env, fv);
        if (!index)
            return c.json({ error: "Quantity index not ready" }, 404);
        const header = "GUID,Type,Name,Level,Material,Length,Area,Volume,Count,QuantitySource,Discipline\n";
        const esc = (s) => `"${(s ?? "").replace(/"/g, '""')}"`;
        const rows = index.elements.map((e) => [
            esc(e.guid),
            esc(e.ifcType),
            esc(e.name),
            esc(e.level),
            esc(e.material),
            e.quantities.length ?? "",
            e.quantities.area ?? "",
            e.quantities.volume ?? "",
            e.quantities.count ?? 1,
            e.quantitySource,
            esc(e.discipline),
        ].join(","));
        return new Response(header + rows.join("\n"), {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="bim-quantities-${fv.version}.csv"`,
            },
        });
    });
    r.get("/file-versions/:fileVersionId/bim/quantity-compare", needUser, async (c) => {
        const otherId = c.req.query("otherFileVersionId");
        if (!otherId)
            return c.json({ error: "otherFileVersionId required" }, 400);
        const fv = await loadBimFileVersion(c.req.param("fileVersionId"));
        const other = await loadBimFileVersion(otherId);
        if (!fv || !other)
            return c.json({ error: "Not found" }, 404);
        if (fv.fileId !== other.fileId)
            return c.json({ error: "Versions must be same file" }, 400);
        const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
        if (!access)
            return c.json({ error: "Forbidden" }, 403);
        const [a, b] = await Promise.all([
            readBimQuantityIndex(env, fv),
            readBimQuantityIndex(env, other),
        ]);
        if (!a || !b)
            return c.json({ error: "Index not ready" }, 404);
        const types = new Set([...Object.keys(a.byType), ...Object.keys(b.byType)]);
        // fallow-ignore-next-line complexity
        const deltas = [...types].map((ifcType) => {
            const ta = a.byType[ifcType];
            const tb = b.byType[ifcType];
            return {
                ifcType,
                countA: ta?.count ?? 0,
                countB: tb?.count ?? 0,
                countDelta: (tb?.count ?? 0) - (ta?.count ?? 0),
                areaA: ta?.totalArea ?? null,
                areaB: tb?.totalArea ?? null,
                areaDelta: ta?.totalArea != null && tb?.totalArea != null ? tb.totalArea - ta.totalArea : null,
                volumeA: ta?.totalVolume ?? null,
                volumeB: tb?.totalVolume ?? null,
                volumeDelta: ta?.totalVolume != null && tb?.totalVolume != null
                    ? tb.totalVolume - ta.totalVolume
                    : null,
            };
        });
        return c.json({ baseVersion: fv.version, compareVersion: other.version, deltas });
    });
    // fallow-ignore-next-line complexity
    r.post("/file-versions/:fileVersionId/bim/takeoff/import", needUser, async (c) => {
        const body = z
            .object({
            guids: z.array(z.string()).min(1),
            label: z.string().optional(),
            unit: z.string().optional(),
            quantityKind: z.enum(["count", "length", "area", "volume"]).default("count"),
            materialId: z.string().optional(),
            // fallow-ignore-next-line code-duplication
            notes: z.string().optional(),
        })
            .parse(await c.req.json());
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
            requirePro: true,
        });
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const index = await readBimQuantityIndex(env, fv);
        if (!index)
            return c.json({ error: "Quantity index not ready" }, 404);
        const entries = index.elements.filter((e) => body.guids.includes(e.guid));
        if (entries.length === 0)
            return c.json({ error: "No matching elements" }, 400);
        const rollup = rollupQuantities(entries);
        let quantity = new Prisma.Decimal(rollup.count);
        let unit = body.unit ?? "ea";
        if (body.quantityKind === "length" && rollup.length != null) {
            quantity = new Prisma.Decimal(rollup.length);
            unit = body.unit ?? "m";
        }
        else if (body.quantityKind === "area" && rollup.area != null) {
            quantity = new Prisma.Decimal(rollup.area);
            unit = body.unit ?? "m²";
        }
        else if (body.quantityKind === "volume" && rollup.volume != null) {
            quantity = new Prisma.Decimal(rollup.volume);
            unit = body.unit ?? "m³";
        }
        const sortedGuids = [...body.guids].sort();
        const sourceBimKey = sortedGuids.length === 1
            ? `guid:${sortedGuids[0]}`
            : `agg:${sortedGuids.length}:${sortedGuids[0]?.slice(0, 8)}`;
        const ifcType = entries[0]?.ifcType ?? null;
        const label = body.label ??
            (entries.length === 1
                ? (entries[0]?.name ?? entries[0]?.ifcType ?? "BIM element")
                : `${entries.length}× ${ifcType ?? "elements"}`);
        const line = await prisma.takeoffLine.upsert({
            where: { fileVersionId_sourceBimKey: { fileVersionId: fv.id, sourceBimKey } },
            create: {
                workspaceId: fv.file.project.workspaceId,
                projectId: fv.file.projectId,
                fileId: fv.fileId,
                fileVersionId: fv.id,
                materialId: body.materialId ?? null,
                label,
                quantity,
                unit,
                notes: body.notes ?? null,
                sourceType: "bim",
                sourceBimKey,
                sourceIfcGuid: sortedGuids.length === 1 ? sortedGuids[0] : null,
                sourceIfcGuids: sortedGuids,
                ifcType,
                quantitySource: entries[0]?.quantitySource ?? "computed",
                sourceFileVersionAtCreate: fv.version,
                bimMetadata: { quantityKind: body.quantityKind, guids: sortedGuids },
            },
            update: {
                label,
                quantity,
                unit,
                notes: body.notes ?? null,
                materialId: body.materialId ?? undefined,
                sourceIfcGuids: sortedGuids,
                bimMetadata: { quantityKind: body.quantityKind, guids: sortedGuids },
            },
        });
        return c.json({ takeoffLineId: line.id, quantity: quantity.toString(), unit });
    });
    // fallow-ignore-next-line complexity
    r.post("/file-versions/:fileVersionId/bim/takeoff/auto-map", needUser, async (c) => {
        const body = z
            // fallow-ignore-next-line code-duplication
            .object({ ifcTypes: z.array(z.string()).optional(), createLines: z.boolean().default(true) })
            .parse(await c.req.json());
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
            requirePro: true,
        });
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const index = await readBimQuantityIndex(env, fv);
        if (!index)
            return c.json({ error: "Quantity index not ready" }, 404);
        const materials = await prisma.material.findMany({
            where: { workspaceId: fv.file.project.workspaceId },
            select: { id: true, name: true, unit: true },
        });
        const types = body.ifcTypes?.length ? body.ifcTypes : Object.keys(index.byType);
        const mapped = [];
        const created = [];
        for (const ifcType of types) {
            const agg = index.byType[ifcType];
            if (!agg)
                continue;
            const clean = ifcType.replace(/^Ifc/i, "");
            const mat = materials.find((m) => m.name.toLowerCase().includes(clean.toLowerCase())) ??
                materials.find((m) => clean.toLowerCase().includes(m.name.toLowerCase().slice(0, 4))) ??
                null;
            mapped.push({ ifcType, materialId: mat?.id ?? null, materialName: mat?.name ?? null });
            if (body.createLines && agg.guids.length > 0) {
                const entries = index.elements.filter((e) => e.ifcType === ifcType);
                const rollup = rollupQuantities(entries);
                const unit = rollup.volume != null ? "m³" : rollup.area != null ? "m²" : "ea";
                const quantity = rollup.volume ?? rollup.area ?? rollup.count;
                const sourceBimKey = `type:${ifcType}`;
                const line = await prisma.takeoffLine.upsert({
                    where: { fileVersionId_sourceBimKey: { fileVersionId: fv.id, sourceBimKey } },
                    create: {
                        workspaceId: fv.file.project.workspaceId,
                        projectId: fv.file.projectId,
                        fileId: fv.fileId,
                        fileVersionId: fv.id,
                        materialId: mat?.id ?? null,
                        label: clean,
                        quantity,
                        unit,
                        sourceType: "bim",
                        sourceBimKey,
                        ifcType,
                        sourceIfcGuids: agg.guids,
                        quantitySource: "computed",
                        sourceFileVersionAtCreate: fv.version,
                        bimMetadata: { autoMapped: true, ifcType },
                    },
                    update: { quantity, unit, materialId: mat?.id ?? undefined, sourceIfcGuids: agg.guids },
                });
                created.push(line.id);
            }
        }
        return c.json({ mapped, createdLineIds: created });
    });
    r.get("/file-versions/:fileVersionId/bim/saved-views", needUser, async (c) => {
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const views = await prisma.bimSavedView.findMany({
            where: { fileVersionId: fv.id },
            orderBy: { updatedAt: "desc" },
        });
        return c.json({ views });
    });
    r.post("/file-versions/:fileVersionId/bim/saved-views", needUser, async (c) => {
        const body = z
            .object({
            name: z.string().min(1),
            cameraJson: z.record(z.unknown()),
            filtersJson: z.record(z.unknown()).optional(),
            hiddenGuids: z.array(z.string()).optional(),
            isolatedGuids: z.array(z.string()).optional(),
        })
            .parse(await c.req.json());
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const view = await prisma.bimSavedView.create({
            data: {
                projectId: fv.file.projectId,
                fileVersionId: fv.id,
                userId: c.get("user").id,
                name: body.name,
                cameraJson: body.cameraJson,
                filtersJson: (body.filtersJson ?? undefined),
                hiddenGuids: (body.hiddenGuids ?? undefined),
                isolatedGuids: (body.isolatedGuids ?? undefined),
            },
        });
        return c.json({ view });
    });
    r.delete("/bim/saved-views/:viewId", needUser, async (c) => {
        const view = await prisma.bimSavedView.findUnique({ where: { id: c.req.param("viewId") } });
        if (!view)
            return c.json({ error: "Not found" }, 404);
        const access = await loadProjectForMember(view.projectId, c.get("user").id);
        if (!access)
            return c.json({ error: "Forbidden" }, 403);
        await prisma.bimSavedView.delete({ where: { id: view.id } });
        return c.json({ ok: true });
    });
    r.post("/internal/bim-convert", async (c) => {
        const secret = c.req.header("x-plansync-cron-secret");
        if (!secret || secret !== process.env.PLANSYNC_CRON_SECRET) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        const body = z.object({ fileVersionId: z.string() }).parse(await c.req.json());
        await processBimConversion(env, body.fileVersionId);
        return c.json({ ok: true });
    });
    r.get("/file-versions/:fileVersionId/bim/storeys", needUser, async (c) => {
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
            requirePro: true,
        });
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        try {
            const storeys = await getStoreysForFileVersion(env, fv.id);
            return c.json({ storeys });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to extract storeys";
            return c.json({ error: msg }, 400);
        }
    });
    r.post("/file-versions/:fileVersionId/bim/publish", needUser, async (c) => {
        const body = z
            .object({
            levels: z
                .array(z.object({
                sourceName: z.string().min(1),
                displayName: z.string().min(1),
                elevationMeters: z.number().nullable().optional(),
                sortOrder: z.number().int(),
            }))
                .min(1),
            maps: z
                .array(z.object({
                bimModelLevelId: z.string().optional(),
                sourceName: z.string().optional(),
                pdfFileId: z.string(),
                pdfFileVersionId: z.string().nullable().optional(),
                // fallow-ignore-next-line code-duplication
                pageIndex: z.number().int().min(0),
            }))
                // fallow-ignore-next-line code-duplication
                .optional(),
        })
            .parse(await c.req.json());
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
            requirePro: true,
        });
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        try {
            const result = await publishModel(env, fv.id, c.get("user").id, body);
            return c.json(result);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Publish failed";
            return c.json({ error: msg }, 400);
        }
    });
    r.put("/file-versions/:fileVersionId/bim/drawing-maps", needUser, async (c) => {
        const body = z
            .object({
            maps: z.array(z.object({
                bimModelLevelId: z.string().optional(),
                sourceName: z.string().optional(),
                pdfFileId: z.string(),
                pdfFileVersionId: z.string().nullable().optional(),
                pageIndex: z.number().int().min(0),
            })),
        })
            .parse(await c.req.json());
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
            requirePro: true,
        });
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        try {
            const result = await updateDrawingMaps(fv.id, c.get("user").id, body.maps);
            return c.json(result);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Update failed";
            return c.json({ error: msg }, 400);
        }
    });
    r.get("/projects/:projectId/drawing-level-maps", needUser, async (c) => {
        const ifcFileVersionId = c.req.query("ifcFileVersionId");
        if (!ifcFileVersionId)
            return c.json({ error: "ifcFileVersionId required" }, 400);
        const fv = await loadBimFileVersion(ifcFileVersionId);
        if (!fv)
            return c.json({ error: "Not found" }, 404);
        if (fv.file.projectId !== c.req.param("projectId")) {
            return c.json({ error: "Not found" }, 404);
        }
        const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
        if (!access)
            return c.json({ error: "Forbidden" }, 403);
        const pro = requireBimPro(fv.file.project.workspace);
        if (pro)
            return c.json({ error: pro.error }, pro.status);
        const [maps, levels] = await Promise.all([
            getDrawingLevelMaps(fv.file.projectId, ifcFileVersionId),
            getPublishedModelLevels(ifcFileVersionId),
        ]);
        return c.json({ maps, levels });
    });
    // fallow-ignore-next-line code-duplication
    r.get("/projects/:projectId/drawing-sheets", needUser, async (c) => {
        const projectId = c.req.param("projectId");
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        const pro = requireBimPro(access.project.workspace);
        if (pro)
            return c.json({ error: pro.error }, pro.status);
        const discipline = c.req.query("discipline") ?? undefined;
        const folderId = c.req.query("folderId") ?? undefined;
        try {
            const sheets = await getDrawingSheets(env, projectId, c.get("user").id, {
                discipline,
                folderId,
            });
            return c.json({
                sheets: sheets.map((s) => ({
                    fileId: s.pdfFileId,
                    name: s.fileName,
                    folderId: s.folderId,
                    folderPath: s.folderPath,
                    disciplines: s.disciplines,
                    pageCount: s.pageCount,
                    latestFileVersionId: s.latestFileVersionId,
                })),
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to list sheets";
            const status = msg === "Forbidden" ? 403 : 400;
            return c.json({ error: msg }, status);
        }
    });
    r.post("/file-versions/:fileVersionId/bim/suggest-mappings", needUser, async (c) => {
        const body = z
            .object({
            pdfCandidates: z.array(z.object({
                pdfFileId: z.string(),
                fileName: z.string(),
                pageIndex: z.number().int().min(0),
                pageCount: z.number().int().min(1),
                summaryMarkdown: z.string().nullable().optional(),
            })),
            levels: z
                .array(z.object({
                sourceName: z.string().min(1),
                displayName: z.string().min(1),
                elevationMeters: z.number().nullable().optional(),
                sortOrder: z.number().int(),
            }))
                .optional(),
        })
            .parse(await c.req.json());
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
            requirePro: true,
        });
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        const suggestions = await suggestMappingsForVersion(env, fv.id, body.pdfCandidates, body.levels);
        return c.json({ suggestions });
    });
    r.put("/drawing-level-maps/:mapId/coord-transform", needUser, async (c) => {
        const body = drawingCoordTransformPutSchema.parse(await c.req.json());
        // fallow-ignore-next-line code-duplication
        const map = await prisma.drawingLevelMap.findUnique({ where: { id: c.req.param("mapId") } });
        if (!map)
            return c.json({ error: "Not found" }, 404);
        const access = await loadProjectForMember(map.projectId, c.get("user").id);
        if (!access)
            return c.json({ error: "Forbidden" }, 403);
        const fv = await loadBimFileVersion(map.ifcFileVersionId);
        if (!fv)
            return c.json({ error: "Not found" }, 404);
        const pro = requireBimPro(fv.file.project.workspace);
        if (pro)
            return c.json({ error: pro.error }, pro.status);
        const transform = body.controlPoints
            ? { ...body.transform, controlPoints: body.controlPoints }
            : body.transform;
        try {
            const result = await saveCoordTransform(map.id, c.get("user").id, transform);
            return c.json(result);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Save failed";
            return c.json({ error: msg }, 400);
        }
    });
    r.delete("/drawing-level-maps/:mapId/coord-transform", needUser, async (c) => {
        const map = await prisma.drawingLevelMap.findUnique({ where: { id: c.req.param("mapId") } });
        if (!map)
            return c.json({ error: "Not found" }, 404);
        const access = await loadProjectForMember(map.projectId, c.get("user").id);
        if (!access)
            return c.json({ error: "Forbidden" }, 403);
        const fv = await loadBimFileVersion(map.ifcFileVersionId);
        if (!fv)
            return c.json({ error: "Not found" }, 404);
        const pro = requireBimPro(fv.file.project.workspace);
        if (pro)
            return c.json({ error: pro.error }, pro.status);
        await clearCoordTransform(map.id);
        return c.json({ ok: true });
    });
    r.get("/file-versions/:fileVersionId/bim/sync-context", needUser, async (c) => {
        const levelId = c.req.query("levelId");
        if (!levelId)
            return c.json({ error: "levelId required" }, 400);
        const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
            requirePro: true,
        });
        if ("response" in auth)
            return auth.response;
        const { fv } = auth;
        try {
            const context = await getSyncContext(env, fv.id, levelId);
            return c.json(context);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Sync context unavailable";
            return c.json({ error: msg }, 404);
        }
    });
}
