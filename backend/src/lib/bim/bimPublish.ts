import type { Prisma } from "@prisma/client";
import { Prisma as PrismaClient } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../prisma.js";
import type { Env } from "../env.js";
import { getObjectStream } from "../s3.js";
import { webStreamToBuffer } from "./streamUtils.js";
import {
  canViewFile,
  canViewFolderForUser,
  loadProjectWithAuth,
  type ProjectAuthContext,
} from "../permissions.js";
import { parseQuantityIndexBuffer } from "./quantityIndexBuilder.js";
import { extractStoreysFromIfc, type StoreyPreview } from "./storeyExtract.js";
import { drawingCoordTransformSchema, type DrawingCoordTransform } from "./coordTransformSchema.js";
import {
  buildTransformFromControlPoints,
  maxControlPointResidualMeters,
} from "./drawingCoordBridge.js";
import {
  suggestMappings as computeSuggestions,
  type MappingSuggestion,
  type PdfMappingCandidate,
} from "./suggestMappings.js";

export type PublishLevelInput = {
  sourceName: string;
  displayName: string;
  elevationMeters?: number | null;
  sortOrder: number;
};

export type DrawingMapInput = {
  bimModelLevelId?: string;
  sourceName?: string;
  pdfFileId: string;
  pdfFileVersionId?: string | null;
  pageIndex: number;
};

async function readIfcBytes(env: Env, s3Key: string): Promise<Uint8Array> {
  const obj = await getObjectStream(env, s3Key);
  if (!obj.ok) throw new Error(obj.error);
  const buf = await webStreamToBuffer(obj.stream);
  return new Uint8Array(buf);
}

function isIfcFile(name: string, mimeType: string | null | undefined): boolean {
  return mimeType === "model/ifc" || name.toLowerCase().endsWith(".ifc");
}

function isPdfFile(name: string, mimeType: string | null | undefined): boolean {
  return mimeType === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

function pageCountFromSheetAiCache(sheetAiCache: unknown): number | null {
  if (!sheetAiCache || typeof sheetAiCache !== "object" || Array.isArray(sheetAiCache)) {
    return null;
  }
  const byPage = (sheetAiCache as Record<string, unknown>).byPage;
  if (!byPage || typeof byPage !== "object" || Array.isArray(byPage)) return null;
  const keys = Object.keys(byPage as Record<string, unknown>)
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (keys.length === 0) return null;
  return Math.max(...keys) + 1;
}

async function pageCountFromPdfBytes(bytes: Uint8Array): Promise<number> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return 1;
  }
}

async function resolveLatestPdfVersion(pdfFileId: string) {
  return prisma.fileVersion.findFirst({
    where: { fileId: pdfFileId },
    orderBy: { version: "desc" },
    include: { file: true },
  });
}

async function resolvePageCount(
  env: Env,
  fv: { id: string; s3Key: string; sheetAiCache: unknown },
): Promise<number> {
  const fromCache = pageCountFromSheetAiCache(fv.sheetAiCache);
  if (fromCache != null && fromCache > 0) return fromCache;
  try {
    const obj = await getObjectStream(env, fv.s3Key);
    if (!obj.ok) return 1;
    const buf = await webStreamToBuffer(obj.stream);
    return pageCountFromPdfBytes(new Uint8Array(buf));
  } catch {
    return 1;
  }
}

async function loadIfcFileVersion(fileVersionId: string) {
  return prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    include: { file: { include: { project: { include: { workspace: true } } } } },
  });
}

async function assertIfcFileVersion(fileVersionId: string) {
  const fv = await loadIfcFileVersion(fileVersionId);
  if (!fv) throw new Error("Not found");
  if (!isIfcFile(fv.file.name, fv.file.mimeType)) throw new Error("Not an IFC file");
  return fv;
}

function mergeElementCounts(
  storeys: StoreyPreview[],
  byLevel: Record<string, { count: number }> | undefined,
): StoreyPreview[] {
  if (!byLevel) return storeys;
  return storeys.map((s) => ({
    ...s,
    elementCount: byLevel[s.sourceName]?.count ?? byLevel[s.displayName]?.count ?? 0,
  }));
}

function storeysFromByLevel(
  byLevel: Record<string, { count: number; level?: string }>,
): StoreyPreview[] {
  return Object.entries(byLevel)
    .filter(([name]) => name.trim().length > 0 && name !== "Unassigned")
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map(([name, agg]) => ({
      sourceName: name,
      displayName: name,
      elevationMeters: null,
      elementCount: agg.count ?? 0,
    }));
}

