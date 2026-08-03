import { apiJsonFetch, jsonHeaders } from "./shared";

export type BuildingAssetType = "IFC" | "PDF" | "OTHER";
export type BuildingDiscipline = "ARCHITECTURAL" | "STRUCTURAL" | "MEP" | "CIVIL" | "OTHER" | null;
export type ProcessingStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type LevelDisplaySource = "IFC_CUT" | "DRAWING";
export type BuildingType = "OFFICE" | "RESIDENTIAL" | "MIXED" | "INDUSTRIAL" | "OTHER";

export type LocationInput = {
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
};

export type BuildingInput = {
  name: string;
  code?: string | null;
  buildingType?: BuildingType | null;
  floorsApprox?: number | null;
  notes?: string | null;
};

export type LocationSummary = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  buildingCount: number;
  createdAt: string;
  updatedAt?: string;
};

export type BuildingPublishStatus = "setup" | "ready" | "needs_update";
export type LevelMappingHealth = "none" | "ok" | "weak";

export type BuildingChecklist = {
  ifcReady: boolean;
  levelCount: number;
  mappedLevelCount: number;
  levelsWithoutDrawing: number;
  pdfCount: number;
  unmappedPdfCount: number;
};

export type BuildingSummary = {
  id: string;
  name: string;
  code: string | null;
  buildingType: BuildingType | null;
  floorsApprox: number | null;
  notes: string | null;
  locationId: string;
  locationName: string;
  projectId: string;
  mappingsPublishedAt: string | null;
  mappingsDirty: boolean;
  publishStatus: BuildingPublishStatus;
  checklist: BuildingChecklist;
};

export type BuildingLevel = {
  id: string;
  name: string;
  sourceName: string;
  elevation: number | null;
  order: number;
  elementCount: number;
  thumbnailUrl: string | null;
  sourceIfcGuid: string | null;
  buildingId: string | null;
  ifcFileVersionId: string | null;
  displaySource: LevelDisplaySource;
  mappedDrawingCount: number;
  mappingHealth: LevelMappingHealth;
};

export type BuildingAsset = {
  id: string;
  fileName: string;
  type: BuildingAssetType | null;
  discipline: BuildingDiscipline;
  mimeType: string;
  status: ProcessingStatus;
  errorMessage: string | null;
  fileVersionId: string | null;
  version: number | null;
  thumbnailUrl: string | null;
  mappingId: string | null;
  /** Level this PDF is registered to (when mapped). */
  mappedLevelId: string | null;
  createdAt: string;
};

export type { CalibrationInput } from "@plansync/shared/drawingCoordBridge";
import type { CalibrationInput } from "@plansync/shared/drawingCoordBridge";

export type DrawingMapping = {
  id: string;
  offsetX: number | null;
  offsetY: number | null;
  scale: number | null;
  rotationDeg: number | null;
  calibrationJson: CalibrationInput | null;
};

export type LevelDrawingMapping = {
  id: string;
  pdfFileId: string;
  pdfFileVersionId: string | null;
  pdfFileName: string;
  pageIndex: number;
  offsetX: number | null;
  offsetY: number | null;
  scale: number | null;
  rotationDeg: number | null;
  calibrationJson: CalibrationInput | null;
};

export async function fetchLevelMappings(levelId: string): Promise<LevelDrawingMapping[]> {
  const res = await apiJsonFetch<{ mappings: LevelDrawingMapping[] }>(
    `/api/v1/levels/${levelId}/mappings`,
  );
  return res.mappings;
}

export async function fetchLocations(projectId: string): Promise<LocationSummary[]> {
  const res = await apiJsonFetch<{ locations: LocationSummary[] }>(
    `/api/v1/projects/${projectId}/locations`,
  );
  return res.locations;
}

export async function createLocation(
  projectId: string,
  input: LocationInput,
): Promise<LocationSummary> {
  const res = await apiJsonFetch<{ location: LocationSummary }>(
    `/api/v1/projects/${projectId}/locations`,
    { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) },
  );
  return res.location;
}

