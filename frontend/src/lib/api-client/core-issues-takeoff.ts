/**
 * Issues, Sheet AI, and takeoff endpoints.
 */
import { apiUrl } from "@/lib/api-url";
import { jsonHeaders, readJsonErrorBody } from "./shared";
import { HttpError, ProRequiredError } from "./errors";
import type { RfiRow } from "./core-members-viewer-rfi";

// --- Issues (Pro, sheet-scoped) ---

export type IssueUserRef = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

/** On-image markups for an issue reference photo (normalized 0–1 coordinates). */
export type IssuePhotoSketchV1 = {
  v: 1;
  strokes: Array<{
    id: string;
    tool: "pen" | "line" | "rect";
    color: string;
    sw: number;
    pts: { x: number; y: number }[];
  }>;
};

export type IssueReferencePhotoRow = {
  id: string;
  s3Key: string;
  fileName: string;
  contentType?: string;
  createdAt: string;
  sizeBytes: number;
  sketch?: IssuePhotoSketchV1 | null;
};

export type IssueRow = {
  id: string;
  workspaceId: string;
  projectId: string;
  fileId: string | null;
  fileVersionId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  location?: string | null;
  sheetName?: string | null;
  sheetVersion?: number | null;
  pageNumber?: number | null;
  annotationId: string | null;
  /** Extra viewer annotation ids linked to this issue (same sheet revision), not the pin. */
  attachedMarkupAnnotationIds?: string[];
  /** Reference images (with optional sketch JSON) attached to the issue. */
  referencePhotos?: IssueReferencePhotoRow[];
  assigneeId: string | null;
  creatorId: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: IssueUserRef | null;
  creator: IssueUserRef | null;
  file: { name: string } | null;
  fileVersion: { version: number } | null;
  /** RFIs linked to this issue (many-to-many). */
  linkedRfis: { id: string; rfiNumber: number; title: string; status: string }[];
  issueKind?: string;
  assetId?: string | null;
  asset?: { id: string; tag: string; name: string } | null;
  externalAssigneeEmail?: string | null;
  externalAssigneeName?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
};

export type IssueKindApi = "WORK_ORDER" | "CONSTRUCTION" | "OCCUPANT";

export async function fetchIssuesForFileVersion(
  fileVersionId: string,
  opts?: { issueKind?: IssueKindApi; issueKinds?: IssueKindApi[] },
): Promise<IssueRow[]> {
  const params = new URLSearchParams();
  if (opts?.issueKinds?.length) params.set("issueKinds", opts.issueKinds.join(","));
  else if (opts?.issueKind) params.set("issueKind", opts.issueKind);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/issues${q}`),
    {
      credentials: "include",
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load issues.");
  return res.json() as Promise<IssueRow[]>;
}

export async function fetchIssuesForProject(
  projectId: string,
  opts?: {
    fileVersionId?: string;
    assetId?: string;
    issueKind?: IssueKindApi;
    issueKinds?: IssueKindApi[];
  },
): Promise<IssueRow[]> {
  const params = new URLSearchParams();
  if (opts?.fileVersionId) params.set("fileVersionId", opts.fileVersionId);
  if (opts?.assetId) params.set("assetId", opts.assetId);
  if (opts?.issueKinds?.length) params.set("issueKinds", opts.issueKinds.join(","));
  else if (opts?.issueKind) params.set("issueKind", opts.issueKind);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/issues${q}`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load issues.");
  return res.json() as Promise<IssueRow[]>;
}

