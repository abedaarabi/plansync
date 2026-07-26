import { apiUrl } from "@/lib/api-url";
import type { BimConversionStatus, BimLoqReport } from "@/lib/bim/types";
import type { DrawingCoordTransform } from "@/lib/bim/drawingCoordBridge";
import type { CloudFile, FileVersion } from "@/types/projects";
import { fetchBimStatus } from "./bim-viewer";
import { apiJsonFetch, jsonHeaders } from "./shared";
import { uploadFileViaXHR } from "./uploadFileXHR";

const JSON_HEADERS = jsonHeaders;

/** Direct upload limit before presigned path (20 MB safety margin vs backend body limit). */
const IFC_PRESIGN_THRESHOLD_BYTES = 20 * 1024 * 1024;

/** Skip client-side SHA-256 for very large IFC files (already verified by S3 PUT). */
const IFC_SHA256_SKIP_BYTES = 100 * 1024 * 1024;

export type BimStoreyPreview = {
  sourceName: string;
  displayName: string;
  elevationMeters: number | null;
  elementCount: number;
  sortOrder: number;
};

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

export type DrawingSheetOption = {
  fileId: string;
  name: string;
  /** Legacy API field; prefer `name`. */
  fileName?: string;
  folderId: string | null;
  folderPath: string | null;
  disciplines: string[];
  pageCount: number;
  latestFileVersionId: string;
  summaryByPage?: string[];
};

export type SuggestedDrawingMap = DrawingMapDraft & {
  confidence: number;
  reason: string;
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

async function fetchBimStoreys(fileVersionId: string): Promise<{
  storeys: BimStoreyPreview[];
  ready: boolean;
}> {
  return apiJsonFetch(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/storeys`);
}

export async function fetchBimPublishSummary(fileVersionId: string): Promise<BimPublishSummary> {
  return apiJsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/publish-summary`,
  );
}

export async function publishBimModel(
  fileVersionId: string,
  body: {
    levels: BimModelLevelDraft[];
    maps?: DrawingMapDraft[];
  },
): Promise<{
  publishedAt: string;
  levelCount: number;
  mapCount: number;
}> {
  return apiJsonFetch(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/publish`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

export async function saveBimDrawingMaps(
  fileVersionId: string,
  maps: DrawingMapDraft[],
): Promise<{ mapCount: number }> {
  return apiJsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/drawing-maps`,
    {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ maps }),
    },
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

type RawDrawingSheet = Partial<DrawingSheetOption> & {
  pdfFileId?: string;
  fileName?: string;
};

// fallow-ignore-next-line complexity
export async function fetchDrawingSheets(
  projectId: string,
  opts?: { discipline?: string; folderId?: string | null },
): Promise<{ sheets: DrawingSheetOption[] }> {
  const q = new URLSearchParams();
  if (opts?.discipline) q.set("discipline", opts.discipline);
  if (opts?.folderId) q.set("folderId", opts.folderId);
  const suffix = q.size > 0 ? `?${q}` : "";
  const data = await apiJsonFetch<{ sheets: RawDrawingSheet[] }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/drawing-sheets${suffix}`,
  );
  const sheets = data.sheets
    // fallow-ignore-next-line complexity
    .map((s) => {
      const fileId = s.fileId ?? s.pdfFileId;
      if (!fileId) return null;
      return {
        fileId,
        name: s.name ?? s.fileName ?? "Untitled",
        folderId: s.folderId ?? null,
        folderPath: s.folderPath ?? null,
        disciplines: s.disciplines ?? [],
        pageCount: Math.max(1, s.pageCount ?? 1),
        latestFileVersionId: s.latestFileVersionId ?? "",
        ...(s.summaryByPage ? { summaryByPage: s.summaryByPage } : {}),
      };
    })
    .filter((s): s is DrawingSheetOption => s !== null);
  return { sheets };
}

export async function suggestBimDrawingMappings(
  fileVersionId: string,
  body?: { pdfFileIds?: string[] },
): Promise<{ suggestions: SuggestedDrawingMap[] }> {
  return apiJsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/suggest-mappings`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body ?? {}),
    },
  );
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