export async function updateLocation(id: string, input: LocationInput): Promise<LocationSummary> {
  const res = await apiJsonFetch<{ location: LocationSummary }>(`/api/v1/locations/${id}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  return res.location;
}

export async function deleteLocation(id: string): Promise<void> {
  await apiJsonFetch(`/api/v1/locations/${id}`, { method: "DELETE" });
}

export type LocationBuildingRow = {
  id: string;
  name: string;
  code: string | null;
  buildingType: BuildingType | null;
  floorsApprox: number | null;
  notes: string | null;
  ifcCount: number;
  readyIfcCount: number;
  pdfCount: number;
  unmappedPdfCount: number;
  levelCount: number;
  mappedLevelCount: number;
  openClashCount: number;
  hasProcessing: boolean;
  hasFailed: boolean;
  publishStatus: BuildingPublishStatus;
  createdAt: string;
};

export async function fetchLocationDetail(locationId: string): Promise<{
  location: LocationSummary & { projectId: string };
  buildings: LocationBuildingRow[];
}> {
  return apiJsonFetch(`/api/v1/locations/${locationId}`);
}

export async function createBuilding(
  locationId: string,
  input: BuildingInput,
): Promise<{ id: string; name: string; code: string | null }> {
  const res = await apiJsonFetch<{
    building: { id: string; name: string; code: string | null };
  }>(`/api/v1/locations/${locationId}/buildings`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  return res.building;
}

export async function updateBuilding(
  buildingId: string,
  input: BuildingInput,
): Promise<{ id: string; name: string }> {
  const res = await apiJsonFetch<{ building: { id: string; name: string } }>(
    `/api/v1/buildings/${buildingId}`,
    { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(input) },
  );
  return res.building;
}

export async function fetchBuilding(buildingId: string): Promise<BuildingSummary> {
  const res = await apiJsonFetch<{ building: BuildingSummary }>(`/api/v1/buildings/${buildingId}`);
  return res.building;
}

export async function publishBuildingMappings(buildingId: string): Promise<{
  id: string;
  mappingsPublishedAt: string | null;
  mappingsDirty: boolean;
  publishStatus: BuildingPublishStatus;
}> {
  const res = await apiJsonFetch<{
    building: {
      id: string;
      mappingsPublishedAt: string | null;
      mappingsDirty: boolean;
      publishStatus: BuildingPublishStatus;
    };
  }>(`/api/v1/buildings/${buildingId}/publish-mappings`, {
    method: "POST",
    headers: jsonHeaders,
  });
  return res.building;
}

export async function deleteBuilding(id: string): Promise<void> {
  await apiJsonFetch(`/api/v1/buildings/${id}`, { method: "DELETE" });
}

export async function fetchBuildingLevels(buildingId: string): Promise<BuildingLevel[]> {
  const res = await apiJsonFetch<{ levels: BuildingLevel[] }>(
    `/api/v1/buildings/${buildingId}/levels`,
  );
  return res.levels.map((l) => ({
    ...l,
    mappingHealth: l.mappingHealth ?? (l.mappedDrawingCount > 0 ? "ok" : "none"),
  }));
}

export async function createBuildingLevel(
  buildingId: string,
  input: { name: string; elevation?: number; order?: number },
): Promise<BuildingLevel> {
  const res = await apiJsonFetch<{ level: BuildingLevel }>(
    `/api/v1/buildings/${buildingId}/levels`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    },
  );
  return res.level;
}

export async function updateBuildingLevel(
  levelId: string,
  input: { name?: string; elevation?: number | null; displaySource?: LevelDisplaySource },
): Promise<BuildingLevel> {
  const res = await apiJsonFetch<{ level: BuildingLevel }>(`/api/v1/levels/${levelId}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  return res.level;
}

export async function fetchBuildingAssets(
  buildingId: string,
  filters?: { type?: string; discipline?: string; status?: string },
): Promise<{ assets: BuildingAsset[]; unmapped: BuildingAsset[] }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.discipline) params.set("discipline", filters.discipline);
  if (filters?.status) params.set("status", filters.status);
  const q = params.toString();
  return apiJsonFetch(`/api/v1/buildings/${buildingId}/assets${q ? `?${q}` : ""}`);
}

