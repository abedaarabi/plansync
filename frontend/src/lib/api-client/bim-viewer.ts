import { apiUrl } from "@/lib/api-url";
import type { BimConversionStatus, BimQuantityIndex, BimSavedViewRecord } from "@/lib/bim/types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(url), { credentials: "include", ...init });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function fetchBimStatus(fileVersionId: string): Promise<BimConversionStatus> {
  return jsonFetch(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/status`);
}

export async function triggerBimConversion(fileVersionId: string): Promise<{ jobRunId: string }> {
  return jsonFetch(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/convert`, {
    method: "POST",
  });
}

export async function fetchBimQuantityIndex(fileVersionId: string): Promise<BimQuantityIndex> {
  return jsonFetch(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/quantity-index`);
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
  return jsonFetch(
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
  return jsonFetch(
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
  return jsonFetch(
    `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/quantity-compare?${q}`,
  );
}

export async function fetchBimSavedViews(
  fileVersionId: string,
): Promise<{ views: BimSavedViewRecord[] }> {
  return jsonFetch(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/saved-views`);
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
  return jsonFetch(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/bim/saved-views`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteBimSavedView(viewId: string): Promise<void> {
  await jsonFetch(`/api/v1/bim/saved-views/${encodeURIComponent(viewId)}`, { method: "DELETE" });
}