export async function fetchIssue(issueId: string): Promise<IssueRow> {
  const res = await fetch(apiUrl(`/api/v1/issues/${encodeURIComponent(issueId)}`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load issue.");
  return res.json() as Promise<IssueRow>;
}

/** MIME for S3 PUT + API validation (mobile cameras often omit type or use HEIC). */
export function issueReferencePhotoContentType(file: File): string {
  const raw = file.type?.trim().toLowerCase() || "";
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
  ]);
  if (allowed.has(raw)) return raw;
  const n = file.name.toLowerCase();
  if (n.endsWith(".heic")) return "image/heic";
  if (n.endsWith(".heif")) return "image/heif";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** Presign PUT, upload to S3, then complete — returns the updated issue row. */
export async function uploadIssueReferencePhotoFile(
  issueId: string,
  file: File,
): Promise<IssueRow> {
  const contentType = issueReferencePhotoContentType(file);
  const { uploadUrl, key } = await presignIssueReferencePhotoUpload(issueId, {
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
  return completeIssueReferencePhotoUpload(issueId, {
    key,
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
  });
}

export async function presignIssueReferencePhotoUpload(
  issueId: string,
  body: { fileName: string; contentType?: string; sizeBytes: string | number | bigint },
): Promise<{ uploadUrl: string; key: string }> {
  const res = await fetch(
    apiUrl(`/api/v1/issues/${encodeURIComponent(issueId)}/reference-photos/presign`),
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
          : "Could not presign reference photo upload.";
    throw new Error(msg);
  }
  return { uploadUrl: j.uploadUrl!, key: j.key! };
}

export async function completeIssueReferencePhotoUpload(
  issueId: string,
  body: {
    key: string;
    fileName: string;
    contentType?: string;
    sizeBytes: string | number | bigint;
  },
): Promise<IssueRow> {
  const res = await fetch(
    apiUrl(`/api/v1/issues/${encodeURIComponent(issueId)}/reference-photos/complete`),
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
  const j = (await res.json().catch(() => ({}))) as { error?: unknown } & Partial<IssueRow>;
  if (!res.ok) {
    const msg =
      typeof j.error === "string"
        ? j.error
        : res.status === 503
          ? "File storage is not configured on the server."
          : "Could not save reference photo after upload.";
    throw new HttpError(res.status, msg);
  }
  return j as IssueRow;
}

export async function presignReadIssueReferencePhoto(
  issueId: string,
  photoId: string,
): Promise<string> {
  const res = await fetch(
    apiUrl(
      `/api/v1/issues/${encodeURIComponent(issueId)}/reference-photos/${encodeURIComponent(photoId)}/presign-read`,
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
          : "Could not open reference photo.";
    throw new Error(msg);
  }
  if (!j.url) throw new Error("Could not open reference photo.");
  return j.url;
}

export async function createIssue(body: {
  workspaceId: string;
  projectId?: string;
  fileId?: string;
  fileVersionId?: string;
  title: string;
  description?: string;
  annotationId?: string;
  attachedMarkupAnnotationIds?: string[];
  assigneeId?: string;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  location?: string | null;
  pageNumber?: number;
  rfiId?: string;
  rfiIds?: string[];
  issueKind?: "WORK_ORDER" | "CONSTRUCTION";
  assetId?: string;
  externalAssigneeEmail?: string;
  externalAssigneeName?: string;
}): Promise<IssueRow> {
  const res = await fetch(apiUrl("/api/v1/issues"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown } & Partial<IssueRow>;
  if (!res.ok) {
    const msg = typeof j.error === "string" ? j.error : "Could not create issue.";
    throw new HttpError(res.status, msg);
  }
  return j as IssueRow;
}

export async function patchIssue(
  issueId: string,
  body: {
    status?: string;
    title?: string;
    description?: string | null;
    assigneeId?: string | null;
    annotationId?: string | null;
    attachedMarkupAnnotationIds?: string[] | null;
    /** Replace reference photos; send `null` to remove all. Omit to leave unchanged. */
    referencePhotos?: IssueReferencePhotoRow[] | null;
    priority?: string;
    startDate?: string | null;
    dueDate?: string | null;
    location?: string | null;
    pageNumber?: number | null;
    /** Replace linked RFIs for this issue. */
    rfiIds?: string[];
    issueKind?: IssueKindApi;
    assetId?: string | null;
    externalAssigneeEmail?: string | null;
    externalAssigneeName?: string | null;
  },
): Promise<IssueRow> {
  const res = await fetch(apiUrl(`/api/v1/issues/${encodeURIComponent(issueId)}`), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown } & Partial<IssueRow>;
  if (!res.ok) {
    const msg = typeof j.error === "string" ? j.error : "Could not update issue.";
    throw new HttpError(res.status, msg);
  }
  return j as IssueRow;
}

export async function deleteIssue(issueId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/issues/${encodeURIComponent(issueId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    const msg = typeof j.error === "string" ? j.error : "Could not delete issue.";
    throw new HttpError(res.status, msg);
  }
}

/** Relative URL to open the viewer on a cloud file revision. */
export function viewerHrefForCloudRevision(input: {
  fileId: string;
  fileName: string;
  projectId: string;
  fileVersionId: string;
  version: number;
}): string {
  const q = new URLSearchParams();
  q.set("fileId", input.fileId);
  q.set("name", input.fileName);
  q.set("projectId", input.projectId);
  q.set("fileVersionId", input.fileVersionId);
  q.set("version", String(input.version));
  return `/viewer?${q.toString()}`;
}

/** Open viewer on this revision; when the line came from sheet takeoff, zoom to the zone. */
export function viewerHrefForTakeoffLine(row: TakeoffLineRow): string {
  const q = new URLSearchParams();
  q.set("fileId", row.fileId);
  q.set("name", row.fileName);
  q.set("projectId", row.projectId);
  q.set("fileVersionId", row.fileVersionId);
  q.set("version", String(row.fileVersion));
  const zid = row.sourceZoneId?.trim();
  if (zid) q.set("takeoffZoneId", zid);
  return `/viewer?${q.toString()}`;
}

/** Relative URL to open the viewer on this issue (same sheet revision), or null when no sheet is linked. */
export function viewerHrefForIssue(row: IssueRow): string | null {
  if (!row.fileId || !row.fileVersionId || !row.file || !row.fileVersion) return null;
  const q = new URLSearchParams();
  q.set("fileId", row.fileId);
  q.set("name", row.file.name);
  q.set("projectId", row.projectId);
  q.set("fileVersionId", row.fileVersionId);
  q.set("version", String(row.fileVersion.version));
  q.set("issueId", row.id);
  return `/viewer?${q.toString()}`;
}

/** RFI drawing link; passes `issueId` for the first referenced issue when present (viewer zoom). */
export function viewerHrefForRfi(rfi: RfiRow, projectId: string): string | null {
  const ref = rfi.issues[0];
  const fileId = rfi.fileId ?? ref?.fileId ?? null;
  const fileVersionId = rfi.fileVersionId ?? ref?.fileVersionId ?? null;
  if (!fileId || !fileVersionId) return null;
  const q = new URLSearchParams();
  q.set("fileId", fileId);
  q.set("fileVersionId", fileVersionId);
  q.set("projectId", projectId);
  q.set("name", rfi.file?.name ?? ref?.sheetName ?? "Sheet");
  const ver = rfi.fileVersion?.version ?? ref?.sheetVersion;
  if (ver != null && Number.isFinite(Number(ver))) q.set("version", String(ver));
  const issueId = ref?.id;
  if (issueId) q.set("issueId", issueId);
  else if (rfi.pageNumber != null) q.set("page", String(rfi.pageNumber));
  return `/viewer?${q.toString()}`;
}

// --- Sheet AI (Gemini, Pro) ---

export type SheetAiViewerSnapshot = Record<string, unknown>;

export type SheetAiContextPayload = {
  pageIndex: number;
  imageBase64: string;
  mimeType: "image/png" | "image/jpeg";
  viewerSnapshot?: SheetAiViewerSnapshot;
  pdfTextSnippet?: string;
};

export type SheetAiChatMessage = { role: "user" | "model"; content: string };

/** AI sheet summary — clickable regions on the captured page (normalized 0–1). */
export type SheetAiTocKind =
  | "area"
  | "detail"
  | "note"
  | "schedule"
  | "title_block"
  | "legend"
  | "mep"
  | "envelope"
  | "structure"
  | "other";

export type SheetAiTocEntry = {
  title: string;
  /** Readable text from that region (detail ref, note line, etc.). */
  snippet?: string;
  kind?: SheetAiTocKind;
  pageIndex: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Row from smart sheet analysis (element label + what was read). */
export type SheetAiReadingRow = {
  element: string;
  detail: string;
  kind?: SheetAiTocKind;
};

/** Takeoff Assist — vision-detected categories on the current sheet page. */
export type TakeoffAssistCategory = "windows" | "doors" | "walls" | "rooms";

export type TakeoffAssistItem = {
  category: TakeoffAssistCategory;
  pageIndex: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  label?: string;
};

export type TakeoffAssistCachePayload = {
  categories: TakeoffAssistCategory[];
  counts: Partial<Record<TakeoffAssistCategory, number>>;
  items: TakeoffAssistItem[];
};

async function sheetAiJson<T>(
  fileVersionId: string,
  aiPath: "ai/sheet-summary" | "ai/chat" | "ai/takeoff-detect",
  body: unknown,
): Promise<T> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/${aiPath}`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (res.status === 503) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Sheet AI is not configured.");
  }
  const j = (await res.json().catch(() => ({}))) as { error?: unknown } & Partial<T>;
  if (!res.ok) {
    const msg = typeof j.error === "string" ? j.error : "Sheet AI request failed.";
    throw new HttpError(res.status, msg);
  }
  return j as T;
}

export type SheetAiSheetCacheResponse =
  | { cached: false }
  | {
      cached: true;
      summaryMarkdown: string;
      readingsTable: SheetAiReadingRow[];
      tableOfContents: SheetAiTocEntry[];
      chatMessages: SheetAiChatMessage[];
      takeoffAssist?: TakeoffAssistCachePayload;
      updatedAt: string;
    };

export async function fetchSheetAiSheetCache(
  fileVersionId: string,
  pageIndex0: number,
): Promise<SheetAiSheetCacheResponse> {
  const res = await fetch(
    apiUrl(
      `/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/ai/sheet-cache?pageIndex=${encodeURIComponent(String(pageIndex0))}`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (res.status === 503) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Sheet AI is not configured.");
  }
  const j = (await res.json().catch(() => ({}))) as {
    error?: unknown;
  } & Partial<SheetAiSheetCacheResponse>;
  if (!res.ok) {
    const msg = typeof j.error === "string" ? j.error : "Could not load Sheet AI cache.";
    throw new HttpError(res.status, msg);
  }
  return j as SheetAiSheetCacheResponse;
}

export async function fetchSheetAiSummary(
  fileVersionId: string,
  body: SheetAiContextPayload,
): Promise<{
  summaryMarkdown: string;
  readingsTable: SheetAiReadingRow[];
  tableOfContents: SheetAiTocEntry[];
}> {
  return sheetAiJson<{
    summaryMarkdown: string;
    readingsTable: SheetAiReadingRow[];
    tableOfContents: SheetAiTocEntry[];
  }>(fileVersionId, "ai/sheet-summary", body);
}

export async function fetchSheetAiChat(
  fileVersionId: string,
  body: SheetAiContextPayload & { messages: SheetAiChatMessage[] },
): Promise<{ reply: string }> {
  return sheetAiJson<{ reply: string }>(fileVersionId, "ai/chat", body);
}

export async function fetchTakeoffAssistDetect(
  fileVersionId: string,
  body: SheetAiContextPayload & { categories: TakeoffAssistCategory[] },
): Promise<{ takeoffAssist: TakeoffAssistCachePayload }> {
  return sheetAiJson<{ takeoffAssist: TakeoffAssistCachePayload }>(
    fileVersionId,
    "ai/takeoff-detect",
    body,
  );
}

// --- Takeoff lines (Pro) ---

export type TakeoffLineRow = {
  id: string;
  workspaceId: string;
  projectId: string;
  fileId: string;
  fileVersionId: string;
  fileVersion: number;
  fileName: string;
  materialId: string | null;
  label: string;
  quantity: string;
  unit: string;
  notes: string | null;
  sourceType?: string;
  sourceFileVersionAtCreate?: number | null;
  revisionMismatch?: boolean;
  latestFileVersion?: number;
  sourceZoneId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  material: {
    id: string;
    name: string;
    unit: string;
    unitPrice: string | null;
    currency: string;
    categoryName: string;
  } | null;
};

export type TakeoffSyncPreview = {
  mode: "merge" | "replace";
  sourceFileVersionIds: string[];
  counts: { added: number; updated: number; removed: number };
  sample?: {
    added?: Array<Record<string, unknown>>;
    updated?: Array<Record<string, unknown>>;
  };
};

export type TakeoffSyncApplyResult = {
  ok: boolean;
  syncRunId: string;
  snapshotId?: string;
  counts: { added: number; updated: number; removed: number };
};

export type TakeoffSyncHistoryRow = {
  id: string;
  mode: string;
  addedCount: number;
  updatedCount: number;
  removedCount: number;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string };
};

export type TakeoffSnapshotRow = {
  id: string;
  reason: string;
  createdAt: string;
};

export type TakeoffViewPresetRow = {
  id: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  name: string;
  isDefault: boolean;
  configJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function fetchTakeoffLinesForFileVersion(
  fileVersionId: string,
): Promise<TakeoffLineRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/takeoff-lines`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load takeoff.");
  return res.json() as Promise<TakeoffLineRow[]>;
}

export async function fetchTakeoffLinesForProject(projectId: string): Promise<TakeoffLineRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/takeoff-lines`),
    {
      credentials: "include",
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load takeoff.");
  return res.json() as Promise<TakeoffLineRow[]>;
}

export async function previewTakeoffSync(projectId: string): Promise<TakeoffSyncPreview> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/takeoff/sync/preview`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: "{}",
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not preview sync.");
  return j as TakeoffSyncPreview;
}

export async function applyTakeoffSync(
  projectId: string,
  body: { mode: "merge" | "replace"; protectManualEdits?: boolean },
): Promise<TakeoffSyncApplyResult> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/takeoff/sync/apply`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not apply sync.");
  return j as TakeoffSyncApplyResult;
}

export async function fetchTakeoffSyncHistory(projectId: string): Promise<TakeoffSyncHistoryRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/takeoff/sync-history`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load takeoff sync history.");
  return res.json() as Promise<TakeoffSyncHistoryRow[]>;
}

export async function restoreTakeoffSnapshot(projectId: string, snapshotId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/takeoff/snapshots/${encodeURIComponent(snapshotId)}/restore`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not restore snapshot.");
}

export async function fetchTakeoffSnapshots(projectId: string): Promise<TakeoffSnapshotRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/takeoff/snapshots`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load takeoff snapshots.");
  return res.json() as Promise<TakeoffSnapshotRow[]>;
}

export async function fetchTakeoffViews(projectId: string): Promise<TakeoffViewPresetRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/takeoff/views`),
    {
      credentials: "include",
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load takeoff views.");
  return res.json() as Promise<TakeoffViewPresetRow[]>;
}

export async function createTakeoffView(
  projectId: string,
  body: { name: string; isDefault?: boolean; configJson: Record<string, unknown> },
): Promise<TakeoffViewPresetRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/takeoff/views`),
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
    throw new Error(typeof j.error === "string" ? j.error : "Could not save takeoff view.");
  return j as TakeoffViewPresetRow;
}

export async function patchTakeoffView(
  projectId: string,
  viewId: string,
  body: { name?: string; isDefault?: boolean; configJson?: Record<string, unknown> },
): Promise<TakeoffViewPresetRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/takeoff/views/${encodeURIComponent(viewId)}`,
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
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not update takeoff view.");
  return j as TakeoffViewPresetRow;
}

export async function deleteTakeoffView(projectId: string, viewId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/takeoff/views/${encodeURIComponent(viewId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not delete takeoff view.");
}

export async function bulkTakeoffAction(
  projectId: string,
  body: { ids: string[]; action: "delete" | "set_tags" | "set_rate_placeholder"; tags?: string[] },
): Promise<{ ok: boolean; affected: number }> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/takeoff/bulk`),
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
    ok?: boolean;
    affected?: number;
  };
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not apply bulk action.");
  return { ok: Boolean(j.ok), affected: Number(j.affected ?? 0) };
}

