/**
 * Punch list, field reports, and materials endpoints.
 */
import { apiUrl } from "@/lib/api-url";
import { jsonHeaders, readJsonErrorBody } from "./shared";
import { HttpError, ProRequiredError } from "./errors";

export type PunchReferencePhotoRow = {
  id: string;
  s3Key: string;
  fileName: string;
  contentType?: string;
  createdAt: string;
  sizeBytes: number;
};

export type PunchRow = {
  id: string;
  projectId: string;
  punchNumber: number;
  title: string;
  location: string;
  trade: string;
  priority: string;
  status: string;
  assigneeId: string | null;
  assignees?: { id: string; name: string; email: string; image: string | null }[];
  dueDate: string | null;
  completedAt: string | null;
  templateId: string | null;
  assignee: { id: string; name: string; email: string; image: string | null } | null;
  fileId?: string | null;
  file?: { id: string; name: string } | null;
  fileVersionId?: string | null;
  fileVersion?: { id: string; version: number; fileId: string } | null;
  pageNumber?: number | null;
  notes: string | null;
  referencePhotos?: PunchReferencePhotoRow[];
  createdAt: string;
  updatedAt: string;
};

export type PunchTemplateRow = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  itemsJson: unknown;
  isArchived: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchProjectPunch(projectId: string): Promise<PunchRow[]> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/punch`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load punch list.");
  return res.json() as Promise<PunchRow[]>;
}

export async function createPunchItem(
  projectId: string,
  body: {
    title?: string;
    location: string;
    trade: string;
    notes?: string;
    priority?: string;
    status?: string;
    assigneeId?: string | null;
    assigneeIds?: string[];
    fileId?: string | null;
    fileVersionId?: string | null;
    pageNumber?: number | null;
    dueDateYmd?: string | null;
    templateId?: string | null;
  },
): Promise<PunchRow> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/punch`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not create item.");
  return j as PunchRow;
}

export async function patchPunchItem(
  projectId: string,
  punchId: string,
  body: {
    title?: string;
    location?: string;
    trade?: string;
    notes?: string | null;
    priority?: string;
    status?: string;
    assigneeId?: string | null;
    assigneeIds?: string[] | null;
    fileId?: string | null;
    fileVersionId?: string | null;
    pageNumber?: number | null;
    dueDateYmd?: string | null;
    referencePhotos?: PunchReferencePhotoRow[] | null;
  },
): Promise<PunchRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/punch/${encodeURIComponent(punchId)}`,
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
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not update item.");
  return j as PunchRow;
}

export async function deletePunchItem(projectId: string, punchId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/punch/${encodeURIComponent(punchId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not delete item.");
}

export async function bulkPatchPunchItems(
  projectId: string,
  body: { ids: string[]; assigneeId?: string | null; status?: string },
): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/punch/bulk`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not apply bulk action.");
}

export function punchExportCsvUrl(projectId: string): string {
  return apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/punch/export.csv`);
}

export async function presignPunchPhotoUpload(
  projectId: string,
  punchId: string,
  body: { fileName: string; contentType?: string; sizeBytes: string | number | bigint },
): Promise<{ uploadUrl: string; key: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/punch/${encodeURIComponent(punchId)}/photos/presign`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({
        fileName: body.fileName,
        contentType: body.contentType ?? "application/octet-stream",
        sizeBytes: String(body.sizeBytes),
      }),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as {
    error?: unknown;
    uploadUrl?: string;
    key?: string;
  };
  if (!res.ok) {
    const err = j.error;
    const msg =
      typeof err === "string"
        ? err
        : res.status === 503
          ? "File uploads are not configured (S3). Set AWS_* and S3_BUCKET on the server."
          : "Could not presign punch photo upload.";
    throw new Error(msg);
  }
  return { uploadUrl: j.uploadUrl!, key: j.key! };
}