async function presignBuildingAssetUpload(
  buildingId: string,
  input: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    type: BuildingAssetType;
    discipline?: BuildingDiscipline;
  },
): Promise<{ uploadUrl: string; key: string; fileId: string; workspaceId: string }> {
  return apiJsonFetch(`/api/v1/buildings/${buildingId}/assets/presign`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      ...input,
      sizeBytes: String(input.sizeBytes),
      ...(input.discipline != null ? { discipline: input.discipline } : {}),
    }),
  });
}

async function completeBuildingAssetUpload(
  buildingId: string,
  input: {
    workspaceId: string;
    fileName: string;
    fileId: string;
    s3Key: string;
    sizeBytes: number;
    sha256?: string;
    mimeType?: string;
    type: BuildingAssetType;
    discipline?: BuildingDiscipline;
  },
): Promise<{ fileVersion: { id: string } }> {
  return apiJsonFetch(`/api/v1/buildings/${buildingId}/assets/complete`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      fileName: input.fileName,
      fileId: input.fileId,
      s3Key: input.s3Key,
      sizeBytes: String(input.sizeBytes),
      type: input.type,
      ...(input.sha256 ? { sha256: input.sha256 } : {}),
      ...(input.mimeType ? { mimeType: input.mimeType } : {}),
      ...(input.discipline != null ? { discipline: input.discipline } : {}),
    }),
  });
}

export async function uploadBuildingAsset(
  buildingId: string,
  file: File,
  type: BuildingAssetType,
  workspaceId: string,
  discipline?: BuildingDiscipline,
  onProgress?: (pct: number) => void,
): Promise<{ fileVersionId: string; fileId: string }> {
  const presign = await presignBuildingAssetUpload(buildingId, {
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    type,
    discipline: discipline ?? undefined,
  });

  if (presign.uploadUrl.startsWith("http")) {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presign.uploadUrl);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`S3 upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("S3 upload network error"));
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.send(file);
    });
  }

  const completed = await completeBuildingAssetUpload(buildingId, {
    workspaceId: presign.workspaceId,
    fileName: file.name,
    fileId: presign.fileId,
    s3Key: presign.key,
    sizeBytes: file.size,
    mimeType: file.type,
    type,
    discipline,
  });

  return { fileVersionId: completed.fileVersion.id, fileId: presign.fileId };
}

export async function linkExistingFileToBuilding(
  buildingId: string,
  fileId: string,
  type?: BuildingAssetType,
  discipline?: BuildingDiscipline,
): Promise<BuildingAsset> {
  const res = await apiJsonFetch<{ asset: BuildingAsset }>(
    `/api/v1/buildings/${buildingId}/assets/link`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ fileId, type, discipline }),
    },
  );
  return res.asset;
}

export async function deleteBuildingAsset(
  buildingId: string,
  fileId: string,
): Promise<{ ok: true; mode: "deleted" | "unlinked" }> {
  return apiJsonFetch(`/api/v1/buildings/${buildingId}/assets/${fileId}`, { method: "DELETE" });
}

export async function createLevelMapping(
  levelId: string,
  input: {
    fileAssetId: string;
    calibration: CalibrationInput;
    ifcFileVersionId?: string;
    pageIndex?: number;
  },
): Promise<DrawingMapping> {
  const res = await apiJsonFetch<{ mapping: DrawingMapping }>(`/api/v1/levels/${levelId}/mapping`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  return res.mapping;
}

export async function updateLevelMapping(
  mappingId: string,
  input: { calibration: CalibrationInput },
): Promise<DrawingMapping> {
  const res = await apiJsonFetch<{ mapping: DrawingMapping }>(`/api/v1/mappings/${mappingId}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  return res.mapping;
}

export async function deleteLevelMapping(mappingId: string): Promise<{ ok: true }> {
  return apiJsonFetch(`/api/v1/mappings/${mappingId}`, { method: "DELETE" });
}
