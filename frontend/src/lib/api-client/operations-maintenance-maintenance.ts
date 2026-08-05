/**
 * O&M maintenance, inspections, and occupant portal endpoints.
 */
import type { AssetMeterTypeApi } from "./operations-maintenance-work-orders";
import { apiUrl } from "@/lib/api-url";
import { omOccupantAssetQrCsvUrl } from "./operations-maintenance-assets";
import { jsonHeaders, readJsonErrorBody } from "./shared";
import { ProRequiredError } from "./errors";

export type OmMaintenanceRow = {
  id: string;
  assetId: string;
  title: string;
  frequency: string;
  intervalDays: number | null;
  nextDueAt: string | null;
  lastCompletedAt: string | null;
  assignedVendorLabel: string | null;
  assignedToUserId: string | null;
  assignedTo: { id: string; name: string; email: string; image: string | null } | null;
  isActive: boolean;
  health: "overdue" | "dueSoon" | "onTrack";
  meterType: string | null;
  meterThreshold: number | null;
  asset: { id: string; tag: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type OmMaintenanceCompletionRow = {
  id: string;
  workspaceId: string;
  projectId: string;
  assetId: string;
  scheduleId: string;
  completedAt: string;
  completedByUserId: string | null;
  previousDueAt: string | null;
  nextDueAt: string | null;
  workOrderId: string | null;
  notes: string | null;
  vendorLabel: string | null;
  createdAt: string;
  asset: { id: string; tag: string; name: string };
  schedule: { id: string; title: string; frequency: string };
  completedBy: { id: string; name: string; email: string; image: string | null } | null;
  workOrder: { id: string; title: string; status: string; issueKind: string } | null;
};

export async function fetchOmMaintenance(projectId: string): Promise<OmMaintenanceRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/maintenance`),
    {
      credentials: "include",
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load maintenance schedules.");
  return res.json() as Promise<OmMaintenanceRow[]>;
}

export async function fetchOmMaintenanceCompletions(
  projectId: string,
  opts?: { assetId?: string; limit?: number },
): Promise<OmMaintenanceCompletionRow[]> {
  const params = new URLSearchParams();
  if (opts?.assetId) params.set("assetId", opts.assetId);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/maintenance/completions${q}`),
    {
      credentials: "include",
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load maintenance history.");
  return res.json() as Promise<OmMaintenanceCompletionRow[]>;
}

export type OmMaintenanceFrequency =
  | "DAILY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMI_ANNUAL"
  | "ANNUAL"
  | "CUSTOM";

export type OmMaintenanceCreateBody = {
  assetId: string;
  title?: string;
  frequency: OmMaintenanceFrequency;
  intervalDays?: number | null;
  nextDueAt?: string | null;
  assignedVendorLabel?: string | null;
  assignedToUserId?: string | null;
  meterType?: AssetMeterTypeApi | null;
  meterThreshold?: number | null;
};

export type OmMaintenanceUpdateBody = {
  title?: string;
  frequency?: OmMaintenanceFrequency;
  intervalDays?: number | null;
  nextDueAt?: string | null;
  assignedVendorLabel?: string | null;
  assignedToUserId?: string | null;
  isActive?: boolean;
  meterType?: AssetMeterTypeApi | null;
  meterThreshold?: number | null;
};

export async function createOmMaintenance(
  projectId: string,
  body: OmMaintenanceCreateBody,
): Promise<OmMaintenanceRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/maintenance`),
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
    throw new Error(
      typeof j.error === "string" ? j.error : "Could not create maintenance schedule.",
    );
  }
  return res.json() as Promise<OmMaintenanceRow>;
}

export async function patchOmMaintenance(
  projectId: string,
  scheduleId: string,
  body: OmMaintenanceUpdateBody,
): Promise<OmMaintenanceRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/maintenance/${encodeURIComponent(scheduleId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(
      typeof j.error === "string" ? j.error : "Could not update maintenance schedule.",
    );
  }
  return res.json() as Promise<OmMaintenanceRow>;
}

export async function postOmMaintenanceComplete(
  projectId: string,
  scheduleId: string,
  body?: { notes?: string; workOrderId?: string },
): Promise<OmMaintenanceRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/maintenance/${encodeURIComponent(scheduleId)}/complete`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body ?? {}),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not mark complete.");
  return res.json() as Promise<OmMaintenanceRow>;
}

export async function postOmGenerateWorkOrders(
  projectId: string,
): Promise<{ createdIds: string[]; existingIds: string[] }> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/maintenance/generate-work-orders`),
    { method: "POST", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not generate work orders.");
  return res.json() as Promise<{ createdIds: string[]; existingIds: string[] }>;
}

export async function postOmMaintenanceCreateWorkOrder(
  projectId: string,
  scheduleId: string,
): Promise<{ created: boolean; issueId: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/maintenance/${encodeURIComponent(scheduleId)}/create-work-order`,
    ),
    { method: "POST", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Could not create work order.");
  }
  return res.json() as Promise<{ created: boolean; issueId: string }>;
}