function conversionStoreysReady(status: string | null | undefined): boolean {
  return status === "summary_ready" || status === "ready";
}

async function readQuantityIndexFromS3(
  env: Env,
  s3Key: string,
): Promise<ReturnType<typeof parseQuantityIndexBuffer>> {
  try {
    const obj = await getObjectStream(env, s3Key);
    if (!obj.ok) return null;
    const buf = await webStreamToBuffer(obj.stream);
    return parseQuantityIndexBuffer(buf);
  } catch {
    return null;
  }
}

export type StoreysResponse = {
  storeys: StoreyPreview[];
  ready: boolean;
};

/** Storeys for publish/review — avoids IFC re-parse while conversion is still running. */
export async function getStoreysResponseForFileVersion(
  env: Env,
  fileVersionId: string,
): Promise<StoreysResponse> {
  const fv = await assertIfcFileVersion(fileVersionId);

  const published = await prisma.bimModelLevel.findMany({
    where: { ifcFileVersionId: fv.id },
    orderBy: { sortOrder: "asc" },
  });
  if (published.length > 0) {
    return {
      ready: true,
      storeys: published.map((l) => ({
        sourceName: l.sourceName,
        displayName: l.displayName,
        elevationMeters: l.elevationMeters,
        elementCount: l.elementCount,
      })),
    };
  }

  const conversionStatus = fv.bimConversionStatus;
  if (conversionStatus === "failed") {
    const ifcBytes = await readIfcBytes(env, fv.s3Key);
    const storeys = await extractStoreysFromIfc(ifcBytes);
    return { storeys, ready: true };
  }

  if (fv.quantityIndexS3Key && conversionStoreysReady(conversionStatus)) {
    const index = await readQuantityIndexFromS3(env, fv.quantityIndexS3Key);
    if (index?.byLevel) {
      let storeys = storeysFromByLevel(index.byLevel);
      if (storeys.length === 0) {
        const ifcBytes = await readIfcBytes(env, fv.s3Key);
        storeys = await extractStoreysFromIfc(ifcBytes);
        storeys = mergeElementCounts(storeys, index.byLevel);
      }
      return { storeys, ready: true };
    }
  }

  if (
    conversionStatus === "pending" ||
    conversionStatus === "queued" ||
    conversionStatus === "running"
  ) {
    return { storeys: [], ready: false };
  }

  const ifcBytes = await readIfcBytes(env, fv.s3Key);
  let storeys = await extractStoreysFromIfc(ifcBytes);

  if (fv.quantityIndexS3Key) {
    const index = await readQuantityIndexFromS3(env, fv.quantityIndexS3Key);
    if (index?.byLevel) storeys = mergeElementCounts(storeys, index.byLevel);
  }

  return { storeys, ready: true };
}

async function getStoreysForFileVersion(env: Env, fileVersionId: string): Promise<StoreyPreview[]> {
  const { storeys } = await getStoreysResponseForFileVersion(env, fileVersionId);
  return storeys;
}

async function resolveLevelId(
  _tx: Prisma.TransactionClient,
  _ifcFileVersionId: string,
  map: DrawingMapInput,
  levelBySource: Map<string, string>,
): Promise<string> {
  if (map.bimModelLevelId) {
    const fromSource = levelBySource.get(map.bimModelLevelId);
    if (fromSource) return fromSource;
    return map.bimModelLevelId;
  }
  if (map.sourceName) {
    const id = levelBySource.get(map.sourceName);
    if (id) return id;
  }
  throw new Error(`Unknown level for map: ${map.sourceName ?? map.bimModelLevelId ?? "?"}`);
}

