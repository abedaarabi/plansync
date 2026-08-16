import { z } from "zod";
import { AssetType, BimClashStatus, BuildingDiscipline, BuildingType, ProcessingStatus, } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { loadProjectWithAuth, canUploadDrawings, canManageFiles } from "../../lib/permissions.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { buildBuildingImageKey, buildUploadObjectKey, newUploadId, s3KeyMatchesBuildingImage, s3KeyMatchesFileUpload, } from "../../lib/fileUpload.js";
import { imageUploadCompleteBodySchema, imageUploadPresignBodySchema, validateImageUploadBytes, } from "../../lib/issueReferencePhotos.js";
import { deleteObject, presignPut, presignGet } from "../../lib/s3.js";
import { resolvedMimeType } from "../../lib/mime.js";
import { fileVersionJson } from "../../lib/json.js";
import { enqueueBimConversion, recoverStuckBimConversions, } from "../../lib/bim/conversionProcessor.js";
import { loadBuildingForUser, loadLevelForUser, loadLocationForUser, buildingFolderKey, } from "../../lib/locations/locationsAccess.js";
import { enqueuePdfAssetProcessing } from "../../lib/locations/pdfAssetProcessor.js";
import { ensureBuildingLevelsSynced } from "../../lib/locations/buildingLevelsFromIfc.js";
import { assignDrawingToLevel, createLevelMapping, deleteLevelMapping, updateLevelMapping, } from "../../lib/locations/mappingService.js";
import { levelPlanThumbnailKey } from "../../lib/bim/s3Keys.js";
import { resolveFileVersionProcessingStatus } from "../../lib/locations/processingStatus.js";
import { deleteFileFromS3AndDb } from "../../lib/deleteProjectAssets.js";
import { deriveBuildingPublishStatus, markBuildingMappingsDirty, markBuildingMappingsDirtyByLevelId, markBuildingMappingsDirtyByMappingId, } from "../../lib/locations/buildingPublish.js";
import { buildingMetaJson, locationJson, normalizeBuildingInput, normalizeLocationInput, } from "../../lib/locations/locationDto.js";
import { cascadeDeleteBuilding, cascadeDeleteLocation } from "../../lib/locations/cascadeDelete.js";
function requirePro(workspace) {
    if (!isWorkspacePro(workspace)) {
        return { error: "Pro subscription required", status: 402 };
    }
    return null;
}
const disciplineSchema = z.nativeEnum(BuildingDiscipline).nullish();
const assetTypeSchema = z.nativeEnum(AssetType);
const optionalText = z.string().max(500).nullish();
const locationBodySchema = z
    .object({
    name: z.string().min(1).max(200),
    code: z.string().max(64).nullish(),
    address: z.string().max(300).nullish(),
    city: z.string().max(120).nullish(),
    country: z.string().max(120).nullish(),
    latitude: z.number().gte(-90).lte(90).nullable().optional(),
    longitude: z.number().gte(-180).lte(180).nullable().optional(),
    notes: optionalText,
})
    .superRefine((val, ctx) => {
    const hasLat = val.latitude !== undefined;
    const hasLng = val.longitude !== undefined;
    if (hasLat !== hasLng) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "latitude and longitude must be set together",
            path: ["latitude"],
        });
        return;
    }
    if (val.latitude === null && val.longitude != null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "latitude and longitude must both be set or both cleared",
            path: ["longitude"],
        });
    }
    if (val.longitude === null && val.latitude != null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "latitude and longitude must both be set or both cleared",
            path: ["latitude"],
        });
    }
});
const buildingBodySchema = z.object({
    name: z.string().min(1).max(200),
    code: z.string().max(64).nullish(),
    buildingType: z.nativeEnum(BuildingType).nullish(),
    floorsApprox: z.number().int().min(0).max(300).nullish(),
    notes: optionalText,
});
const calibrationSchema = z.object({
    pointPairs: z.tuple([
        z.object({
            pdf: z.object({ x: z.number(), y: z.number() }),
            plan: z.object({ x: z.number(), y: z.number() }),
        }),
        z.object({
            pdf: z.object({ x: z.number(), y: z.number() }),
            plan: z.object({ x: z.number(), y: z.number() }),
        }),
    ]),
    pageIndex: z.number().int().min(0).optional(),
    pageWidth: z.number().optional(),
    pageHeight: z.number().optional(),
});
const WEAK_PAIR_DIST = 0.12;
function mappingHealthFromMaps(maps) {
    if (!maps?.length)
        return "none";
    for (const map of maps) {
        const cal = map.calibrationJson;
        const pairs = cal?.pointPairs;
        if (!pairs || pairs.length < 2)
            continue;
        const [a, b] = pairs;
        const dPdf = Math.hypot(a.pdf.x - b.pdf.x, a.pdf.y - b.pdf.y);
        const dPlan = Math.hypot(a.plan.x - b.plan.x, a.plan.y - b.plan.y);
        if (dPdf < WEAK_PAIR_DIST || dPlan < WEAK_PAIR_DIST)
            return "weak";
    }
    return "ok";
}
function levelJson(level) {
    return {
        id: level.id,
        name: level.displayName,
        sourceName: level.sourceName,
        elevation: level.elevationMeters,
        order: level.sortOrder,
        elementCount: level.elementCount,
        thumbnailUrl: level.thumbnailS3Key,
        sourceIfcGuid: level.sourceIfcGuid,
        buildingId: level.buildingId,
        ifcFileVersionId: level.ifcFileVersionId,
        displaySource: level.displaySource ?? "IFC_CUT",
        mappedDrawingCount: level.drawingMaps?.length ?? 0,
        mappingHealth: mappingHealthFromMaps(level.drawingMaps),
    };
}
function assetJson(file, latestVersion, mappingId, mappedLevelId = null) {
    const status = latestVersion
        ? resolveFileVersionProcessingStatus({
            bimConversionStatus: latestVersion.bimConversionStatus,
            assetProcessingStatus: latestVersion.assetProcessingStatus,
            buildingAssetType: file.buildingAssetType,
        })
        : ProcessingStatus.PENDING;
    return {
        id: file.id,
        fileName: file.name,
        type: file.buildingAssetType,
        discipline: file.buildingDiscipline,
        mimeType: file.mimeType,
        status,
        errorMessage: latestVersion?.assetProcessingError ?? null,
        fileVersionId: latestVersion?.id ?? null,
        version: latestVersion?.version ?? null,
        thumbnailUrl: latestVersion?.thumbnailS3Key ?? null,
        mappingId,
        mappedLevelId,
        createdAt: file.createdAt.toISOString(),
    };
}
async function resolveBuildingIfcVersion(buildingId) {
    const ifcFile = await prisma.file.findFirst({
        where: { buildingId, buildingAssetType: AssetType.IFC },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" },
    });
    return ifcFile?.versions[0]?.id ?? null;
}
export function registerLocationsRoutes(r, needUser, env) {
    r.get("/projects/:projectId/locations", needUser, async (c) => {
        const auth = await loadProjectWithAuth(c.req.param("projectId"), c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const locations = await prisma.location.findMany({
            where: { projectId: auth.ctx.project.id },
            include: { _count: { select: { buildings: true } } },
            orderBy: { createdAt: "asc" },
        });
        return c.json({
            locations: locations.map((loc) => locationJson({ ...loc, buildingCount: loc._count.buildings })),
        });
    });
    r.post("/projects/:projectId/locations", needUser, async (c) => {
        const body = locationBodySchema.safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const auth = await loadProjectWithAuth(c.req.param("projectId"), c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        // Locations/buildings support PDF-only levels without Pro; IFC upload still gated.
        const data = normalizeLocationInput(body.data);
        const location = await prisma.location.create({
            data: { projectId: auth.ctx.project.id, ...data },
        });
        return c.json({ location: locationJson({ ...location, buildingCount: 0 }) }, 201);
    });
    // fallow-ignore-next-line complexity
    r.get("/locations/:id", needUser, async (c) => {
        const loaded = await loadLocationForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const buildings = await prisma.building.findMany({
            where: { locationId: loaded.location.id },
            include: {
                files: {
                    where: { buildingAssetType: { in: [AssetType.IFC, AssetType.PDF] } },
                    select: {
                        id: true,
                        buildingAssetType: true,
                        versions: {
                            orderBy: { version: "desc" },
                            take: 1,
                            select: {
                                id: true,
                                bimConversionStatus: true,
                                assetProcessingStatus: true,
                            },
                        },
                        drawingLevelMaps: { select: { id: true }, take: 1 },
                    },
                },
                levels: {
                    select: {
                        id: true,
                        _count: { select: { drawingMaps: true } },
                    },
                },
                _count: {
                    select: { levels: true },
                },
            },
            orderBy: { createdAt: "asc" },
        });
        const versionToBuilding = new Map();
        for (const b of buildings) {
            for (const file of b.files) {
                if (file.buildingAssetType !== AssetType.IFC)
                    continue;
                const fvId = file.versions[0]?.id;
                if (fvId)
                    versionToBuilding.set(fvId, b.id);
            }
        }
        const versionIds = [...versionToBuilding.keys()];
        const openClashByBuilding = new Map();
        if (versionIds.length > 0) {
            const openClashes = await prisma.bimClash.findMany({
                where: {
                    projectId: loaded.location.projectId,
                    status: { in: [BimClashStatus.NEW, BimClashStatus.ACTIVE] },
                    OR: [{ fileVersionAId: { in: versionIds } }, { fileVersionBId: { in: versionIds } }],
                },
                select: { id: true, fileVersionAId: true, fileVersionBId: true },
            });
            const seen = new Set();
            for (const clash of openClashes) {
                if (seen.has(clash.id))
                    continue;
                seen.add(clash.id);
                const buildingId = versionToBuilding.get(clash.fileVersionAId) ??
                    versionToBuilding.get(clash.fileVersionBId);
                if (!buildingId)
                    continue;
                openClashByBuilding.set(buildingId, (openClashByBuilding.get(buildingId) ?? 0) + 1);
            }
        }
        const buildingRows = buildings.map((b) => {
            const ifcCount = b.files.filter((f) => f.buildingAssetType === "IFC").length;
            const pdfFiles = b.files.filter((f) => f.buildingAssetType === "PDF");
            const pdfCount = pdfFiles.length;
            const unmappedPdfCount = pdfFiles.filter((f) => f.drawingLevelMaps.length === 0).length;
            const mappedLevelCount = b.levels.filter((l) => l._count.drawingMaps > 0).length;
            let ifcReady = false;
            let readyIfcCount = 0;
            let hasProcessing = false;
            let hasFailed = false;
            for (const file of b.files) {
                const fv = file.versions[0];
                if (!fv) {
                    hasProcessing = true;
                    continue;
                }
                const status = resolveFileVersionProcessingStatus({
                    bimConversionStatus: fv.bimConversionStatus,
                    assetProcessingStatus: fv.assetProcessingStatus,
                    buildingAssetType: file.buildingAssetType,
                });
                if (status === "PENDING" || status === "PROCESSING")
                    hasProcessing = true;
                if (status === "FAILED")
                    hasFailed = true;
                if (file.buildingAssetType === "IFC" && status === "READY") {
                    ifcReady = true;
                    readyIfcCount += 1;
                }
            }
            const publishStatus = deriveBuildingPublishStatus({
                ifcReady,
                levelCount: b._count.levels,
                mappingsPublishedAt: b.mappingsPublishedAt,
                mappingsDirty: b.mappingsDirty,
            });
            return {
                ...buildingMetaJson(b),
                ifcCount,
                readyIfcCount,
                pdfCount,
                unmappedPdfCount,
                levelCount: b._count.levels,
                mappedLevelCount,
                openClashCount: openClashByBuilding.get(b.id) ?? 0,
                hasProcessing,
                hasFailed,
                publishStatus,
                createdAt: b.createdAt.toISOString(),
            };
        });
        return c.json({
            location: {
                ...locationJson(loaded.location),
                projectId: loaded.location.projectId,
            },
            buildings: buildingRows,
        });
    });
    r.patch("/locations/:id", needUser, async (c) => {
        const body = locationBodySchema.safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadLocationForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const data = normalizeLocationInput(body.data);
        const location = await prisma.location.update({
            where: { id: loaded.location.id },
            data,
        });
        return c.json({ location: locationJson(location) });
    });
    r.delete("/locations/:id", needUser, async (c) => {
        const loaded = await loadLocationForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        if (!canManageFiles(loaded.ctx))
            return c.json({ error: "Forbidden" }, 403);
        await cascadeDeleteLocation(env, loaded.location.id, loaded.ctx.project.workspaceId);
        return c.json({ ok: true });
    });
    r.post("/locations/:id/buildings", needUser, async (c) => {
        const body = buildingBodySchema.safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadLocationForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const data = normalizeBuildingInput(body.data);
        const building = await prisma.building.create({
            data: { locationId: loaded.location.id, ...data },
        });
        return c.json({ building: buildingMetaJson(building) }, 201);
    });
    r.get("/buildings/:id", needUser, async (c) => {
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const { building, location } = loaded;
        const [levelCount, mappedLevelCount, pdfTotal, ifcReadyCount, unmappedPdfCount] = await Promise.all([
            prisma.bimModelLevel.count({ where: { buildingId: building.id } }),
            prisma.bimModelLevel.count({
                where: { buildingId: building.id, drawingMaps: { some: {} } },
            }),
            prisma.file.count({
                where: { buildingId: building.id, buildingAssetType: AssetType.PDF },
            }),
            prisma.fileVersion.count({
                where: {
                    file: { buildingId: building.id, buildingAssetType: AssetType.IFC },
                    bimConversionStatus: "ready",
                },
            }),
            prisma.file.count({
                where: {
                    buildingId: building.id,
                    buildingAssetType: AssetType.PDF,
                    drawingLevelMaps: { none: {} },
                },
            }),
        ]);
        const ifcReady = ifcReadyCount > 0;
        const publishStatus = deriveBuildingPublishStatus({
            ifcReady,
            levelCount,
            mappingsPublishedAt: building.mappingsPublishedAt,
            mappingsDirty: building.mappingsDirty,
        });
        return c.json({
            building: {
                ...buildingMetaJson(building),
                locationId: location.id,
                locationName: location.name,
                projectId: location.projectId,
                mappingsPublishedAt: building.mappingsPublishedAt?.toISOString() ?? null,
                mappingsDirty: building.mappingsDirty,
                publishStatus,
                checklist: {
                    ifcReady,
                    levelCount,
                    mappedLevelCount,
                    levelsWithoutDrawing: Math.max(0, levelCount - mappedLevelCount),
                    pdfCount: pdfTotal,
                    unmappedPdfCount,
                },
            },
        });
    });
    r.post("/buildings/:id/publish-mappings", needUser, async (c) => {
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const ifcReady = await prisma.fileVersion.count({
            where: {
                file: { buildingId: loaded.building.id, buildingAssetType: AssetType.IFC },
                bimConversionStatus: "ready",
            },
        });
        if (ifcReady === 0) {
            return c.json({ error: "Upload and process an IFC model before publishing." }, 400);
        }
        const levelCount = await prisma.bimModelLevel.count({
            where: { buildingId: loaded.building.id },
        });
        if (levelCount === 0) {
            return c.json({ error: "Add at least one level before publishing." }, 400);
        }
        const building = await prisma.building.update({
            where: { id: loaded.building.id },
            data: { mappingsPublishedAt: new Date(), mappingsDirty: false },
        });
        return c.json({
            building: {
                id: building.id,
                mappingsPublishedAt: building.mappingsPublishedAt?.toISOString() ?? null,
                mappingsDirty: building.mappingsDirty,
                publishStatus: "ready",
            },
        });
    });
    r.patch("/buildings/:id", needUser, async (c) => {
        const body = buildingBodySchema.safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const data = normalizeBuildingInput(body.data);
        const building = await prisma.building.update({
            where: { id: loaded.building.id },
            data,
        });
        return c.json({ building: buildingMetaJson(building) });
    });
    r.post("/buildings/:id/image/presign", needUser, async (c) => {
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        if (loaded.ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        const body = imageUploadPresignBodySchema.safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const validated = validateImageUploadBytes(body.data.contentType, body.data.sizeBytes);
        if (!validated.ok)
            return c.json({ error: validated.error }, 400);
        const ct = validated.contentType;
        const ws = loaded.ctx.project.workspace;
        const reclaim = loaded.building.imageSizeBytes ?? 0n;
        const newUsed = ws.storageUsedBytes - reclaim + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        const projectId = loaded.location.projectId;
        const key = buildBuildingImageKey(loaded.ctx.project.workspaceId, projectId, loaded.building.id, newUploadId(), body.data.fileName);
        let url;
        try {
            url = await presignPut(env, key, ct);
        }
        catch (e) {
            console.error("[building image presign]", e);
            return c.json({ error: "Could not create upload URL. Check S3 credentials and bucket configuration." }, 503);
        }
        if (!url) {
            return c.json({ error: "S3 not configured — set AWS_* and S3_BUCKET", devKey: key }, 503);
        }
        return c.json({ uploadUrl: url, key });
    });
    // fallow-ignore-next-line complexity
    r.post("/buildings/:id/image/complete", needUser, async (c) => {
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        if (loaded.ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        const body = imageUploadCompleteBodySchema.safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const validated = validateImageUploadBytes(body.data.contentType, body.data.sizeBytes);
        if (!validated.ok)
            return c.json({ error: validated.error }, 400);
        const ct = validated.contentType;
        const projectId = loaded.location.projectId;
        if (!s3KeyMatchesBuildingImage(body.data.key, loaded.ctx.project.workspaceId, projectId, loaded.building.id)) {
            return c.json({ error: "Invalid upload key" }, 400);
        }
        const ws = loaded.ctx.project.workspace;
        const reclaim = loaded.building.imageSizeBytes ?? 0n;
        const newUsed = ws.storageUsedBytes - reclaim + body.data.sizeBytes;
        if (newUsed > ws.storageQuotaBytes) {
            return c.json({ error: "Storage quota exceeded" }, 400);
        }
        if (loaded.building.imageS3Key && loaded.building.imageS3Key !== body.data.key) {
            const del = await deleteObject(env, loaded.building.imageS3Key);
            if (!del.ok && del.error !== "S3 not configured") {
                console.warn(`[building image replace] deleteObject ${loaded.building.imageS3Key}:`, del.error);
            }
        }
        const storageDelta = body.data.sizeBytes - reclaim;
        const building = await prisma.$transaction(async (tx) => {
            const updated = await tx.building.update({
                where: { id: loaded.building.id },
                data: {
                    imageS3Key: body.data.key,
                    imageMimeType: ct,
                    imageFileName: body.data.fileName,
                    imageSizeBytes: body.data.sizeBytes,
                },
            });
            if (storageDelta !== 0n) {
                await tx.workspace.update({
                    where: { id: loaded.ctx.project.workspaceId },
                    data: { storageUsedBytes: { increment: storageDelta } },
                });
            }
            return updated;
        });
        return c.json({ building: buildingMetaJson(building) });
    });
    r.get("/buildings/:id/image/presign-read", needUser, async (c) => {
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        if (!loaded.building.imageS3Key)
            return c.json({ error: "Not found" }, 404);
        let url;
        try {
            url = await presignGet(env, loaded.building.imageS3Key);
        }
        catch (e) {
            console.error("[building image presign-read]", e);
            return c.json({ error: "Could not create download link (S3)." }, 503);
        }
        if (!url)
            return c.json({ error: "S3 not configured" }, 503);
        return c.json({ url });
    });
    r.delete("/buildings/:id/image", needUser, async (c) => {
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        if (loaded.ctx.workspaceMember.isExternal)
            return c.json({ error: "Forbidden" }, 403);
        if (!loaded.building.imageS3Key)
            return c.json({ error: "Not found" }, 404);
        const del = await deleteObject(env, loaded.building.imageS3Key);
        if (!del.ok && del.error !== "S3 not configured") {
            return c.json({ error: del.error }, 503);
        }
        const dec = loaded.building.imageSizeBytes ?? 0n;
        const building = await prisma.$transaction(async (tx) => {
            const updated = await tx.building.update({
                where: { id: loaded.building.id },
                data: {
                    imageS3Key: null,
                    imageMimeType: null,
                    imageFileName: null,
                    imageSizeBytes: null,
                },
            });
            if (dec > 0n) {
                await tx.workspace.update({
                    where: { id: loaded.ctx.project.workspaceId },
                    data: { storageUsedBytes: { decrement: dec } },
                });
            }
            return updated;
        });
        return c.json({ building: buildingMetaJson(building) });
    });
    r.delete("/buildings/:id", needUser, async (c) => {
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        if (!canManageFiles(loaded.ctx))
            return c.json({ error: "Forbidden" }, 403);
        await cascadeDeleteBuilding(env, loaded.building.id, loaded.ctx.project.workspaceId);
        return c.json({ ok: true });
    });
    r.get("/buildings/:id/levels", needUser, async (c) => {
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const buildingId = loaded.building.id;
        const ifcFiles = await prisma.file.findMany({
            where: { buildingId, buildingAssetType: AssetType.IFC },
            include: { versions: { orderBy: { version: "desc" }, take: 1 } },
        });
        const ifcVersionIds = ifcFiles
            .map((f) => f.versions[0]?.id)
            .filter((id) => Boolean(id));
        if (ifcVersionIds.length > 0) {
            await prisma.bimModelLevel.updateMany({
                where: {
                    ifcFileVersionId: { in: ifcVersionIds },
                    buildingId: null,
                },
                data: { buildingId },
            });
        }
        const levelMapSelect = { id: true, calibrationJson: true };
        let levels = await prisma.bimModelLevel.findMany({
            where: { buildingId },
            include: { drawingMaps: { select: levelMapSelect } },
            orderBy: { sortOrder: "asc" },
        });
        if (levels.length === 0 && ifcVersionIds.length > 0) {
            await ensureBuildingLevelsSynced(env, buildingId);
            levels = await prisma.bimModelLevel.findMany({
                where: { buildingId },
                include: { drawingMaps: { select: levelMapSelect } },
                orderBy: { sortOrder: "asc" },
            });
        }
        return c.json({ levels: levels.map(levelJson) });
    });
    r.post("/buildings/:id/levels", needUser, async (c) => {
        const body = z
            .object({
            name: z.string().min(1).max(200),
            elevation: z.number().optional(),
            order: z.number().int().optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const maxOrder = await prisma.bimModelLevel.aggregate({
            where: { buildingId: loaded.building.id },
            _max: { sortOrder: true },
        });
        const sortOrder = body.data.order ?? (maxOrder._max.sortOrder ?? -1) + 1;
        const name = body.data.name.trim();
        const level = await prisma.bimModelLevel.create({
            data: {
                projectId: loaded.location.projectId,
                buildingId: loaded.building.id,
                ifcFileVersionId: null,
                sourceName: name,
                displayName: name,
                elevationMeters: body.data.elevation ?? null,
                sortOrder,
            },
            include: { drawingMaps: { select: { id: true, calibrationJson: true } } },
        });
        await markBuildingMappingsDirty(loaded.building.id);
        return c.json({ level: levelJson(level) }, 201);
    });
    r.patch("/levels/:id", needUser, async (c) => {
        const body = z
            .object({
            name: z.string().min(1).max(200).optional(),
            elevation: z.number().nullable().optional(),
            displaySource: z.enum(["IFC_CUT", "DRAWING"]).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadLevelForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const level = await prisma.bimModelLevel.update({
            where: { id: loaded.level.id },
            data: {
                ...(body.data.name != null ? { displayName: body.data.name.trim() } : {}),
                ...(body.data.elevation !== undefined ? { elevationMeters: body.data.elevation } : {}),
                ...(body.data.displaySource != null ? { displaySource: body.data.displaySource } : {}),
            },
            include: { drawingMaps: { select: { id: true, calibrationJson: true } } },
        });
        if (body.data.name != null || body.data.elevation !== undefined) {
            await markBuildingMappingsDirty(loaded.level.buildingId);
        }
        return c.json({ level: levelJson(level) });
    });
    r.get("/buildings/:id/assets", needUser, async (c) => {
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const typeFilter = c.req.query("type");
        const disciplineFilter = c.req.query("discipline");
        const statusFilter = c.req.query("status");
        const files = await prisma.file.findMany({
            where: {
                buildingId: loaded.building.id,
                ...(typeFilter ? { buildingAssetType: typeFilter } : {}),
                ...(disciplineFilter ? { buildingDiscipline: disciplineFilter } : {}),
            },
            include: {
                versions: { orderBy: { version: "desc" }, take: 1 },
                drawingLevelMaps: { select: { id: true, bimModelLevelId: true }, take: 1 },
            },
            orderBy: { updatedAt: "desc" },
        });
        let assets = files.map((f) => assetJson(f, f.versions[0] ?? null, f.drawingLevelMaps[0]?.id ?? null, f.drawingLevelMaps[0]?.bimModelLevelId ?? null));
        if (statusFilter) {
            assets = assets.filter((a) => a.status === statusFilter);
        }
        const unmapped = assets.filter((a) => a.type === "PDF" && !a.mappingId);
        const stuckIfcVersionIds = assets
            .filter((a) => a.type === "IFC" && (a.status === "PENDING" || a.status === "PROCESSING"))
            .map((a) => a.fileVersionId)
            .filter(Boolean);
        if (stuckIfcVersionIds.length > 0) {
            recoverStuckBimConversions(stuckIfcVersionIds);
        }
        return c.json({ assets, unmapped });
    });
    r.post("/buildings/:id/assets/presign", needUser, async (c) => {
        const body = z
            .object({
            fileName: z.string().min(1),
            contentType: z.string().default("application/octet-stream"),
            sizeBytes: z.coerce.bigint(),
            type: assetTypeSchema,
            discipline: disciplineSchema,
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        // PDF-only building setup does not require Pro; IFC still does.
        if (body.data.type === AssetType.IFC) {
            const gate = requirePro(loaded.ctx.project.workspace);
            if (gate)
                return c.json({ error: gate.error }, gate.status);
        }
        if (!canUploadDrawings(loaded.ctx))
            return c.json({ error: "Forbidden" }, 403);
        const ws = loaded.ctx.project.workspace;
        const projectId = loaded.location.projectId;
        const buildingId = loaded.building.id;
        const folderKey = buildingFolderKey(buildingId);
        const file = await prisma.file.upsert({
            where: {
                projectId_name_folderKey: {
                    projectId,
                    name: body.data.fileName,
                    folderKey,
                },
            },
            create: {
                projectId,
                folderKey,
                name: body.data.fileName,
                buildingId,
                buildingAssetType: body.data.type,
                buildingDiscipline: body.data.discipline ?? null,
                mimeType: resolvedMimeType(body.data.contentType, body.data.fileName),
            },
            update: {
                buildingId,
                buildingAssetType: body.data.type,
                buildingDiscipline: body.data.discipline ?? null,
                updatedAt: new Date(),
            },
        });
        const uploadId = newUploadId();
        const key = buildUploadObjectKey(ws.id, projectId, file.id, uploadId);
        const url = await presignPut(env, key, body.data.contentType);
        if (!url)
            return c.json({ error: "S3 not configured", devKey: key }, 503);
        return c.json({ uploadUrl: url, key, fileId: file.id, workspaceId: ws.id });
    });
    r.post("/buildings/:id/assets/complete", needUser, async (c) => {
        const body = z
            .object({
            workspaceId: z.string(),
            fileName: z.string(),
            fileId: z.string(),
            s3Key: z.string(),
            sizeBytes: z.coerce.bigint(),
            sha256: z.string().optional(),
            mimeType: z.string().optional(),
            type: assetTypeSchema,
            discipline: disciplineSchema,
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        if (body.data.type === AssetType.IFC) {
            const gate = requirePro(loaded.ctx.project.workspace);
            if (gate)
                return c.json({ error: gate.error }, gate.status);
        }
        if (!canUploadDrawings(loaded.ctx))
            return c.json({ error: "Forbidden" }, 403);
        const projectId = loaded.location.projectId;
        const buildingId = loaded.building.id;
        const folderKey = buildingFolderKey(buildingId);
        const file = await prisma.file.findFirst({
            where: { id: body.data.fileId, projectId, folderKey, name: body.data.fileName },
        });
        if (!file)
            return c.json({ error: "File not found" }, 404);
        if (!s3KeyMatchesFileUpload(body.data.s3Key, body.data.workspaceId, projectId, file.id)) {
            return c.json({ error: "Invalid upload key" }, 400);
        }
        if (file.buildingId !== buildingId) {
            await prisma.file.update({
                where: { id: file.id },
                data: { buildingId },
            });
        }
        const agg = await prisma.fileVersion.aggregate({
            where: { fileId: file.id },
            _max: { version: true },
        });
        const nextVersion = (agg._max.version ?? 0) + 1;
        const fv = await prisma.fileVersion.create({
            data: {
                fileId: file.id,
                version: nextVersion,
                s3Key: body.data.s3Key,
                sizeBytes: body.data.sizeBytes,
                sha256: body.data.sha256,
                uploadedById: c.get("user").id,
                assetProcessingStatus: ProcessingStatus.PENDING,
            },
        });
        await prisma.workspace.update({
            where: { id: body.data.workspaceId },
            data: { storageUsedBytes: { increment: body.data.sizeBytes } },
        });
        await prisma.file.update({
            where: { id: file.id },
            data: {
                mimeType: resolvedMimeType(body.data.mimeType, file.name),
                buildingAssetType: body.data.type,
                buildingDiscipline: body.data.discipline ?? file.buildingDiscipline,
            },
        });
        const userId = c.get("user").id;
        if (body.data.type === AssetType.IFC) {
            void enqueueBimConversion(env, fv.id, userId).catch(console.error);
        }
        else if (body.data.type === AssetType.PDF) {
            void enqueuePdfAssetProcessing(env, fv.id, userId);
        }
        else {
            await prisma.fileVersion.update({
                where: { id: fv.id },
                data: { assetProcessingStatus: ProcessingStatus.READY },
            });
        }
        return c.json({ file, fileVersion: fileVersionJson(fv) });
    });
    r.post("/buildings/:id/assets/link", needUser, async (c) => {
        const body = z
            .object({
            fileId: z.string(),
            type: assetTypeSchema.optional(),
            discipline: disciplineSchema,
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadBuildingForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const file = await prisma.file.findFirst({
            where: { id: body.data.fileId, projectId: loaded.location.projectId },
        });
        if (!file)
            return c.json({ error: "File not found" }, 404);
        const updated = await prisma.file.update({
            where: { id: file.id },
            data: {
                buildingId: loaded.building.id,
                buildingAssetType: body.data.type ?? file.buildingAssetType ?? AssetType.OTHER,
                buildingDiscipline: body.data.discipline ?? file.buildingDiscipline,
            },
            include: {
                versions: { orderBy: { version: "desc" }, take: 1 },
                drawingLevelMaps: { select: { id: true, bimModelLevelId: true }, take: 1 },
            },
        });
        return c.json({
            asset: assetJson(updated, updated.versions[0] ?? null, updated.drawingLevelMaps[0]?.id ?? null, updated.drawingLevelMaps[0]?.bimModelLevelId ?? null),
        });
    });
    r.delete("/buildings/:buildingId/assets/:fileId", needUser, async (c) => {
        const loaded = await loadBuildingForUser(c, c.req.param("buildingId"));
        if ("response" in loaded)
            return loaded.response;
        if (!canManageFiles(loaded.ctx))
            return c.json({ error: "Forbidden" }, 403);
        const fileId = c.req.param("fileId");
        const buildingId = loaded.building.id;
        const projectId = loaded.location.projectId;
        const expectedFolderKey = buildingFolderKey(buildingId);
        const file = await prisma.file.findFirst({
            where: { id: fileId, projectId },
        });
        if (!file)
            return c.json({ error: "File not found" }, 404);
        if (file.buildingId !== buildingId && file.folderKey !== expectedFolderKey) {
            return c.json({ error: "File is not attached to this building" }, 404);
        }
        await prisma.drawingLevelMap.deleteMany({ where: { pdfFileId: fileId, projectId } });
        const isBuildingUpload = file.folderKey === expectedFolderKey;
        if (isBuildingUpload) {
            const result = await deleteFileFromS3AndDb(env, fileId);
            if (!result.ok)
                return c.json({ error: result.error }, 500);
            await prisma.workspace.update({
                where: { id: loaded.ctx.project.workspaceId },
                data: { storageUsedBytes: { decrement: result.bytesFreed } },
            });
            return c.json({ ok: true, mode: "deleted" });
        }
        await prisma.file.update({
            where: { id: fileId },
            data: {
                buildingId: null,
                buildingAssetType: null,
                buildingDiscipline: null,
            },
        });
        return c.json({ ok: true, mode: "unlinked" });
    });
    r.get("/assets/:fileVersionId/status", needUser, async (c) => {
        const fv = await prisma.fileVersion.findUnique({
            where: { id: c.req.param("fileVersionId") },
            include: { file: { include: { project: { include: { workspace: true } } } } },
        });
        if (!fv)
            return c.json({ error: "Not found" }, 404);
        const auth = await loadProjectWithAuth(fv.file.projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const status = resolveFileVersionProcessingStatus({
            bimConversionStatus: fv.bimConversionStatus,
            assetProcessingStatus: fv.assetProcessingStatus,
            buildingAssetType: fv.file.buildingAssetType,
        });
        return c.json({
            fileVersionId: fv.id,
            status,
            bimConversionStatus: fv.bimConversionStatus,
            assetProcessingStatus: fv.assetProcessingStatus,
            errorMessage: fv.assetProcessingError,
            thumbnailUrl: fv.thumbnailS3Key,
        });
    });
    r.get("/levels/:id/mappings", needUser, async (c) => {
        const loaded = await loadLevelForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const maps = await prisma.drawingLevelMap.findMany({
            where: { bimModelLevelId: loaded.level.id },
            include: {
                pdfFile: {
                    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
                },
            },
            orderBy: { createdAt: "asc" },
        });
        return c.json({
            mappings: maps.map((map) => ({
                id: map.id,
                pdfFileId: map.pdfFileId,
                pdfFileVersionId: map.pdfFileVersionId ?? map.pdfFile.versions[0]?.id ?? null,
                pdfFileName: map.pdfFile.name,
                pageIndex: map.pageIndex,
                offsetX: map.offsetX,
                offsetY: map.offsetY,
                scale: map.scale,
                rotationDeg: map.rotationDeg,
                calibrationJson: map.calibrationJson,
            })),
        });
    });
    /** Simple PDF→level assign (no IFC / calibration). */
    r.post("/levels/:id/drawings", needUser, async (c) => {
        const body = z
            .object({
            fileAssetId: z.string().min(1),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadLevelForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        try {
            const map = await assignDrawingToLevel({
                levelId: loaded.level.id,
                fileAssetId: body.data.fileAssetId,
                projectId: loaded.level.projectId,
            });
            await markBuildingMappingsDirtyByLevelId(loaded.level.id);
            return c.json({
                mapping: {
                    id: map.id,
                    pdfFileId: map.pdfFileId,
                    pdfFileVersionId: map.pdfFileVersionId,
                    pageIndex: map.pageIndex,
                    bimModelLevelId: map.bimModelLevelId,
                },
            }, 201);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to assign drawing";
            return c.json({ error: msg }, 400);
        }
    });
    r.post("/levels/:id/mapping", needUser, async (c) => {
        const body = z
            .object({
            fileAssetId: z.string(),
            calibration: calibrationSchema,
            ifcFileVersionId: z.string().optional(),
            pageIndex: z.number().int().min(0).optional(),
        })
            .safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadLevelForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        const ifcFileVersionId = body.data.ifcFileVersionId ??
            loaded.level.ifcFileVersionId ??
            (loaded.level.buildingId ? await resolveBuildingIfcVersion(loaded.level.buildingId) : null);
        if (!ifcFileVersionId) {
            return c.json({ error: "No IFC model available for this level" }, 400);
        }
        try {
            const map = await createLevelMapping({
                levelId: loaded.level.id,
                fileAssetId: body.data.fileAssetId,
                userId: c.get("user").id,
                calibration: body.data.calibration,
                ifcFileVersionId,
                projectId: loaded.level.projectId,
                pageIndex: body.data.pageIndex,
            });
            await markBuildingMappingsDirtyByLevelId(loaded.level.id);
            return c.json({ mapping: map }, 201);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to create mapping";
            return c.json({ error: msg }, 400);
        }
    });
    r.patch("/mappings/:id", needUser, async (c) => {
        const body = z.object({ calibration: calibrationSchema }).safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const map = await prisma.drawingLevelMap.findUnique({
            where: { id: c.req.param("id") },
            include: { project: { include: { workspace: true } } },
        });
        if (!map)
            return c.json({ error: "Not found" }, 404);
        const auth = await loadProjectWithAuth(map.projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        const updated = await updateLevelMapping(map.id, c.get("user").id, body.data.calibration);
        await markBuildingMappingsDirtyByMappingId(map.id);
        return c.json({ mapping: updated });
    });
    r.delete("/mappings/:id", needUser, async (c) => {
        const map = await prisma.drawingLevelMap.findUnique({ where: { id: c.req.param("id") } });
        if (!map)
            return c.json({ error: "Not found" }, 404);
        const auth = await loadProjectWithAuth(map.projectId, c.get("user").id);
        if ("error" in auth)
            return c.json({ error: auth.error }, auth.status);
        await markBuildingMappingsDirtyByMappingId(map.id);
        await deleteLevelMapping(map.id);
        return c.json({ ok: true });
    });
    r.post("/levels/:id/thumbnail/presign", needUser, async (c) => {
        const loaded = await loadLevelForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        if (!loaded.level.buildingId)
            return c.json({ error: "Level has no building" }, 400);
        const wsId = loaded.ctx.project.workspaceId;
        const key = levelPlanThumbnailKey(wsId, loaded.level.projectId, loaded.level.buildingId, loaded.level.id);
        const url = await presignPut(env, key, "image/png");
        if (!url)
            return c.json({ error: "S3 not configured", devKey: key }, 503);
        return c.json({ uploadUrl: url, key });
    });
    r.post("/levels/:id/thumbnail/complete", needUser, async (c) => {
        const body = z.object({ s3Key: z.string() }).safeParse(await c.req.json());
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const loaded = await loadLevelForUser(c, c.req.param("id"));
        if ("response" in loaded)
            return loaded.response;
        if (!loaded.level.buildingId)
            return c.json({ error: "Level has no building" }, 400);
        const expected = levelPlanThumbnailKey(loaded.ctx.project.workspaceId, loaded.level.projectId, loaded.level.buildingId, loaded.level.id);
        if (body.data.s3Key !== expected)
            return c.json({ error: "Invalid key" }, 400);
        const level = await prisma.bimModelLevel.update({
            where: { id: loaded.level.id },
            data: { thumbnailS3Key: body.data.s3Key },
            include: { drawingMaps: { select: { id: true } } },
        });
        return c.json({ level: levelJson(level) });
    });
    r.get("/locations/thumbnails/presign-read", needUser, async (c) => {
        const key = c.req.query("key");
        if (!key?.startsWith("ws/"))
            return c.json({ error: "Invalid key" }, 400);
        const url = await presignGet(env, key);
        if (!url)
            return c.json({ error: "S3 not configured" }, 503);
        return c.json({ url });
    });
}
