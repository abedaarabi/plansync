/**
 * Operations & Maintenance domain API endpoints and payload types.
 */
import { apiUrl } from "@/lib/api-url";
import type { ProjectSessionResponse } from "./core-project-ops";
import { jsonHeaders, readJsonErrorBody, readJsonOrEmpty } from "./shared";
import { ProRequiredError } from "./errors";
import { referencePhotoContentType } from "@/lib/referencePhotoMime";

// --- Operations & Maintenance (O&M) ---

export type OmAssetRow = {
  id: string;
  projectId: string;
  tag: string;
  name: string;
  category?: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  locationLabel: string | null;
  hall: string | null;
  rowLabel: string | null;
  rack: string | null;
  positionU: string | null;
  installDate: string | null;
  warrantyExpires: string | null;
  lastServiceAt: string | null;
  notes: string | null;
  fileId: string | null;
  fileVersionId: string | null;
  pageNumber: number | null;
  annotationId: string | null;
  pinJson: unknown;
  file: { id: string; name: string } | null;
  fileVersion: { id: string; version: number } | null;
  /** True when a tenant portal equipment QR secret exists for this asset. */
  hasOccupantQr: boolean;
  /** True when a primary equipment photo has been uploaded. */
  hasImage: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function fetchOmAssets(
  projectId: string,
  opts?: { q?: string },
): Promise<OmAssetRow[]> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/assets${q}`),
    {
      credentials: "include",
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load assets.");
  return res.json() as Promise<OmAssetRow[]>;
}

export type OmAssetCreateBody = {
  tag: string;
  name: string;
  category?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  locationLabel?: string | null;
  hall?: string | null;
  rowLabel?: string | null;
  rack?: string | null;
  positionU?: string | null;
  installDate?: string | null;
  warrantyExpires?: string | null;
  lastServiceAt?: string | null;
  notes?: string | null;
  fileId?: string | null;
  fileVersionId?: string | null;
  pageNumber?: number | null;
  annotationId?: string | null;
  pinJson?: unknown;
};

export async function createOmAsset(
  projectId: string,
  body: OmAssetCreateBody,
): Promise<OmAssetRow> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/assets`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof j.error === "string" ? j.error : "Could not create asset.");
  }
  return res.json() as Promise<OmAssetRow>;
}

export async function postOmAssetOccupantScanSecret(
  projectId: string,
  assetId: string,
  body?: { rotate?: boolean },
): Promise<{ occupantScanSecret: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/occupant-scan-secret`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body ?? {}),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as {
    error?: unknown;
    occupantScanSecret?: string;
  };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not configure equipment QR.");
  }
  if (!j.occupantScanSecret) throw new Error("Invalid response.");
  return { occupantScanSecret: j.occupantScanSecret };
}

export async function deleteOmAsset(projectId: string, assetId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof j.error === "string" ? j.error : "Could not delete asset.");
  }
}

const MAX_ASSET_IMAGE_BYTES = 15 * 1024 * 1024;

async function presignOmAssetImageUpload(
  projectId: string,
  assetId: string,
  body: { fileName: string; contentType: string; sizeBytes: number },
): Promise<{ uploadUrl: string; key: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/image/presign`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as {
    error?: unknown;
    uploadUrl?: string;
    key?: string;
  };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not start image upload.");
  }
  if (!j.uploadUrl || !j.key) throw new Error("Invalid presign response.");
  return { uploadUrl: j.uploadUrl, key: j.key };
}

async function completeOmAssetImageUpload(
  projectId: string,
  assetId: string,
  body: {
    key: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  },
): Promise<OmAssetRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/image/complete`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof j.error === "string" ? j.error : "Could not save image.");
  }
  return res.json() as Promise<OmAssetRow>;
}

export async function fetchOmAssetImageReadUrl(
  projectId: string,
  assetId: string,
): Promise<string> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/image/presign-read`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown; url?: string };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not load image.");
  }
  if (!j.url) throw new Error("Invalid response.");
  return j.url;
}

export async function deleteOmAssetImage(projectId: string, assetId: string): Promise<OmAssetRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/image`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof j.error === "string" ? j.error : "Could not remove image.");
  }
  return res.json() as Promise<OmAssetRow>;
}

/** Presign PUT, upload to S3, then complete — returns the updated asset row. */
export async function uploadOmAssetImageFile(
  projectId: string,
  assetId: string,
  file: File,
): Promise<OmAssetRow> {
  if (file.size > MAX_ASSET_IMAGE_BYTES) {
    throw new Error("Image too large (max 15 MB).");
  }
  const contentType = referencePhotoContentType(file);
  const { uploadUrl, key } = await presignOmAssetImageUpload(projectId, assetId, {
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
  });
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!put.ok) throw new Error("Could not upload image to storage.");
  return completeOmAssetImageUpload(projectId, assetId, {
    key,
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
  });
}

export type OmAssetDocumentRow = {
  id: string;
  assetId: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
};

export async function fetchOmAssetDocuments(
  projectId: string,
  assetId: string,
): Promise<OmAssetDocumentRow[]> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/documents`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load asset documents.");
  return res.json() as Promise<OmAssetDocumentRow[]>;
}

export async function presignOmAssetDocumentUpload(
  projectId: string,
  assetId: string,
  body: { fileName: string; contentType: string; sizeBytes: number },
): Promise<{ uploadUrl: string; key: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/documents/presign`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as {
    error?: unknown;
    uploadUrl?: string;
    key?: string;
  };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not start upload.");
  }
  if (!j.uploadUrl || !j.key) throw new Error("Invalid presign response.");
  return { uploadUrl: j.uploadUrl, key: j.key };
}

export async function completeOmAssetDocumentUpload(
  projectId: string,
  assetId: string,
  body: {
    key: string;
    label?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  },
): Promise<OmAssetDocumentRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/documents/complete`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof j.error === "string" ? j.error : "Could not save document.");
  }
  return res.json() as Promise<OmAssetDocumentRow>;
}