export type IfcUploadResult = {
  file: CloudFile;
  fileVersion: FileVersion;
};

function uploadIfcDirect(input: {
  file: File;
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  fileName: string;
  onProgress: (pct: number) => void;
}): Promise<IfcUploadResult> {
  return uploadFileViaXHR<IfcUploadResult>(input);
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// fallow-ignore-next-line complexity
async function uploadIfcPresigned(input: {
  file: File;
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  fileName: string;
  onProgress: (pct: number) => void;
}): Promise<IfcUploadResult> {
  const presign = await apiJsonFetch<{
    uploadUrl: string;
    key: string;
    fileId: string;
  }>("/api/v1/files/presign-upload", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      folderId: input.folderId ?? undefined,
      fileName: input.fileName,
      contentType: input.file.type || "model/ifc",
      sizeBytes: String(input.file.size),
    }),
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // fallow-ignore-next-line code-duplication
    xhr.open("PUT", presign.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        input.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("S3 upload network error."));
    xhr.setRequestHeader("Content-Type", input.file.type || "model/ifc");
    xhr.send(input.file);
  });

  let digest: string | undefined;
  if (input.file.size <= IFC_SHA256_SKIP_BYTES) {
    const buf = await input.file.arrayBuffer();
    digest = await sha256Hex(buf);
  }

  return apiJsonFetch<IfcUploadResult>("/api/v1/files/complete-upload", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      folderId: input.folderId ?? undefined,
      fileName: input.fileName,
      fileId: presign.fileId,
      s3Key: presign.key,
      sizeBytes: String(input.file.size),
      ...(digest ? { sha256: digest } : {}),
      mimeType: input.file.type || "model/ifc",
    }),
  });
}

/** Upload IFC via presigned S3 (falls back to direct upload when S3 is unavailable). */
// fallow-ignore-next-line complexity
export async function uploadIfcFile(input: {
  file: File;
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  fileName: string;
  onProgress: (pct: number) => void;
}): Promise<IfcUploadResult> {
  try {
    return await uploadIfcPresigned(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const s3Unavailable =
      msg.includes("S3 not configured") ||
      msg.includes("Could not create upload URL") ||
      msg.includes("(503)");
    if (s3Unavailable && input.file.size <= IFC_PRESIGN_THRESHOLD_BYTES) {
      return uploadIfcDirect(input);
    }
    throw e;
  }
}

// fallow-ignore-next-line complexity
export async function pollBimStoreysUntilReady(
  fileVersionId: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<BimStoreyPreview[]> {
  const intervalMs = opts?.intervalMs ?? 1500;
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = await fetchBimStoreys(fileVersionId);
    if (data.ready && data.storeys.length > 0) return data.storeys;
    if (data.ready) return data.storeys;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const last = await fetchBimStoreys(fileVersionId);
  return last.storeys;
}

export type BimLoqHints = {
  loq: BimLoqReport | null;
  conversionStatus: string;
  quantityIndexSummaryReady: boolean;
  quantityIndexReady: boolean;
  indexProgress: number | null;
  indexPhase: "summary" | "full" | null;
};

export async function fetchBimLoqHints(fileVersionId: string): Promise<BimLoqHints> {
  const status = await fetchBimStatus(fileVersionId);
  return {
    loq: status.loq,
    conversionStatus: status.conversionStatus,
    quantityIndexSummaryReady: status.quantityIndexSummaryReady,
    quantityIndexReady: status.quantityIndexReady,
    indexProgress: status.indexProgress,
    indexPhase: status.indexPhase,
  };
}

export { fetchBimStatus, triggerBimConversion } from "./bim-viewer";