export async function completePunchPhotoUpload(
  projectId: string,
  punchId: string,
  body: {
    key: string;
    fileName: string;
    contentType?: string;
    sizeBytes: string | number | bigint;
  },
): Promise<PunchRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/punch/${encodeURIComponent(punchId)}/photos/complete`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({
        key: body.key,
        fileName: body.fileName,
        contentType: body.contentType ?? "image/jpeg",
        sizeBytes: String(body.sizeBytes),
      }),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown } & Partial<PunchRow>;
  if (!res.ok) {
    const msg =
      typeof j.error === "string"
        ? j.error
        : res.status === 503
          ? "File storage is not configured on the server."
          : "Could not save punch photo after upload.";
    throw new HttpError(res.status, msg);
  }
  return j as PunchRow;
}

export async function presignReadPunchPhoto(
  projectId: string,
  punchId: string,
  photoId: string,
): Promise<string> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/punch/${encodeURIComponent(punchId)}/photos/${encodeURIComponent(photoId)}/presign-read`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown; url?: string };
  if (!res.ok) {
    const msg =
      typeof j.error === "string"
        ? j.error
        : res.status === 503
          ? "File storage is not configured."
          : "Could not open punch photo.";
    throw new Error(msg);
  }
  if (!j.url) throw new Error("Could not open punch photo.");
  return j.url;
}

export async function fetchPunchTemplates(projectId: string): Promise<PunchTemplateRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/punch/templates`),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Could not load punch templates.");
  return res.json() as Promise<PunchTemplateRow[]>;
}

export async function createPunchTemplate(
  projectId: string,
  body: {
    name: string;
    description?: string;
    scope?: "WORKSPACE" | "PROJECT";
    items: Array<{
      title: string;
      location: string;
      trade: string;
      priority?: "P1" | "P2" | "P3";
      notes?: string;
    }>;
  },
): Promise<PunchTemplateRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/punch/templates`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not create template.");
  return j as PunchTemplateRow;
}

export async function applyPunchTemplate(
  projectId: string,
  templateId: string,
): Promise<{ created: number }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/punch/templates/${encodeURIComponent(templateId)}/apply`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown; created?: number };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not apply template.");
  return { created: typeof j.created === "number" ? j.created : 0 };
}

export type FieldReportRow = {
  id: string;
  projectId: string;
  reportDate: string;
  reportKind: "DAILY" | "WEEKLY";
  status: "DRAFT" | "SUBMITTED";
  totalWorkers: number;
  details: unknown | null;
  weather: string | null;
  authorLabel: string | null;
  photoCount: number;
  issueCount: number;
  lastEmailedAt: string | null;
  emailSentCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchProjectFieldReports(projectId: string): Promise<FieldReportRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/field-reports`),
    {
      credentials: "include",
    },
  );
  if (!res.ok) throw new Error("Could not load field reports.");
  return res.json() as Promise<FieldReportRow[]>;
}

export async function createFieldReport(
  projectId: string,
  body: {
    reportDate: string;
    reportKind?: "DAILY" | "WEEKLY";
    status?: "DRAFT" | "SUBMITTED";
    totalWorkers?: number;
    details?: unknown;
    weather?: string;
    authorLabel?: string;
    photoCount?: number;
    issueCount?: number;
    notes?: string;
  },
): Promise<FieldReportRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/field-reports`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not create report.");
  return j as FieldReportRow;
}

export async function patchFieldReport(
  projectId: string,
  reportId: string,
  body: Partial<{
    reportDate: string;
    reportKind: "DAILY" | "WEEKLY";
    status: "DRAFT" | "SUBMITTED";
    totalWorkers: number;
    details: unknown | null;
    weather: string | null;
    authorLabel: string | null;
    photoCount: number;
    issueCount: number;
    notes: string | null;
  }>,
): Promise<FieldReportRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/field-reports/${encodeURIComponent(reportId)}`,
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
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not update report.");
  return j as FieldReportRow;
}