/** Adds a catalog-backed line to project takeoff (anchor file = latest revision in project). */
export async function createProjectTakeoffLineFromMaterial(
  projectId: string,
  body: {
    materialId: string;
    quantity?: number | string;
    label?: string;
    unit?: string;
    notes?: string;
    tags?: string[];
  },
): Promise<TakeoffLineRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/takeoff-lines`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as TakeoffLineRow & { error?: unknown };
  if (!res.ok) {
    const e = j.error;
    const msg =
      typeof e === "string"
        ? e
        : e != null && typeof e === "object"
          ? JSON.stringify(e)
          : "Could not add line to takeoff.";
    throw new Error(msg);
  }
  return j as TakeoffLineRow;
}

export async function createTakeoffLine(
  fileVersionId: string,
  body: {
    materialId?: string;
    label?: string;
    quantity: number | string;
    unit?: string;
    notes?: string;
    sourceZoneId?: string;
    tags?: string[];
  },
): Promise<TakeoffLineRow> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/takeoff-lines`),
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
    const e = j.error;
    let msg = "Could not add takeoff line.";
    if (typeof e === "string") msg = e;
    else if (e != null && typeof e === "object") {
      try {
        msg = JSON.stringify(e);
      } catch {
        msg = "Could not add takeoff line.";
      }
    }
    throw new Error(msg);
  }
  return j as TakeoffLineRow;
}