async function upsertDrawingMaps(
  tx: Prisma.TransactionClient,
  projectId: string,
  ifcFileVersionId: string,
  maps: DrawingMapInput[],
  levelBySource: Map<string, string>,
  replaceAll: boolean,
): Promise<void> {
  if (replaceAll) {
    await tx.drawingLevelMap.deleteMany({ where: { ifcFileVersionId } });
  }

  for (const map of maps) {
    const bimModelLevelId = await resolveLevelId(tx, ifcFileVersionId, map, levelBySource);
    const pdfFile = await tx.file.findFirst({
      where: { id: map.pdfFileId, projectId },
    });
    if (!pdfFile || !isPdfFile(pdfFile.name, pdfFile.mimeType)) {
      throw new Error(`Invalid PDF file: ${map.pdfFileId}`);
    }

    await tx.drawingLevelMap.upsert({
      where: {
        ifcFileVersionId_pdfFileId_pageIndex: {
          ifcFileVersionId,
          pdfFileId: map.pdfFileId,
          pageIndex: map.pageIndex,
        },
      },
      create: {
        projectId,
        ifcFileVersionId,
        bimModelLevelId,
        pdfFileId: map.pdfFileId,
        pdfFileVersionId: map.pdfFileVersionId ?? null,
        pageIndex: map.pageIndex,
      },
      update: {
        bimModelLevelId,
        pdfFileVersionId: map.pdfFileVersionId ?? null,
      },
    });
  }
}

export async function publishModel(
  env: Env,
  fileVersionId: string,
  userId: string,
  input: { levels: PublishLevelInput[]; maps?: DrawingMapInput[] },
): Promise<{ levelCount: number; mappedSheetCount: number }> {
  const fv = await assertIfcFileVersion(fileVersionId);
  const projectId = fv.file.projectId;
  const buildingId = fv.file.buildingId ?? null;

  if (input.levels.length === 0) throw new Error("At least one level required");

  const levelBySource = new Map<string, string>();
  let elementCounts = new Map<string, number>();

  if (fv.quantityIndexS3Key) {
    try {
      const obj = await getObjectStream(env, fv.quantityIndexS3Key);
      if (obj.ok) {
        const buf = await webStreamToBuffer(obj.stream);
        const index = parseQuantityIndexBuffer(buf);
        if (index) {
          elementCounts = new Map(
            Object.entries(index.byLevel).map(([name, agg]) => [name, agg.count]),
          );
        }
      }
    } catch {
      /* optional */
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.bimModelLevel.deleteMany({ where: { ifcFileVersionId: fileVersionId } });

    for (const level of input.levels) {
      const row = await tx.bimModelLevel.create({
        data: {
          projectId,
          buildingId,
          ifcFileVersionId: fileVersionId,
          sourceName: level.sourceName,
          displayName: level.displayName,
          elevationMeters: level.elevationMeters ?? null,
          sortOrder: level.sortOrder,
          elementCount: elementCounts.get(level.sourceName) ?? 0,
        },
      });
      levelBySource.set(level.sourceName, row.id);
    }

    if (input.maps?.length) {
      await upsertDrawingMaps(tx, projectId, fileVersionId, input.maps, levelBySource, true);
    } else {
      await tx.drawingLevelMap.deleteMany({ where: { ifcFileVersionId: fileVersionId } });
    }

    await tx.fileVersion.update({
      where: { id: fileVersionId },
      data: {
        bimPublishedAt: new Date(),
        bimPublishedById: userId,
      },
    });
  });

  const mappedSheetCount = input.maps?.length ?? 0;
  return { levelCount: input.levels.length, mappedSheetCount };
}

export async function updateDrawingMaps(
  fileVersionId: string,
  userId: string,
  maps: DrawingMapInput[],
): Promise<{ mappedSheetCount: number }> {
  void userId;
  const fv = await assertIfcFileVersion(fileVersionId);
  const levels = await prisma.bimModelLevel.findMany({
    where: { ifcFileVersionId: fileVersionId },
  });
  if (levels.length === 0) throw new Error("Model not published — publish levels first");

  const levelBySource = new Map(levels.map((l) => [l.sourceName, l.id]));

  await prisma.$transaction(async (tx) => {
    await upsertDrawingMaps(tx, fv.file.projectId, fileVersionId, maps, levelBySource, true);
  });

  return { mappedSheetCount: maps.length };
}

export type ResolvedDrawingLevelMap = {
  id: string;
  bimModelLevelId: string;
  pdfFileId: string;
  pdfFileVersionId: string | null;
  resolvedPdfFileVersionId: string;
  pdfVersion: number;
  latestPdfVersion: number;
  newerVersionAvailable: boolean;
  pageIndex: number;
  coordTransformJson: unknown;
  coordAlignedAt: string | null;
  calibrationJson: unknown;
  offsetX: number | null;
  offsetY: number | null;
  scale: number | null;
  rotationDeg: number | null;
  level: {
    id: string;
    sourceName: string;
    displayName: string;
    elevationMeters: number | null;
    sortOrder: number;
  };
  pdfFile: { id: string; name: string; folderId: string | null };
};

