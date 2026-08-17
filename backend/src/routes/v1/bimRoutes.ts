import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isProjectAccessError, loadProjectForMember } from "../../lib/projectAccess.js";
import type { Env } from "../../lib/env.js";
import { getObjectStream } from "../../lib/s3.js";
import { webStreamToBuffer } from "../../lib/bim/streamUtils.js";
import { notifyBimJobEvent } from "../../lib/bim/bimJobNotify.js";
import { toQuantityIndexSummary } from "../../lib/bim/quantityIndexBuilder.js";
import {
  enqueueBimConversion,
  processBimConversion,
  storeFragmentsBuffer,
} from "../../lib/bim/conversionProcessor.js";
import type { BimQuantityEntry, BimQuantityIndex } from "../../lib/bim/types.js";
import { groupEntriesForCostTakeoff } from "../../lib/bim/takeoffGrouping.js";
import {
  clearCoordTransform,
  getDrawingLevelMaps,
  getDrawingSheets,
  getPublishedModelLevels,
  getPublishStatusCounts,
  getStoreysResponseForFileVersion,
  getSyncContext,
  publishModel,
  saveCoordTransform,
  suggestMappingsForVersion,
  updateDrawingMaps,
} from "../../lib/bim/bimPublish.js";
import { drawingCoordTransformPutSchema } from "../../lib/bim/coordTransformSchema.js";
import type { PdfMappingCandidate } from "../../lib/bim/suggestMappings.js";
import {
  authorizeBimFileVersion,
  authorizeSameFileCompare,
  loadBimFileVersion,
  readBimQuantityIndex,
  requireBimPro,
} from "./bimRouteHelpers.js";
import {
  diffElementMetadata,
  diffElementVersions,
  diffQuantityIndexElements,
  mergeElementDiffs,
  type ElementVersionSnapshot,
} from "../../lib/bim/elementVersionCompare.js";

function rollupQuantities(entries: BimQuantityEntry[]) {
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
    if (e.quantities.count != null) count = Math.max(count, e.quantities.count);
  }
  return {
    count,
    length: hasLength ? length : null,
    area: hasArea ? area : null,
    volume: hasVolume ? volume : null,
  };
}

const ELEMENT_VERSION_SNAP_SELECT = {
  metadataHash: true,
  changeType: true,
  element: { select: { ifcGuid: true, ifcType: true, name: true } },
} as const;

function loadElementVersionSnaps(fileVersionId: string) {
  return prisma.bimElementVersion.findMany({
    where: { fileVersionId },
    select: ELEMENT_VERSION_SNAP_SELECT,
  });
}

function toElementSnapshot(
  row: Awaited<ReturnType<typeof loadElementVersionSnaps>>[number],
): ElementVersionSnapshot {
  return {
    ifcGuid: row.element.ifcGuid,
    name: row.element.name,
    ifcType: row.element.ifcType,
    metadataHash: row.metadataHash,
    live: row.changeType !== "DELETED",
  };
}

function readyIndexElements(index: BimQuantityIndex | null): BimQuantityEntry[] {
  return index && index.partial !== true ? index.elements : [];
}