export type OmInspectionTemplateRow = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  frequency: string | null;
  checklistJson: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function fetchOmInspectionTemplates(
  projectId: string,
): Promise<OmInspectionTemplateRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/inspection-templates`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load inspection templates.");
  return res.json() as Promise<OmInspectionTemplateRow[]>;
}

export type OmInspectionRunRow = {
  id: string;
  projectId: string;
  templateId: string;
  status: string;
  resultJson: unknown;
  completedAt: string | null;
  template: { id: string; name: string };
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchOmInspectionRuns(projectId: string): Promise<OmInspectionRunRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/inspection-runs`),
    {
      credentials: "include",
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load inspection runs.");
  return res.json() as Promise<OmInspectionRunRow[]>;
}

export type OmInspectionChecklistItem = {
  id: string;
  label: string;
  type: "checkbox" | "passfail" | "text" | "photo";
  level?: string;
};

export async function deleteOmInspectionTemplate(
  projectId: string,
  templateId: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/inspection-templates/${encodeURIComponent(templateId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not delete template.");
  }
}

export async function postOmInspectionTemplate(
  projectId: string,
  body: {
    name: string;
    description?: string | null;
    frequency?: string | null;
    checklistJson: OmInspectionChecklistItem[];
  },
): Promise<OmInspectionTemplateRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/inspection-templates`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(
      typeof j.error === "string" ? j.error : "Could not create inspection template.",
    );
  }
  return j as OmInspectionTemplateRow;
}

export async function postOmInspectionRun(
  projectId: string,
  body: { templateId: string; resultJson?: unknown[] },
): Promise<OmInspectionRunRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/inspection-runs`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not start inspection.");
  }
  return j as OmInspectionRunRow;
}

export async function deleteOmInspectionRun(projectId: string, runId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/inspection-runs/${encodeURIComponent(runId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not delete inspection.");
  }
}

export async function patchOmInspectionRun(
  projectId: string,
  runId: string,
  body: {
    resultJson?: unknown[];
    attachmentsJson?: unknown[];
    status?: string;
    completedAt?: string | null;
  },
): Promise<OmInspectionRunRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/inspection-runs/${encodeURIComponent(runId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not save inspection.");
  }
  return j as OmInspectionRunRow;
}

export type OmInspectionRunCompleteResult = {
  id: string;
  status: string;
  workOrderIds: string[];
  reportPdfPath: string;
  completedAt: string;
  buildingOwnerNotify:
    | { sent: true }
    | { sent: false; skippedReason: "no_recipient" | "resend_not_configured" | "send_failed" };
};

export async function postOmInspectionRunComplete(
  projectId: string,
  runId: string,
  body: {
    resultJson: Array<{
      itemId: string;
      outcome: "pass" | "fail" | "na";
      note?: string;
      photoDataUrl?: string;
      photoFileName?: string;
      followUpIssueId?: string;
    }>;
    createWorkOrdersForFailures?: boolean;
  },
): Promise<OmInspectionRunCompleteResult> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/inspection-runs/${encodeURIComponent(runId)}/complete`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not complete inspection.");
  }
  return j as OmInspectionRunCompleteResult;
}

export function omInspectionRunReportPdfUrl(projectId: string, runId: string): string {
  return apiUrl(
    `/api/v1/projects/${encodeURIComponent(projectId)}/om/inspection-runs/${encodeURIComponent(runId)}/report.pdf`,
  );
}

export type OccupantTokenRow = {
  id: string;
  token: string;
  label: string;
  expiresAt: string | null;
  createdAt: string;
};

export async function fetchOccupantTokens(projectId: string): Promise<OccupantTokenRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/occupant-tokens`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load portal links.");
  return res.json() as Promise<OccupantTokenRow[]>;
}

export async function postOccupantToken(
  projectId: string,
  body?: { label?: string },
): Promise<OccupantTokenRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/occupant-tokens`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body ?? {}),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not create link.");
  return res.json() as Promise<OccupantTokenRow>;
}

export type RevokedOccupantTokenRow = {
  id: string;
  label: string;
  createdAt: string;
  revokedAt: string;
  tokenSuffix: string;
};

export async function fetchRevokedOccupantTokens(
  projectId: string,
): Promise<RevokedOccupantTokenRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/occupant-tokens/revoked`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load revoked links.");
  return res.json() as Promise<RevokedOccupantTokenRow[]>;
}

