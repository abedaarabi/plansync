import type { DrawingCoordTransform } from "@/lib/bim/drawingCoordBridge";
import type { CalibrationInput } from "@/lib/api-client/locations";
import { apiJsonFetch, jsonHeaders } from "./shared";

const JSON_HEADERS = jsonHeaders;

export type BimModelLevelDraft = {
  /** Client-side id before publish (sourceName) or DB id after publish. */
  clientId?: string;
  /** Persisted level id when loaded from API. */
  id?: string;
  sourceName: string;
  displayName: string;
  elevationMeters: number | null;
  sortOrder: number;
  elementCount?: number;
};

export type DrawingMapDraft = {
  bimModelLevelId: string;
  pdfFileId: string;
  pdfFileVersionId?: string | null;
  pageIndex: number;
};

export type DrawingMapRecord = DrawingMapDraft & {
  id: string;
  coordTransformJson: DrawingCoordTransform | null;
  coordAlignedAt: string | null;
  calibrationJson?: CalibrationInput | null;
  offsetX?: number | null;
  offsetY?: number | null;
  scale?: number | null;
  rotationDeg?: number | null;
  level?: {
    id: string;
    sourceName: string;
    displayName: string;
    elevationMeters?: number | null;
    sortOrder?: number;
  };
  pdfFileName?: string;
  pdfFolderPath?: string | null;
  resolvedPdfFileVersionId?: string | null;
  pdfVersion?: number;
  latestPdfFileVersionId?: string | null;
  pinnedPdfFileVersionId?: string | null;
};

export type BimPublishSummary = {
  fileVersionId: string;
  published: boolean;
  publishedAt: string | null;
  levelCount: number;
  mapCount: number;
  alignedMapCount: number;
};

export type BimSyncContext = {
  levelId: string;
  levelDisplayName: string;
  levelSourceName: string;
  elevationMeters: number | null;
  pdfFileId: string;
  pdfFileVersionId: string;
  pageIndex: number;
  pageWidthPt: number;
  pageHeightPt: number;
  mmPerPdfUnit: number | null;
  coordTransform: DrawingCoordTransform | null;
  drawingMapId: string;
};

type RawDrawingLevelMap = DrawingMapRecord & {
  level?: DrawingMapRecord["level"];
  pdfFile?: { id: string; name: string; folderId: string | null };
  calibrationJson?: CalibrationInput | null;
};

type RawBimSyncContext = {
  level: {
    id: string;
    displayName: string;
    sourceName: string;
    elevationMeters: number | null;
  };
  map: {
    id: string;
    pageIndex: number;
    pdfFileId: string;
    pdfFileVersionId: string;
    pdfFileName?: string;
  };
  calibration?: { mmPerPdfUnit?: number | null } | null;
  coordTransform: DrawingCoordTransform | null;
  pageWidthPt: number;
  pageHeightPt: number;
};

// fallow-ignore-next-line complexity
function normalizeDrawingMap(raw: RawDrawingLevelMap): DrawingMapRecord {
  return {
    id: raw.id,
    bimModelLevelId: raw.bimModelLevelId,
    pdfFileId: raw.pdfFileId,
    pdfFileVersionId: raw.pdfFileVersionId,
    pageIndex: raw.pageIndex,
    coordTransformJson: raw.coordTransformJson,
    coordAlignedAt: raw.coordAlignedAt,
    calibrationJson: raw.calibrationJson ?? null,
    offsetX: raw.offsetX ?? null,
    offsetY: raw.offsetY ?? null,
    scale: raw.scale ?? null,
    rotationDeg: raw.rotationDeg ?? null,
    level: raw.level,
    pdfFileName: raw.pdfFileName ?? raw.pdfFile?.name,
    pdfFolderPath: raw.pdfFolderPath ?? null,
    resolvedPdfFileVersionId: raw.resolvedPdfFileVersionId ?? null,
    pdfVersion: raw.pdfVersion,
    latestPdfFileVersionId: raw.latestPdfFileVersionId ?? null,
    pinnedPdfFileVersionId: raw.pinnedPdfFileVersionId ?? raw.pdfFileVersionId ?? null,
  };
}

function normalizeBimSyncContext(raw: RawBimSyncContext): BimSyncContext {
  return {
    levelId: raw.level.id,
    levelDisplayName: raw.level.displayName,
    levelSourceName: raw.level.sourceName,
    elevationMeters: raw.level.elevationMeters,
    pdfFileId: raw.map.pdfFileId,
    pdfFileVersionId: raw.map.pdfFileVersionId,
    pageIndex: raw.map.pageIndex,
    pageWidthPt: raw.pageWidthPt,
    pageHeightPt: raw.pageHeightPt,
    mmPerPdfUnit: raw.calibration?.mmPerPdfUnit ?? null,
    coordTransform: raw.coordTransform,
    drawingMapId: raw.map.id,
  };
}

export async function fetchBimPublishSummary(fileVersionId: string): Promise<BimPublishSummary> {
  return apiJsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/publish-summary`,
  );
}

// fallow-ignore-next-line complexity
export async function fetchDrawingLevelMaps(
  projectId: string,
  ifcFileVersionId: string,
): Promise<{ maps: DrawingMapRecord[]; levels: BimModelLevelDraft[] }> {
  const q = new URLSearchParams({ ifcFileVersionId });
  const data = await apiJsonFetch<{
    maps: RawDrawingLevelMap[];
    levels?: Array<{
      id: string;
      sourceName: string;
      displayName: string;
      elevationMeters: number | null;
      sortOrder: number;
      elementCount?: number;
    }>;
  }>(`/api/v1/projects/${encodeURIComponent(projectId)}/drawing-level-maps?${q}`);
  const maps = data.maps.map(normalizeDrawingMap);
  if (data.levels?.length) {
    const levels = data.levels.map((l) => ({
      id: l.id,
      clientId: l.id,
      sourceName: l.sourceName,
      displayName: l.displayName,
      elevationMeters: l.elevationMeters ?? null,
      sortOrder: l.sortOrder,
      elementCount: l.elementCount,
    }));
    return { maps, levels };
  }
  const levelById = new Map<string, BimModelLevelDraft>();
  for (const m of maps) {
    if (!m.level) continue;
    levelById.set(m.level.id, {
      id: m.level.id,
      clientId: m.level.id,
      sourceName: m.level.sourceName,
      displayName: m.level.displayName,
      elevationMeters: m.level.elevationMeters ?? null,
      sortOrder: m.level.sortOrder ?? 0,
    });
  }
  const levels = [...levelById.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  return { maps, levels };
}

export async function saveDrawingCoordTransform(
  mapId: string,
  transform: DrawingCoordTransform,
): Promise<{ coordAlignedAt: string }> {
  return apiJsonFetch(`/api/v1/drawing-level-maps/${encodeURIComponent(mapId)}/coord-transform`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ transform }),
  });
}

export async function fetchBimSyncContext(
  ifcFileVersionId: string,
  levelId: string,
): Promise<BimSyncContext> {
  const q = new URLSearchParams({ levelId });
  const raw = await apiJsonFetch<RawBimSyncContext>(
    `/api/v1/file-versions/${encodeURIComponent(ifcFileVersionId)}/bim/sync-context?${q}`,
  );
  return normalizeBimSyncContext(raw);
}

export { fetchBimStatus, triggerBimConversion } from "./bim-viewer";