export function registerBimRoutes(r: Hono, needUser: MiddlewareHandler, env: Env): void {
  // fallow-ignore-next-line complexity, code-duplication
  r.get("/file-versions/:fileVersionId/bim/status", needUser, async (c) => {
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
      requirePro: true,
    });
    if ("response" in auth) return auth.response;
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

    const resultJson = jobRun?.resultJson as { progress?: number; phase?: string } | null;
    const conversionStatus = fv.bimConversionStatus;
    const quantityIndexReady = conversionStatus === "ready";
    const quantityIndexSummaryReady =
      Boolean(fv.quantityIndexS3Key) &&
      (conversionStatus === "summary_ready" || !quantityIndexReady);

    const sourceByteLength = Number(fv.sizeBytes);
    return c.json({
      fileVersionId: fv.id,
      conversionStatus,
      pipelinePhase: resultJson?.phase ?? null,
      fragmentsReady: Boolean(fv.fragmentsS3Key),
      geometryManifestReady: Boolean(fv.geometryManifestS3Key),
      quantityIndexSummaryReady,
      quantityIndexReady,
      partial: quantityIndexSummaryReady,
      indexProgress: typeof resultJson?.progress === "number" ? resultJson.progress : null,
      indexPhase:
        resultJson?.phase === "summary" || resultJson?.phase === "full" ? resultJson.phase : null,
      loq: fv.bimLoqReport,
      jobRunId: fv.bimConversionJobRunId,
      bimPublishedAt: statusCounts.bimPublishedAt,
      levelCount: statusCounts.levelCount,
      mappedSheetCount: statusCounts.mappedSheetCount,
      /** Source IFC size — used by the viewer to refuse unsafe in-browser conversion. */
      sourceByteLength: Number.isFinite(sourceByteLength) ? sourceByteLength : null,
    });
  });

  r.get("/file-versions/:fileVersionId/bim/geometry-manifest", needUser, async (c) => {
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
    if ("response" in auth) return auth.response;
    const { fv } = auth;
    if (!fv.geometryManifestS3Key) return c.json({ error: "Geometry manifest not ready" }, 404);
    const obj = await getObjectStream(env, fv.geometryManifestS3Key);
    if (!obj.ok) return c.json({ error: obj.error }, 502);
    const buf = await webStreamToBuffer(obj.stream);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=300" },
    });
  });

  r.get("/file-versions/:fileVersionId/bim/element-index", needUser, async (c) => {
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    const limit = Math.min(500, Math.max(1, Number(c.req.query("limit")) || 100));
    const cursor = c.req.query("cursor") ?? undefined;
    const filterType = c.req.query("ifcType") ?? undefined;

    const rows = await prisma.bimElementVersion.findMany({
      where: {
        fileVersionId: fv.id,
        changeType: { not: "DELETED" },
        ...(filterType ? { element: { ifcType: filterType } } : {}),
        ...(cursor ? { elementId: { gt: cursor } } : {}),
      },
      take: limit + 1,
      orderBy: { elementId: "asc" },
      include: {
        element: { select: { id: true, ifcGuid: true, ifcType: true, name: true } },
      },
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1]?.elementId : null;

    const attrs =
      page.length > 0
        ? await prisma.bimElementAttribute.findMany({
            where: {
              fileVersionId: fv.id,
              elementId: { in: page.map((r) => r.elementId) },
              key: { in: ["level", "material", "discipline"] },
            },
          })
        : [];

    const attrByElement = new Map<string, Record<string, string>>();
    for (const a of attrs) {
      let m = attrByElement.get(a.elementId);
      if (!m) {
        m = {};
        attrByElement.set(a.elementId, m);
      }
      m[a.key] = a.value;
    }

    return c.json({
      fileVersionId: fv.id,
      items: page.map((r) => ({
        elementId: r.elementId,
        guid: r.element.ifcGuid,
        ifcType: r.element.ifcType,
        name: r.element.name,
        changeType: r.changeType,
        level: attrByElement.get(r.elementId)?.level ?? null,
        material: attrByElement.get(r.elementId)?.material ?? null,
        discipline: attrByElement.get(r.elementId)?.discipline ?? null,
      })),
      nextCursor,
    });
  });

  r.get("/file-versions/:fileVersionId/bim/changes", needUser, async (c) => {
    const pair = await authorizeSameFileCompare(
      c,
      c.req.param("fileVersionId"),
      c.req.query("baseFileVersionId"),
    );
    if ("response" in pair) return pair.response;
    const { fv, base } = pair;

    const [currentRows, baseRows, currentIndex, baseIndex] = await Promise.all([
      loadElementVersionSnaps(fv.id),
      loadElementVersionSnaps(base.id),
      readBimQuantityIndex(env, fv),
      readBimQuantityIndex(env, base),
    ]);

    const versionDiff = diffElementVersions(
      currentRows.map(toElementSnapshot),
      baseRows.map(toElementSnapshot),
    );
    const currentEls = readyIndexElements(currentIndex);
    const baseEls = readyIndexElements(baseIndex);
    const diff =
      currentEls.length > 0 && baseEls.length > 0
        ? mergeElementDiffs(versionDiff, diffQuantityIndexElements(currentEls, baseEls))
        : versionDiff;

    return c.json({
      baseFileVersionId: base.id,
      compareFileVersionId: fv.id,
      baseVersion: base.version,
      compareVersion: fv.version,
      added: diff.added,
      modified: diff.modified,
      deleted: diff.deleted,
      counts: {
        added: diff.added.length,
        modified: diff.modified.length,
        deleted: diff.deleted.length,
        unchanged: diff.unchangedCount,
        baseLive: diff.baseLiveCount,
        currentLive: diff.currentLiveCount,
      },
    });
  });

  // fallow-ignore-next-line complexity
  r.get("/file-versions/:fileVersionId/bim/element-compare", needUser, async (c) => {
    const guid = c.req.query("guid")?.trim();
    if (!guid) return c.json({ error: "guid required" }, 400);
    const pair = await authorizeSameFileCompare(
      c,
      c.req.param("fileVersionId"),
      c.req.query("baseFileVersionId"),
    );
    if ("response" in pair) return pair.response;
    const { fv, base } = pair;

    const [currentRow, baseRow] = await Promise.all([
      prisma.bimElementVersion.findFirst({
        where: { fileVersionId: fv.id, element: { fileId: fv.fileId, ifcGuid: guid } },
        select: {
          metadataS3Key: true,
          changeType: true,
          element: { select: { ifcGuid: true, ifcType: true, name: true } },
        },
      }),
      prisma.bimElementVersion.findFirst({
        where: { fileVersionId: base.id, element: { fileId: fv.fileId, ifcGuid: guid } },
        select: {
          metadataS3Key: true,
          changeType: true,
          element: { select: { ifcGuid: true, ifcType: true, name: true } },
        },
      }),
    ]);

    const readMeta = async (key: string | undefined): Promise<Record<string, unknown> | null> => {
      if (!key) return null;
      const obj = await getObjectStream(env, key);
      if (!obj.ok) return null;
      try {
        const raw = await webStreamToBuffer(obj.stream);
        const parsed: unknown = JSON.parse(raw.toString("utf8"));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    };

    const [before, after] = await Promise.all([
      readMeta(baseRow?.changeType === "DELETED" ? undefined : baseRow?.metadataS3Key),
      readMeta(currentRow?.changeType === "DELETED" ? undefined : currentRow?.metadataS3Key),
    ]);
    const fields = diffElementMetadata(before, after);
    const currentLive = Boolean(currentRow && currentRow.changeType !== "DELETED");
    const baseLive = Boolean(baseRow && baseRow.changeType !== "DELETED");
    const kind =
      !baseLive && currentLive ? "added" : baseLive && !currentLive ? "deleted" : "modified";

    return c.json({
      guid,
      kind,
      name: currentRow?.element.name ?? baseRow?.element.name ?? null,
      ifcType: currentRow?.element.ifcType ?? baseRow?.element.ifcType ?? null,
      fields,
    });
  });

  // fallow-ignore-next-line code-duplication
  r.get("/file-versions/:fileVersionId/bim/publish-summary", needUser, async (c) => {
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
      requirePro: true,
    });
    if ("response" in auth) return auth.response;
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
    const body = z
      .object({ force: z.boolean().optional() })
      .partial()
      .parse(await c.req.json().catch(() => ({})));
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
      requirePro: true,
    });
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    const jobId = await enqueueBimConversion(env, fv.id, c.get("user").id, {
      force: body.force === true,
    });
    return c.json({ jobRunId: jobId, status: "queued" });
  });

  r.get("/file-versions/:fileVersionId/bim/fragments", needUser, async (c) => {
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    if (!fv.fragmentsS3Key) return c.json({ error: "Fragments not ready" }, 404);
    const obj = await getObjectStream(env, fv.fragmentsS3Key);
    if (!obj.ok) return c.json({ error: obj.error }, obj.error === "S3 not configured" ? 503 : 502);
    return new Response(obj.stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        ...(obj.contentLength != null ? { "Content-Length": String(obj.contentLength) } : {}),
      },
    });
  });

  r.get("/file-versions/:fileVersionId/bim/geometry-tiles/:contentHash", needUser, async (c) => {
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
    if ("response" in auth) return auth.response;
    const { fv } = auth;
    const contentHash = c.req.param("contentHash");
    if (!/^[a-f0-9]{64}$/i.test(contentHash)) {
      return c.json({ error: "Invalid tile hash" }, 400);
    }

    const link = await prisma.bimVersionTile.findFirst({
      where: { fileVersionId: fv.id, contentHash },
      include: { geometryTile: true },
    });
    if (!link?.geometryTile) return c.json({ error: "Tile not found" }, 404);

    const obj = await getObjectStream(env, link.geometryTile.s3Key);
    if (!obj.ok) return c.json({ error: obj.error }, obj.error === "S3 not configured" ? 503 : 502);
    const length = obj.contentLength ?? Number(link.geometryTile.byteLength);
    return new Response(obj.stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        ...(Number.isFinite(length) && length > 0 ? { "Content-Length": String(length) } : {}),
      },
    });
  });

  r.put("/file-versions/:fileVersionId/bim/fragments", needUser, async (c) => {
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    const buf = Buffer.from(await c.req.arrayBuffer());
    const key = await storeFragmentsBuffer(env, fv.id, buf);
    return c.json({ fragmentsS3Key: key });
  });

  // fallow-ignore-next-line code-duplication
  r.get("/file-versions/:fileVersionId/bim/quantity-index/summary", needUser, async (c) => {
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    const index = await readBimQuantityIndex(env, fv);
    if (!index) return c.json({ error: "Quantity index not ready" }, 404);
    return c.json(toQuantityIndexSummary(index));
  });

  r.get("/file-versions/:fileVersionId/bim/quantity-index", needUser, async (c) => {
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    const index = await readBimQuantityIndex(env, fv);
    if (!index) return c.json({ error: "Quantity index not ready" }, 404);
    if (index.partial || index.elements.length === 0) {
      return c.json({ error: "Full quantity index not ready" }, 404);
    }
    return c.json(index);
  });

  r.get("/file-versions/:fileVersionId/bim/quantity-export.csv", needUser, async (c) => {
    // fallow-ignore-next-line code-duplication
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    const index = await readBimQuantityIndex(env, fv);
    if (!index) return c.json({ error: "Quantity index not ready" }, 404);

    const header =
      "GUID,Type,Name,Level,Material,Length,Area,Volume,Count,QuantitySource,Discipline\n";
    const esc = (s: string | null) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const rows = index.elements.map((e) =>
      [
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
      ].join(","),
    );
    return new Response(header + rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bim-quantities-${fv.version}.csv"`,
      },
    });
  });

  r.get("/file-versions/:fileVersionId/bim/quantity-compare", needUser, async (c) => {
    const otherId = c.req.query("otherFileVersionId");
    if (!otherId) return c.json({ error: "otherFileVersionId required" }, 400);

    const fv = await loadBimFileVersion(c.req.param("fileVersionId"));
    const other = await loadBimFileVersion(otherId);
    if (!fv || !other) return c.json({ error: "Not found" }, 404);
    if (fv.fileId !== other.fileId) return c.json({ error: "Versions must be same file" }, 400);

    const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if (isProjectAccessError(access)) return c.json({ error: access.error }, access.status);

    const [a, b] = await Promise.all([
      readBimQuantityIndex(env, fv),
      readBimQuantityIndex(env, other),
    ]);
    if (!a || !b) return c.json({ error: "Index not ready" }, 404);

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
        areaDelta:
          ta?.totalArea != null && tb?.totalArea != null ? tb.totalArea - ta.totalArea : null,
        volumeA: ta?.totalVolume ?? null,
        volumeB: tb?.totalVolume ?? null,
        volumeDelta:
          ta?.totalVolume != null && tb?.totalVolume != null
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
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    const index = await readBimQuantityIndex(env, fv);
    if (!index) return c.json({ error: "Quantity index not ready" }, 404);

    const entries = index.elements.filter((e) => body.guids.includes(e.guid));
    if (entries.length === 0) return c.json({ error: "No matching elements" }, 400);

    const rollup = rollupQuantities(entries);
    let quantity = new Prisma.Decimal(rollup.count);
    let unit = body.unit ?? "ea";
    if (body.quantityKind === "length" && rollup.length != null) {
      quantity = new Prisma.Decimal(rollup.length);
      unit = body.unit ?? "m";
    } else if (body.quantityKind === "area" && rollup.area != null) {
      quantity = new Prisma.Decimal(rollup.area);
      unit = body.unit ?? "m²";
    } else if (body.quantityKind === "volume" && rollup.volume != null) {
      quantity = new Prisma.Decimal(rollup.volume);
      unit = body.unit ?? "m³";
    }

    const sortedGuids = [...body.guids].sort();
    const sourceBimKey =
      sortedGuids.length === 1
        ? `guid:${sortedGuids[0]}`
        : `agg:${sortedGuids.length}:${sortedGuids[0]?.slice(0, 8)}`;

    const ifcType = entries[0]?.ifcType ?? null;
    const typeName = entries[0]?.typeName?.trim() || null;
    const label =
      body.label ??
      (entries.length === 1
        ? (typeName ?? entries[0]?.name ?? entries[0]?.ifcType ?? "BIM element")
        : `${entries.length}× ${typeName ?? ifcType ?? "elements"}`);

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
        sourceIfcGuid: sortedGuids.length === 1 ? sortedGuids[0]! : null,
        sourceIfcGuids: sortedGuids,
        ifcType,
        quantitySource: entries[0]?.quantitySource ?? "computed",
        sourceFileVersionAtCreate: fv.version,
        bimMetadata: {
          quantityKind: body.quantityKind,
          guids: sortedGuids,
          typeName,
        },
      },
      update: {
        label,
        quantity,
        unit,
        notes: body.notes ?? null,
        materialId: body.materialId ?? undefined,
        sourceIfcGuids: sortedGuids,
        bimMetadata: {
          quantityKind: body.quantityKind,
          guids: sortedGuids,
          typeName,
        },
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
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    const index = await readBimQuantityIndex(env, fv);
    if (!index) return c.json({ error: "Quantity index not ready" }, 404);

    const materials = await prisma.material.findMany({
      where: { workspaceId: fv.file.project.workspaceId },
      select: { id: true, name: true, unit: true },
    });

    const pool = body.ifcTypes?.length
      ? index.elements.filter((e) => body.ifcTypes!.includes(e.ifcType))
      : index.elements;
    const groups = groupEntriesForCostTakeoff(pool);

    const mapped: {
      ifcType: string | null;
      typeName: string | null;
      label: string;
      materialId: string | null;
      materialName: string | null;
      source: "typeName" | "ifcType";
    }[] = [];
    const created: string[] = [];

    for (const group of groups) {
      if (group.guids.length === 0) continue;
      const matchNeedle = group.label;
      const mat =
        materials.find((m) => m.name.toLowerCase().includes(matchNeedle.toLowerCase())) ??
        materials.find((m) =>
          matchNeedle.toLowerCase().includes(m.name.toLowerCase().slice(0, 4)),
        ) ??
        null;
      mapped.push({
        ifcType: group.ifcType,
        typeName: group.typeName,
        label: group.label,
        materialId: mat?.id ?? null,
        materialName: mat?.name ?? null,
        source: group.source,
      });

      if (!body.createLines) continue;

      const rollup = rollupQuantities(group.entries);
      const unit = rollup.volume != null ? "m³" : rollup.area != null ? "m²" : "ea";
      const quantity = rollup.volume ?? rollup.area ?? rollup.count;
      const sourceBimKey = group.key;

      const line = await prisma.takeoffLine.upsert({
        where: { fileVersionId_sourceBimKey: { fileVersionId: fv.id, sourceBimKey } },
        create: {
          workspaceId: fv.file.project.workspaceId,
          projectId: fv.file.projectId,
          fileId: fv.fileId,
          fileVersionId: fv.id,
          materialId: mat?.id ?? null,
          label: group.label,
          quantity,
          unit,
          sourceType: "bim",
          sourceBimKey,
          ifcType: group.ifcType,
          sourceIfcGuids: group.guids,
          quantitySource: "computed",
          sourceFileVersionAtCreate: fv.version,
          bimMetadata: {
            autoMapped: true,
            ifcType: group.ifcType,
            typeName: group.typeName,
            costGroupSource: group.source,
          },
        },
        update: {
          quantity,
          unit,
          materialId: mat?.id ?? undefined,
          sourceIfcGuids: group.guids,
          label: group.label,
          bimMetadata: {
            autoMapped: true,
            ifcType: group.ifcType,
            typeName: group.typeName,
            costGroupSource: group.source,
          },
        },
      });
      created.push(line.id);
    }

    return c.json({ mapped, createdLineIds: created });
  });

  r.get("/file-versions/:fileVersionId/bim/saved-views", needUser, async (c) => {
    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"));
    if ("response" in auth) return auth.response;
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
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    const view = await prisma.bimSavedView.create({
      data: {
        projectId: fv.file.projectId,
        fileVersionId: fv.id,
        userId: c.get("user").id,
        name: body.name,
        cameraJson: body.cameraJson as Prisma.InputJsonValue,
        filtersJson: (body.filtersJson ?? undefined) as Prisma.InputJsonValue | undefined,
        hiddenGuids: (body.hiddenGuids ?? undefined) as Prisma.InputJsonValue | undefined,
        isolatedGuids: (body.isolatedGuids ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return c.json({ view });
  });

  r.delete("/bim/saved-views/:viewId", needUser, async (c) => {
    const view = await prisma.bimSavedView.findUnique({ where: { id: c.req.param("viewId") } });
    if (!view) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(view.projectId, c.get("user").id);
    if (isProjectAccessError(access)) return c.json({ error: access.error }, access.status);
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
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    try {
      const { storeys, ready } = await getStoreysResponseForFileVersion(env, fv.id);
      return c.json({ storeys, ready });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to extract storeys";
      return c.json({ error: msg }, 400);
    }
  });

  r.post("/file-versions/:fileVersionId/bim/publish", needUser, async (c) => {
    const body = z
      .object({
        levels: z
          .array(
            z.object({
              sourceName: z.string().min(1),
              displayName: z.string().min(1),
              elevationMeters: z.number().nullable().optional(),
              sortOrder: z.number().int(),
            }),
          )
          .min(1),
        maps: z
          .array(
            z.object({
              bimModelLevelId: z.string().optional(),
              sourceName: z.string().optional(),
              pdfFileId: z.string(),
              pdfFileVersionId: z.string().nullable().optional(),
              // fallow-ignore-next-line code-duplication
              pageIndex: z.number().int().min(0),
            }),
          )
          // fallow-ignore-next-line code-duplication
          .optional(),
      })
      .parse(await c.req.json());

    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
      requirePro: true,
    });
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    try {
      const result = await publishModel(env, fv.id, c.get("user").id, body);
      await notifyBimJobEvent("bim.publish_complete", {
        env,
        workspaceId: fv.file.project.workspaceId,
        projectId: fv.file.projectId,
        projectName: fv.file.project.name,
        fileId: fv.fileId,
        fileVersionId: fv.id,
        fileName: fv.file.name,
        versionNumber: fv.version,
        userId: c.get("user").id,
        jobStartedAt: null,
      });
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Publish failed";
      return c.json({ error: msg }, 400);
    }
  });

  r.put("/file-versions/:fileVersionId/bim/drawing-maps", needUser, async (c) => {
    const body = z
      .object({
        maps: z.array(
          z.object({
            bimModelLevelId: z.string().optional(),
            sourceName: z.string().optional(),
            pdfFileId: z.string(),
            pdfFileVersionId: z.string().nullable().optional(),
            pageIndex: z.number().int().min(0),
          }),
        ),
      })
      .parse(await c.req.json());

    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
      requirePro: true,
    });
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    try {
      const result = await updateDrawingMaps(fv.id, c.get("user").id, body.maps);
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      return c.json({ error: msg }, 400);
    }
  });

  r.get("/projects/:projectId/drawing-level-maps", needUser, async (c) => {
    const ifcFileVersionId = c.req.query("ifcFileVersionId");
    if (!ifcFileVersionId) return c.json({ error: "ifcFileVersionId required" }, 400);

    const fv = await loadBimFileVersion(ifcFileVersionId);
    if (!fv) return c.json({ error: "Not found" }, 404);
    if (fv.file.projectId !== c.req.param("projectId")) {
      return c.json({ error: "Not found" }, 404);
    }
    const access = await loadProjectForMember(fv.file.projectId, c.get("user").id);
    if (isProjectAccessError(access)) return c.json({ error: access.error }, access.status);
    const pro = requireBimPro(fv.file.project.workspace);
    if (pro) return c.json({ error: pro.error }, pro.status);

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
    if (isProjectAccessError(access)) return c.json({ error: access.error }, access.status);
    const pro = requireBimPro(access.project.workspace);
    if (pro) return c.json({ error: pro.error }, pro.status);

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to list sheets";
      const status = msg === "Forbidden" ? 403 : 400;
      return c.json({ error: msg }, status);
    }
  });

  r.post("/file-versions/:fileVersionId/bim/suggest-mappings", needUser, async (c) => {
    const body = z
      .object({
        pdfCandidates: z.array(
          z.object({
            pdfFileId: z.string(),
            fileName: z.string(),
            pageIndex: z.number().int().min(0),
            pageCount: z.number().int().min(1),
            summaryMarkdown: z.string().nullable().optional(),
          }),
        ),
        levels: z
          .array(
            z.object({
              sourceName: z.string().min(1),
              displayName: z.string().min(1),
              elevationMeters: z.number().nullable().optional(),
              sortOrder: z.number().int(),
            }),
          )
          .optional(),
      })
      .parse(await c.req.json());

    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
      requirePro: true,
    });
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    const suggestions = await suggestMappingsForVersion(
      env,
      fv.id,
      body.pdfCandidates as PdfMappingCandidate[],
      body.levels,
    );
    return c.json({ suggestions });
  });

  r.put("/drawing-level-maps/:mapId/coord-transform", needUser, async (c) => {
    const body = drawingCoordTransformPutSchema.parse(await c.req.json());
    // fallow-ignore-next-line code-duplication
    const map = await prisma.drawingLevelMap.findUnique({ where: { id: c.req.param("mapId") } });
    if (!map) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(map.projectId, c.get("user").id);
    if (isProjectAccessError(access)) return c.json({ error: access.error }, access.status);

    if (!map.ifcFileVersionId) return c.json({ error: "Map has no IFC model" }, 400);
    const fv = await loadBimFileVersion(map.ifcFileVersionId);
    if (!fv) return c.json({ error: "Not found" }, 404);
    const pro = requireBimPro(fv.file.project.workspace);
    if (pro) return c.json({ error: pro.error }, pro.status);

    const transform = body.controlPoints
      ? { ...body.transform, controlPoints: body.controlPoints }
      : body.transform;

    try {
      const result = await saveCoordTransform(map.id, c.get("user").id, transform);
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      return c.json({ error: msg }, 400);
    }
  });

  r.delete("/drawing-level-maps/:mapId/coord-transform", needUser, async (c) => {
    const map = await prisma.drawingLevelMap.findUnique({ where: { id: c.req.param("mapId") } });
    if (!map) return c.json({ error: "Not found" }, 404);
    const access = await loadProjectForMember(map.projectId, c.get("user").id);
    if (isProjectAccessError(access)) return c.json({ error: access.error }, access.status);

    if (!map.ifcFileVersionId) return c.json({ error: "Map has no IFC model" }, 400);
    const fv = await loadBimFileVersion(map.ifcFileVersionId);
    if (!fv) return c.json({ error: "Not found" }, 404);
    const pro = requireBimPro(fv.file.project.workspace);
    if (pro) return c.json({ error: pro.error }, pro.status);

    await clearCoordTransform(map.id);
    return c.json({ ok: true });
  });

  r.get("/file-versions/:fileVersionId/bim/sync-context", needUser, async (c) => {
    const levelId = c.req.query("levelId");
    if (!levelId) return c.json({ error: "levelId required" }, 400);

    const auth = await authorizeBimFileVersion(c, c.req.param("fileVersionId"), {
      requirePro: true,
    });
    if ("response" in auth) return auth.response;
    const { fv } = auth;

    try {
      const context = await getSyncContext(env, fv.id, levelId);
      return c.json(context);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync context unavailable";
      return c.json({ error: msg }, 404);
    }
  });
}