export async function revokeOccupantToken(projectId: string, tokenId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/occupant-tokens/${encodeURIComponent(tokenId)}/revoke`,
    ),
    { method: "POST", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not revoke link.");
  }
}

export async function downloadOccupantAssetQrCsv(projectId: string): Promise<void> {
  const res = await fetch(omOccupantAssetQrCsvUrl(projectId), { credentials: "include" });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof j.error === "string" ? j.error : "Could not download CSV.");
  }
  const blob = await res.blob();
  const dispo = res.headers.get("Content-Disposition");
  const match = dispo?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `occupant-asset-qr-${projectId.slice(0, 8)}.csv`;
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Public asset summary returned with occupant portal meta (no documents). */
export type OccupantPortalAssetMeta = {
  tag: string;
  name: string;
  category: string | null;
  locationLabel: string | null;
  hall: string | null;
  rowLabel: string | null;
  rack: string | null;
  positionU: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  notes: string | null;
  hasImage: boolean;
  level: string | null;
  /** Linked BIM element when the asset QR is bound to a 3D element. */
  element?: { name: string | null; ifcType: string | null } | null;
};

export type OccupantPortalMeta = {
  projectId: string;
  projectName: string;
  occupantHeadline?: string | null;
  asset: OccupantPortalAssetMeta | null;
};

export async function fetchOccupantMeta(
  token: string,
  opts?: { assetSecret?: string },
): Promise<OccupantPortalMeta> {
  const q = new URLSearchParams();
  if (opts?.assetSecret?.trim()) q.set("a", opts.assetSecret.trim());
  const qs = q.toString() ? `?${q.toString()}` : "";
  const res = await fetch(apiUrl(`/api/v1/occupant/${encodeURIComponent(token)}/meta${qs}`));
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Invalid link.");
  }
  return res.json() as Promise<OccupantPortalMeta>;
}

export async function fetchOccupantAssetImageUrl(
  token: string,
  assetSecret: string,
): Promise<string> {
  const q = new URLSearchParams({ a: assetSecret.trim() });
  const res = await fetch(
    apiUrl(`/api/v1/occupant/${encodeURIComponent(token)}/asset-image?${q.toString()}`),
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Could not load equipment photo.");
  }
  const j = (await res.json()) as { url?: unknown };
  if (typeof j.url !== "string" || !j.url) throw new Error("Could not load equipment photo.");
  return j.url;
}

export type OccupantSubmitResult = {
  ok: true;
  issueId: string;
  occupantPhotoToken: string;
  occupantPhotoExpiresAt: string;
};

export async function postOccupantSubmit(
  token: string,
  body: {
    description: string;
    floor?: string;
    room?: string;
    reporterName: string;
    reporterEmail: string;
    assetSecret?: string;
  },
): Promise<OccupantSubmitResult> {
  const res = await fetch(apiUrl(`/api/v1/occupant/${encodeURIComponent(token)}/submit`), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: unknown;
    ok?: boolean;
    issueId?: string;
    occupantPhotoToken?: string;
    occupantPhotoExpiresAt?: string;
  };
  if (!res.ok) {
    const err = j.error;
    const msg =
      typeof err === "string" ? err : Array.isArray(err) ? "Invalid request" : "Could not submit.";
    throw new Error(msg);
  }
  if (!j.issueId || !j.occupantPhotoToken || !j.occupantPhotoExpiresAt) {
    throw new Error("Invalid response.");
  }
  return {
    ok: true as const,
    issueId: j.issueId,
    occupantPhotoToken: j.occupantPhotoToken,
    occupantPhotoExpiresAt: j.occupantPhotoExpiresAt,
  };
}

export async function presignOccupantIssueReferencePhoto(
  portalToken: string,
  issueId: string,
  body: {
    occupantPhotoToken: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  },
): Promise<{ uploadUrl: string; key: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/occupant/${encodeURIComponent(portalToken)}/issues/${encodeURIComponent(issueId)}/reference-photos/presign`,
    ),
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    uploadUrl?: string;
    key?: string;
  };
  if (!res.ok) {
    throw new Error(j.error ?? "Could not start photo upload.");
  }
  if (!j.uploadUrl || !j.key) throw new Error("Invalid presign response.");
  return { uploadUrl: j.uploadUrl, key: j.key };
}

export async function completeOccupantIssueReferencePhoto(
  portalToken: string,
  issueId: string,
  body: {
    occupantPhotoToken: string;
    key: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  },
): Promise<{ ok: true; photoId: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/occupant/${encodeURIComponent(portalToken)}/issues/${encodeURIComponent(issueId)}/reference-photos/complete`,
    ),
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
    photoId?: string;
  };
  if (!res.ok) {
    throw new Error(j.error ?? "Could not save photo.");
  }
  if (!j.photoId) throw new Error("Invalid response.");
  return { ok: true as const, photoId: j.photoId };
}