export async function deleteFieldReport(projectId: string, reportId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/field-reports/${encodeURIComponent(reportId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not delete report.");
}

export type FieldReportSendInclude = {
  weather: boolean;
  workers: boolean;
  completed: boolean;
  delays: boolean;
  photos: boolean;
  materials: boolean;
};

export async function sendFieldReportEmail(
  projectId: string,
  body: {
    mode: "daily" | "weekly";
    reportId?: string;
    weekEndingFriday?: string;
    recipients: string[];
    message?: string;
    include: FieldReportSendInclude;
  },
): Promise<{ ok: true; sent: number }> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/field-reports/send-email`),
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
    detail?: unknown;
    sent?: number;
  };
  if (!res.ok) {
    if (res.status === 503 && j.error === "email_not_configured") {
      throw new Error(
        "Outbound email is not configured. Add RESEND_API_KEY and RESEND_FROM on the server.",
      );
    }
    if (res.status === 409 && j.error === "already_emailed") {
      throw new Error("This report has already been emailed.");
    }
    const err = typeof j.error === "string" ? j.error : "Could not send email.";
    const detail = typeof j.detail === "string" ? j.detail : "";
    throw new Error(detail ? `${err}: ${detail}` : err);
  }
  return { ok: true as const, sent: typeof j.sent === "number" ? j.sent : body.recipients.length };
}

export type MaterialCustomFieldType = "text" | "number" | "currency";

export type MaterialTemplateField = {
  id: string;
  key: string;
  label: string;
  type: MaterialCustomFieldType;
  required: boolean;
  order: number;
};

export type MaterialTemplate = {
  version: number;
  fields: MaterialTemplateField[];
};

export type MaterialRow = {
  id: string;
  workspaceId: string;
  categoryId: string;
  name: string;
  sku: string | null;
  unit: string;
  unitPrice: string | null;
  currency: string;
  supplier: string | null;
  manufacturer: string | null;
  specification: string | null;
  notes: string | null;
  customAttributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string };
};

export type MaterialCategoryRow = {
  id: string;
  name: string;
  nameKey: string;
  createdAt: string;
  updatedAt: string;
};

export type MaterialsPagedResponse = {
  items: MaterialRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function fetchMaterials(workspaceId: string): Promise<MaterialRow[]> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/materials`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load materials.");
  return res.json() as Promise<MaterialRow[]>;
}

export async function fetchMaterialsPaged(
  workspaceId: string,
  options: { page: number; pageSize: number; q?: string; categoryId?: string },
): Promise<MaterialsPagedResponse> {
  const sp = new URLSearchParams();
  sp.set("page", String(options.page));
  sp.set("pageSize", String(options.pageSize));
  if (options.q?.trim()) sp.set("q", options.q.trim());
  if (options.categoryId?.trim()) sp.set("categoryId", options.categoryId.trim());
  const res = await fetch(
    apiUrl(`/api/v1/workspaces/${workspaceId}/materials/paged?${sp.toString()}`),
    {
      credentials: "include",
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load materials.");
  return res.json() as Promise<MaterialsPagedResponse>;
}

export async function fetchMaterialCategories(workspaceId: string): Promise<MaterialCategoryRow[]> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/materials/categories`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load material categories.");
  return res.json() as Promise<MaterialCategoryRow[]>;
}

export async function fetchMaterialTemplate(workspaceId: string): Promise<MaterialTemplate> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/material-template`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load material template.");
  return res.json() as Promise<MaterialTemplate>;
}

export async function patchMaterialTemplate(
  workspaceId: string,
  template: MaterialTemplate,
): Promise<MaterialTemplate> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/material-template`), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({
      version: template.version,
      fields: template.fields.map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        order: f.order,
      })),
    }),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not save material template.");
  return j as MaterialTemplate;
}

export async function createMaterial(
  workspaceId: string,
  body: {
    materialType: string;
    name: string;
    sku?: string | null;
    unit?: string;
    unitPrice?: number | string | null;
    currency?: string;
    supplier?: string | null;
    manufacturer?: string | null;
    specification?: string | null;
    notes?: string | null;
    customAttributes?: Record<string, unknown>;
  },
): Promise<MaterialRow> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/materials`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not save material.");
  return j as MaterialRow;
}

export async function patchMaterial(
  workspaceId: string,
  materialId: string,
  body: Partial<{
    materialType: string;
    name: string;
    sku: string | null;
    unit: string;
    unitPrice: number | string | null;
    currency: string;
    supplier: string | null;
    manufacturer: string | null;
    specification: string | null;
    notes: string | null;
    customAttributes?: Record<string, unknown>;
  }>,
): Promise<MaterialRow> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/materials/${materialId}`), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not update material.");
  return j as MaterialRow;
}

export async function deleteMaterial(workspaceId: string, materialId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/materials/${materialId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not delete material.");
}

export async function downloadMaterialsTemplate(workspaceId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/materials/template`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not download template.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plansync-materials-template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export type MaterialsImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  rowCount: number;
  warnings?: string[];
};

export async function importMaterialsExcel(
  workspaceId: string,
  file: File,
): Promise<MaterialsImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/materials/import`), {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const j = (await res.json().catch(() => ({}))) as MaterialsImportResult & {
    error?: string;
    details?: string[];
  };
  if (res.status === 402) throw new ProRequiredError();
  if (res.status === 400) {
    const msg = j.details?.length ? j.details.join(" ") : (j.error ?? "Import failed.");
    throw new Error(msg);
  }
  if (!res.ok) throw new Error(j.error ?? "Import failed.");
  return j as MaterialsImportResult;
}