export async function fetchOmAssetDocumentReadUrl(
  projectId: string,
  assetId: string,
  documentId: string,
): Promise<string> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/documents/${encodeURIComponent(documentId)}/presign-read`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown; url?: string };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not get download link.");
  }
  if (!j.url) throw new Error("Invalid response.");
  return j.url;
}

export async function deleteOmAssetDocument(
  projectId: string,
  assetId: string,
  documentId: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}/documents/${encodeURIComponent(documentId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof j.error === "string" ? j.error : "Could not delete document.");
  }
}

export async function patchOmAsset(
  projectId: string,
  assetId: string,
  patch: {
    tag?: string;
    name?: string;
    category?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    locationLabel?: string | null;
    hall?: string | null;
    rowLabel?: string | null;
    rack?: string | null;
    positionU?: string | null;
    installDate?: string | null;
    warrantyExpires?: string | null;
    lastServiceAt?: string | null;
    notes?: string | null;
    fileId?: string | null;
    fileVersionId?: string | null;
    pageNumber?: number | null;
    annotationId?: string | null;
    pinJson?: unknown | null;
  },
): Promise<OmAssetRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/assets/${encodeURIComponent(assetId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof j.error === "string" ? j.error : "Could not update asset.");
  }
  return res.json() as Promise<OmAssetRow>;
}

export type OmHandoverSummary = {
  projectId: string;
  projectName: string;
  stage: string;
  operationsMode: boolean;
  handoverNotes: string;
  handoverCompletedAt: string | null;
  readiness: {
    assets: { total: number; linkedToDrawing: number };
    workOrdersOpen: number;
    maintenance: { schedulesTracked: number; overdue: number; dueSoon: number };
    inspections: { templates: number; completedRuns: number };
    occupantPortal: { activeMagicLinks: number; assetsWithOccupantSecret: number };
    punchOpen: number;
    constructionIssuesOpen: number;
    tenantRequestsOpen: number;
  };
};

export async function fetchOmHandoverSummary(projectId: string): Promise<OmHandoverSummary> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/handover-summary`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof j.error === "string" ? j.error : "Could not load handover summary.");
  }
  return res.json() as Promise<OmHandoverSummary>;
}

export async function patchOmHandoverBrief(
  projectId: string,
  body: {
    notes?: string;
    handoverCompletedAt?: string | null;
    buildingLabel?: string | null;
    facilityManagerUserId?: string | null;
    handoverDate?: string | null;
    transferAsBuilt?: boolean;
    transferClosedIssues?: boolean;
    transferPunch?: boolean;
    transferTeamAccess?: boolean;
    handoverWizardCompletedAt?: string | null;
    buildingOwnerEmail?: string | null;
  },
): Promise<{ projectId: string; settings: ProjectSessionResponse["settings"] }> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/handover-brief`),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    projectId?: string;
    settings?: ProjectSessionResponse["settings"];
  };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not save handover brief.");
  }
  if (!j.settings || !j.projectId) throw new Error("Invalid response.");
  return { projectId: j.projectId, settings: j.settings };
}

export type OmFmDashboardResponse = {
  projectId: string;
  projectName: string;
  handoverCompletedAt: string | null;
  handoverDate: string | null;
  buildingLabel: string | null;
  facilityManagerUserId: string | null;
  handoverWizardCompletedAt: string | null;
  kpis: {
    openWorkOrders: number;
    inProgressWorkOrders: number;
    openTenantRequests: number;
    inProgressTenantRequests: number;
    maintenanceScheduledThisWeek: number;
    assetsTracked: number;
    overdueMaintenanceTasks: number;
    maintenanceDueSoon: number;
    workOrderBacklogOver7Days: number;
    workOrderBacklogOver30Days: number;
    pmCompliancePct: number;
  };
  buildingHealthPct: number;
  upcomingMaintenanceThisWeek: {
    id: string;
    title: string;
    nextDueAt: string;
    assetTag: string;
    assetName: string;
    vendor: string | null;
    health: "overdue" | "dueSoon" | "onTrack";
  }[];
  recentWorkOrders: {
    id: string;
    title: string;
    status: string;
    priority: string;
    updatedAt: string;
  }[];
  recentTenantRequests: {
    id: string;
    title: string;
    status: string;
    priority: string;
    updatedAt: string;
  }[];
};

export async function fetchOmFmDashboard(projectId: string): Promise<OmFmDashboardResponse> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/fm-dashboard`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof j.error === "string" ? j.error : "Could not load FM dashboard.");
  }
  return res.json() as Promise<OmFmDashboardResponse>;
}

export function omOccupantAssetQrCsvUrl(projectId: string): string {
  return apiUrl(
    `/api/v1/projects/${encodeURIComponent(projectId)}/om/reports/occupant-asset-qr-urls.csv`,
  );
}

export function omAssetRegisterCsvUrl(projectId: string): string {
  return apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/reports/asset-register.csv`);
}

export async function postOmInspectionRunWorkOrder(
  projectId: string,
  runId: string,
  body: { itemId: string; title: string },
): Promise<{ id: string; title: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/inspection-runs/${encodeURIComponent(runId)}/work-order`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as {
    error?: unknown;
    id?: string;
    title?: string;
  };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not create work order.");
  }
  if (!j.id || !j.title) throw new Error("Invalid response.");
  return { id: j.id, title: j.title };
}