export async function getPublishedModelLevels(ifcFileVersionId: string) {
  const levels = await prisma.bimModelLevel.findMany({
    where: { ifcFileVersionId },
    orderBy: { sortOrder: "asc" },
  });
  return levels.map((l) => ({
    id: l.id,
    sourceName: l.sourceName,
    displayName: l.displayName,
    elevationMeters: l.elevationMeters,
    sortOrder: l.sortOrder,
    elementCount: l.elementCount,
  }));
}

export async function getDrawingLevelMaps(
  projectId: string,
  ifcFileVersionId: string,
): Promise<ResolvedDrawingLevelMap[]> {
  const maps = await prisma.drawingLevelMap.findMany({
    where: { projectId, ifcFileVersionId },
    include: {
      bimModelLevel: true,
      pdfFile: true,
      pdfFileVersion: true,
    },
    orderBy: [{ bimModelLevel: { sortOrder: "asc" } }, { pageIndex: "asc" }],
  });

  const out: ResolvedDrawingLevelMap[] = [];
  for (const map of maps) {
    const latest = await resolveLatestPdfVersion(map.pdfFileId);
    if (!latest) continue;
    const pinned = map.pdfFileVersion;
    const resolvedPdfFileVersionId = pinned?.id ?? latest.id;
    out.push({
      id: map.id,
      bimModelLevelId: map.bimModelLevelId,
      pdfFileId: map.pdfFileId,
      pdfFileVersionId: map.pdfFileVersionId,
      resolvedPdfFileVersionId,
      pdfVersion: pinned?.version ?? latest.version,
      latestPdfVersion: latest.version,
      newerVersionAvailable: Boolean(pinned && latest.version > pinned.version),
      pageIndex: map.pageIndex,
      coordTransformJson: map.coordTransformJson,
      coordAlignedAt: map.coordAlignedAt?.toISOString() ?? null,
      calibrationJson: map.calibrationJson,
      offsetX: map.offsetX,
      offsetY: map.offsetY,
      scale: map.scale,
      rotationDeg: map.rotationDeg,
      level: {
        id: map.bimModelLevel.id,
        sourceName: map.bimModelLevel.sourceName,
        displayName: map.bimModelLevel.displayName,
        elevationMeters: map.bimModelLevel.elevationMeters,
        sortOrder: map.bimModelLevel.sortOrder,
      },
      pdfFile: {
        id: map.pdfFile.id,
        name: map.pdfFile.name,
        folderId: map.pdfFile.folderId,
      },
    });
  }
  return out;
}

async function canAccessFolder(
  // fallow-ignore-next-line code-duplication
  ctx: ProjectAuthContext,
  userId: string,
  folderId: string | null | undefined,
): Promise<boolean> {
  if (!folderId) return true;
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, projectId: ctx.project.id },
    select: { accessMode: true, allowedUserIds: true },
  });
  if (!folder) return false;
  return canViewFolderForUser(ctx, folder, userId);
}

async function collectDescendantFolderIds(
  projectId: string,
  rootFolderId: string,
): Promise<string[]> {
  const folders = await prisma.folder.findMany({
    where: { projectId },
    select: { id: true, parentId: true },
  });
  const children = new Map<string, string[]>();
  for (const f of folders) {
    if (f.parentId) {
      const arr = children.get(f.parentId) ?? [];
      arr.push(f.id);
      children.set(f.parentId, arr);
    }
  }
  const out = [rootFolderId];
  const queue = [rootFolderId];
  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const child of children.get(id) ?? []) {
      out.push(child);
      queue.push(child);
    }
  }
  return out;
}

async function buildFolderPaths(projectId: string): Promise<Map<string, string>> {
  const folders = await prisma.folder.findMany({
    where: { projectId },
    select: { id: true, name: true, parentId: true },
  });
  const byId = new Map(folders.map((f) => [f.id, f]));
  const cache = new Map<string, string>();

  const pathFor = (folderId: string): string => {
    const cached = cache.get(folderId);
    if (cached) return cached;
    const folder = byId.get(folderId);
    if (!folder) return "";
    const parts = [folder.name];
    let parentId = folder.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = parent.parentId;
    }
    const path = parts.join("/");
    cache.set(folderId, path);
    return path;
  };

  for (const f of folders) pathFor(f.id);
  return cache;
}

export type DrawingSheetEntry = {
  pdfFileId: string;
  fileName: string;
  folderId: string | null;
  folderPath: string;
  disciplines: string[];
  latestFileVersionId: string;
  latestVersion: number;
  pageCount: number;
};

