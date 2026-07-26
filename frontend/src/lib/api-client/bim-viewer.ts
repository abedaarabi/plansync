import { apiUrl } from "@/lib/api-url";
import type { BimConversionStatus, BimQuantityIndex, BimSavedViewRecord } from "@/lib/bim/types";
import { apiJsonFetch } from "./shared";

export async function fetchBimStatus(fileVersionId: string): Promise<BimConversionStatus> {
  return apiJsonFetch(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/status`);
}

export async function triggerBimConversion(fileVersionId: string): Promise<{ jobRunId: string }> {
  return apiJsonFetch(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/convert`, {
    method: "POST",
  });
}

async function fetchBimQuantityIndex(fileVersionId: string): Promise<BimQuantityIndex> {
  return apiJsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/quantity-index`,
  );
}

async function fetchBimQuantityIndexSummary(fileVersionId: string): Promise<BimQuantityIndex> {
  return apiJsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/quantity-index/summary`,
  );
}

export async function fetchBimQuantityIndexWithCache(
  fileVersionId: string,
): Promise<BimQuantityIndex> {
  const { readCachedQuantityIndex, writeCachedQuantityIndex, buildQuantityIndexCacheKey } =
    await import("@/lib/bimQuantityIndexCache");
  const key = buildQuantityIndexCacheKey(fileVersionId);
  const cached = await readCachedQuantityIndex(key);
  if (cached && !cached.partial) return cached.index;
  const index = await fetchBimQuantityIndex(fileVersionId);
  void writeCachedQuantityIndex(key, index);
  return index;
}

export async function fetchBimQuantityIndexSummaryWithCache(
  fileVersionId: string,
): Promise<BimQuantityIndex> {
  const { readCachedQuantityIndex, writeCachedQuantityIndex, buildQuantityIndexCacheKey } =
    await import("@/lib/bimQuantityIndexCache");
  const key = buildQuantityIndexCacheKey(fileVersionId);
  const cached = await readCachedQuantityIndex(key);
  if (cached?.partial) return cached.index;
  const index = await fetchBimQuantityIndexSummary(fileVersionId);
  void writeCachedQuantityIndex(key, index);
  return index;
}

export async function fetchBimFragmentsBuffer(fileVersionId: string): Promise<ArrayBuffer | null> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/fragments`),
    { credentials: "include" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not load fragments (${res.status})`);
  return res.arrayBuffer();
}

export async function uploadBimFragments(
  fileVersionId: string,
  buffer: ArrayBuffer,
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/fragments`),
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/octet-stream" },
      body: buffer,
    },
  );
  if (!res.ok) throw new Error(`Could not upload fragments (${res.status})`);
}

export async function importBimTakeoff(
  fileVersionId: string,
  body: {
    guids: string[];
    materialId: string;
    quantity: number | string;
    label?: string;
    unit?: string;
    notes?: string;
  },
): Promise<{ takeoffLineId: string; quantity: string; unit: string }> {
  return apiJsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/takeoff/import`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export async function autoMapBimTakeoff(
  fileVersionId: string,
  body?: { ifcTypes?: string[]; createLines?: boolean },
): Promise<{
  mapped: { ifcType: string; materialId: string | null; materialName: string | null }[];
  createdLineIds: string[];
  errors?: string[];
}> {
  return apiJsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/takeoff/auto-map`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    },
  );
}

export function bimQuantityExportUrl(fileVersionId: string): string {
  return apiUrl(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/quantity-export.csv`,
  );
}

export async function compareBimQuantities(
  fileVersionId: string,
  otherFileVersionId: string,
): Promise<{
  baseVersion: number;
  compareVersion: number;
  deltas: {
    ifcType: string;
    countA: number;
    countB: number;
    countDelta: number;
    areaDelta: number | null;
    volumeDelta: number | null;
  }[];
}> {
  const q = new URLSearchParams({ otherFileVersionId });
  return apiJsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/quantity-compare?${q}`,
  );
}

export async function fetchBimSavedViews(
  fileVersionId: string,
): Promise<{ views: BimSavedViewRecord[] }> {
  return apiJsonFetch(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/saved-views`);
}

export async function createBimSavedView(
  fileVersionId: string,
  body: {
    name: string;
    cameraJson: Record<string, unknown>;
    filtersJson?: Record<string, unknown>;
    hiddenGuids?: string[];
    isolatedGuids?: string[];
  },
): Promise<{ view: BimSavedViewRecord }> {
  return apiJsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/saved-views`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export async function deleteBimSavedView(viewId: string): Promise<void> {
  await apiJsonFetch(`/api/v1/bim/saved-views/${encodeURIComponent(viewId)}`, { method: "DELETE" });
}