export async function patchTakeoffLine(
  takeoffLineId: string,
  body: {
    materialId?: string | null;
    label?: string;
    quantity?: number | string;
    unit?: string;
    notes?: string | null;
    tags?: string[];
  },
): Promise<TakeoffLineRow> {
  const res = await fetch(apiUrl(`/api/v1/takeoff-lines/${encodeURIComponent(takeoffLineId)}`), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not update takeoff line.");
  }
  return j as TakeoffLineRow;
}

export async function deleteTakeoffLine(takeoffLineId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/takeoff-lines/${encodeURIComponent(takeoffLineId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not delete takeoff line.");
}

export type UploadPreviewRow = {
  clientName: string;
  kind: "new_version" | "new_sheet";
  score: number;
  matchedFile: { id: string; name: string } | null;
  fromFileVersionId: string | null;
  currentMaxVersion: number | null;
  nextVersion: number;
  issueCountOnLatestVersion: number;
};

export async function previewUploadMatches(input: {
  projectId: string;
  folderId: string | null;
  candidates: { clientName: string }[];
}): Promise<{ rows: UploadPreviewRow[] }> {
  const res = await fetch(apiUrl(`/api/v1/projects/${input.projectId}/uploads/preview`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({
      folderId: input.folderId,
      candidates: input.candidates,
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; rows?: UploadPreviewRow[] };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(j.error ?? "Could not preview upload matches.");
  return { rows: j.rows ?? [] };
}

export async function carryForwardIssues(
  newFileVersionId: string,
  fromFileVersionId: string,
): Promise<{ copiedIssueCount: number; idempotent: boolean }> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${newFileVersionId}/issues/carry-forward`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ fromFileVersionId }),
    },
  );
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    copiedIssueCount?: number;
    idempotent?: boolean;
  };
  if (!res.ok) throw new Error(j.error ?? "Could not carry issues forward.");
  return {
    copiedIssueCount: j.copiedIssueCount ?? 0,
    idempotent: Boolean(j.idempotent),
  };
}