// fallow-ignore-next-line complexity
export async function getDrawingSheets(
  env: Env,
  projectId: string,
  userId: string,
  filters: { discipline?: string; folderId?: string },
): Promise<DrawingSheetEntry[]> {
  const access = await loadProjectWithAuth(projectId, userId);
  if ("error" in access) throw new Error(access.error);

  let folderIds: string[] | undefined;
  if (filters.folderId) {
    folderIds = await collectDescendantFolderIds(projectId, filters.folderId);
  }

  const files = await prisma.file.findMany({
    where: {
      projectId,
      ...(folderIds ? { folderId: { in: folderIds } } : {}),
    },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const folderPaths = await buildFolderPaths(projectId);
  const disciplineFilter = filters.discipline?.trim().toLowerCase();
  const out: DrawingSheetEntry[] = [];

  for (const file of files) {
    if (!isPdfFile(file.name, file.mimeType)) continue;
    if (!canViewFile(access.ctx, file.disciplines)) continue;
    if (!(await canAccessFolder(access.ctx, userId, file.folderId))) continue;
    if (
      disciplineFilter &&
      disciplineFilter.length > 0 &&
      !file.disciplines.some((d) => d.toLowerCase() === disciplineFilter)
    ) {
      continue;
    }

    const latest = file.versions[0];
    if (!latest) continue;

    const pageCount = await resolvePageCount(env, latest);
    out.push({
      pdfFileId: file.id,
      fileName: file.name,
      folderId: file.folderId,
      folderPath: file.folderId ? (folderPaths.get(file.folderId) ?? "") : "",
      disciplines: file.disciplines,
      latestFileVersionId: latest.id,
      latestVersion: latest.version,
      pageCount,
    });
  }

  return out;
}

export async function suggestMappingsForVersion(
  env: Env,
  ifcFileVersionId: string,
  pdfCandidates: PdfMappingCandidate[],
  draftLevels?: PublishLevelInput[],
): Promise<MappingSuggestion[]> {
  const dbLevels = await prisma.bimModelLevel.findMany({
    where: { ifcFileVersionId },
    orderBy: { sortOrder: "asc" },
  });
  if (dbLevels.length > 0) {
    return computeSuggestions(dbLevels, pdfCandidates);
  }

  const levelInputs =
    draftLevels ??
    (await getStoreysForFileVersion(env, ifcFileVersionId)).map((s, i) => ({
      sourceName: s.sourceName,
      displayName: s.displayName,
      elevationMeters: s.elevationMeters,
      sortOrder: i,
    }));

  const synthetic = levelInputs.map((s, i) => ({
    id: s.sourceName,
    projectId: "",
    ifcFileVersionId,
    buildingId: null,
    sourceIfcGuid: null,
    sourceName: s.sourceName,
    displayName: s.displayName,
    elevationMeters: s.elevationMeters ?? null,
    sortOrder: s.sortOrder ?? i,
    elementCount: 0,
    thumbnailS3Key: null,
    displaySource: "IFC_CUT" as const,
    createdAt: new Date(),
  }));
  return computeSuggestions(synthetic, pdfCandidates);
}

// fallow-ignore-next-line complexity
function parseCalibration(
  annotationBlob: unknown,
  pageIndex: number,
): { mmPerPdfUnit: number } | null {
  if (!annotationBlob || typeof annotationBlob !== "object" || Array.isArray(annotationBlob)) {
    return null;
  }
  const cal = (annotationBlob as Record<string, unknown>).calibrationByPage;
  if (!cal || typeof cal !== "object" || Array.isArray(cal)) return null;
  const entry = (cal as Record<string, unknown>)[String(pageIndex)];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const mm = Number((entry as Record<string, unknown>).mmPerPdfUnit);
  if (!Number.isFinite(mm) || mm <= 0) return null;
  return { mmPerPdfUnit: mm };
}

export async function saveCoordTransform(
  mapId: string,
  userId: string,
  transformInput: DrawingCoordTransform,
): Promise<{ mapId: string; maxResidualMeters: number; warning?: string }> {
  const parsed = drawingCoordTransformSchema.parse(transformInput);
  const map = await prisma.drawingLevelMap.findUnique({
    where: { id: mapId },
    include: { pdfFile: true },
  });
  if (!map) throw new Error("Not found");

  const fv =
    map.pdfFileVersionId != null
      ? await prisma.fileVersion.findUnique({ where: { id: map.pdfFileVersionId } })
      : await resolveLatestPdfVersion(map.pdfFileId);

  if (!fv) throw new Error("PDF version not found");

  const calibration = parseCalibration(fv.annotationBlob, map.pageIndex);
  if (!calibration) {
    throw new Error("PDF page must be calibrated before saving coordinate transform");
  }

  const fitted = buildTransformFromControlPoints(
    parsed.controlPoints,
    calibration.mmPerPdfUnit,
    parsed.pageWidthPt,
    parsed.pageHeightPt,
  );

  const maxResidual = maxControlPointResidualMeters(fitted);
  const warning =
    maxResidual > 0.5 ? `High alignment error (${maxResidual.toFixed(2)} m)` : undefined;

  await prisma.drawingLevelMap.update({
    where: { id: mapId },
    data: {
      coordTransformJson: fitted as unknown as Prisma.InputJsonValue,
      coordAlignedAt: new Date(),
      coordAlignedById: userId,
    },
  });

  return { mapId, maxResidualMeters: maxResidual, warning };
}

export async function clearCoordTransform(mapId: string): Promise<void> {
  await prisma.drawingLevelMap.update({
    where: { id: mapId },
    data: {
      coordTransformJson: PrismaClient.DbNull,
      coordAlignedAt: null,
      coordAlignedById: null,
    },
  });
}

export async function getSyncContext(env: Env, ifcFileVersionId: string, levelId: string) {
  const level = await prisma.bimModelLevel.findFirst({
    where: { id: levelId, ifcFileVersionId },
  });
  if (!level) throw new Error("Level not found");

  const map = await prisma.drawingLevelMap.findFirst({
    where: { ifcFileVersionId, bimModelLevelId: levelId },
    include: { pdfFile: true, pdfFileVersion: true },
    orderBy: { createdAt: "asc" },
  });
  if (!map) throw new Error("No drawing mapped to this level");

  const resolvedFv = map.pdfFileVersion ?? (await resolveLatestPdfVersion(map.pdfFileId));
  if (!resolvedFv) throw new Error("PDF version not found");

  const calibration = parseCalibration(resolvedFv.annotationBlob, map.pageIndex);
  const transform = map.coordTransformJson
    ? drawingCoordTransformSchema.safeParse(map.coordTransformJson)
    : null;

  let pageWidthPt = 612;
  let pageHeightPt = 792;
  if (transform?.success) {
    pageWidthPt = transform.data.pageWidthPt;
    pageHeightPt = transform.data.pageHeightPt;
  } else {
    try {
      const obj = await getObjectStream(env, resolvedFv.s3Key);
      if (obj.ok) {
        const buf = await webStreamToBuffer(obj.stream);
        const doc = await PDFDocument.load(new Uint8Array(buf), { ignoreEncryption: true });
        const page = doc.getPage(map.pageIndex);
        if (page) {
          const { width, height } = page.getSize();
          pageWidthPt = width;
          pageHeightPt = height;
        }
      }
    } catch {
      /* defaults */
    }
  }

  return {
    level: {
      id: level.id,
      displayName: level.displayName,
      elevationMeters: level.elevationMeters,
      sourceName: level.sourceName,
    },
    map: {
      id: map.id,
      pageIndex: map.pageIndex,
      pdfFileId: map.pdfFileId,
      pdfFileVersionId: resolvedFv.id,
      pdfFileName: map.pdfFile.name,
    },
    calibration,
    coordTransform: transform?.success ? transform.data : null,
    pageWidthPt,
    pageHeightPt,
  };
}

export async function getPublishStatusCounts(fileVersionId: string): Promise<{
  bimPublishedAt: string | null;
  levelCount: number;
  mappedSheetCount: number;
}> {
  const fv = await prisma.fileVersion.findUnique({
    where: { id: fileVersionId },
    select: { bimPublishedAt: true },
  });
  if (!fv) throw new Error("Not found");

  const [levelCount, mappedSheetCount] = await Promise.all([
    prisma.bimModelLevel.count({ where: { ifcFileVersionId: fileVersionId } }),
    prisma.drawingLevelMap.count({ where: { ifcFileVersionId: fileVersionId } }),
  ]);

  return {
    bimPublishedAt: fv.bimPublishedAt?.toISOString() ?? null,
    levelCount,
    mappedSheetCount,
  };
}
