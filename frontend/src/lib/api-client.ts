import type { MeResponse } from "@/types/enterprise";
import type { Project } from "@/types/projects";
import type { ViewerStatePayload } from "@/lib/viewerStateCloud";
import { apiUrl } from "@/lib/api-url";

const jsonHeaders = { "Content-Type": "application/json" };

export async function fetchMe(): Promise<MeResponse | null> {
  const res = await fetch(apiUrl("/api/v1/me"), { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Could not load session.");
  return res.json() as Promise<MeResponse>;
}

export class ProRequiredError extends Error {
  readonly code = "PRO" as const;
  constructor() {
    super("Pro subscription required");
    this.name = "ProRequiredError";
  }
}

/** API error with HTTP status (e.g. 409 sheet lock). */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** User-facing message for issue mutations; adds lock hint on 409. */
export function formatIssueLockHint(error: unknown): string {
  if (error instanceof HttpError && error.status === 409) {
    return `${error.message} Take the sheet lock in the viewer (or wait), then try again.`;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export async function fetchProjects(workspaceId: string): Promise<Project[]> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/projects`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load projects.");
  return res.json() as Promise<Project[]>;
}

export type DashboardResponse = {
  workspace: {
    id: string;
    name: string;
    storageUsedBytes: string;
    storageQuotaBytes: string;
    subscriptionStatus: string | null;
  };
  projectCount: number;
  /** PDFs across all projects in the workspace */
  fileCount?: number;
  /** Workspace members (seats) */
  memberCount?: number;
  issuesByStatus: { status: string; _count: number }[];
  recentActivity: {
    id: string;
    type: string;
    createdAt: string;
    actor: { name: string; email: string } | null;
  }[];
  /** UTC date (YYYY-MM-DD) → activity log events that day */
  activityLast14Days?: { date: string; count: number }[];
};

export async function fetchDashboard(workspaceId: string): Promise<DashboardResponse> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/dashboard`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load dashboard.");
  return res.json() as Promise<DashboardResponse>;
}

export type InviteRow = {
  id: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  createdAt: string;
};

export async function fetchInvites(workspaceId: string): Promise<InviteRow[]> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/invites`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load invites.");
  const data = (await res.json()) as { invites?: InviteRow[] };
  return data.invites ?? [];
}

export async function patchWorkspace(
  workspaceId: string,
  body: {
    name: string;
    slug: string;
    logoUrl: string | null;
    description: string | null;
    website: string | null;
  },
): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}`), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error("Only admins can update the organization.");
    }
    const err = j.error;
    let text = "Could not save.";
    if (typeof err === "string") text = err;
    else if (err && typeof err === "object" && "formErrors" in err)
      text = "Check fields and try again.";
    throw new Error(text);
  }
}

export type CreateInviteResponse = {
  id: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
};

export async function createInvite(
  workspaceId: string,
  expiresInDays: number,
): Promise<CreateInviteResponse> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/invites`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ expiresInDays }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<CreateInviteResponse>;
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(j.error ?? "Could not create invite.");
  return j as CreateInviteResponse;
}

export async function revokeInvite(workspaceId: string, inviteId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/invites/${inviteId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not revoke invite.");
}

export type EmailInviteRow = {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  projects: { id: string; name: string }[];
};

export async function fetchEmailInvites(
  workspaceId: string,
  options?: { forProjectId?: string },
): Promise<EmailInviteRow[]> {
  const q = options?.forProjectId
    ? `?forProjectId=${encodeURIComponent(options.forProjectId)}`
    : "";
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/email-invites${q}`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load email invites.");
  const data = (await res.json()) as { invites?: EmailInviteRow[] };
  return data.invites ?? [];
}

export type WorkspaceMemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  /** Present for workspace admins only. Empty = full workspace; non-empty = limited to these projects. */
  scopedProjects?: { id: string; name: string }[];
};

export type WorkspaceMembersResponse = {
  maxSeats: number;
  seatPressure: number;
  members: WorkspaceMemberRow[];
};

export async function fetchWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMembersResponse> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/members`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load members.");
  return res.json() as Promise<WorkspaceMembersResponse>;
}

export async function patchWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: "ADMIN" | "MEMBER",
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/workspaces/${workspaceId}/members/${encodeURIComponent(userId)}`),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ role }),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not update role.");
  }
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not remove from project.");
  }
}

export async function sendProjectEmailInvite(
  workspaceId: string,
  body: {
    email: string;
    projectIds: string[];
    role?: "ADMIN" | "MEMBER";
    expiresInDays?: number;
  },
): Promise<{ id: string; email: string; expiresAt: string }> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/email-invites`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    id?: string;
    email?: string;
    expiresAt?: string;
  };
  if (res.status === 402) throw new ProRequiredError();
  if (res.status === 503) {
    throw new Error(j.error ?? "Email is not configured on the server.");
  }
  if (!res.ok) throw new Error(j.error ?? "Could not send invite.");
  return j as { id: string; email: string; expiresAt: string };
}

export async function revokeEmailInvite(workspaceId: string, inviteId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/email-invites/${inviteId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not revoke invite.");
}

export async function patchEmailInviteProjects(
  workspaceId: string,
  inviteId: string,
  projectIds: string[],
): Promise<EmailInviteRow> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/email-invites/${inviteId}`), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ projectIds }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; invite?: EmailInviteRow };
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not update invite projects.");
  if (!j.invite) throw new Error("Invalid response.");
  return j.invite;
}

export async function resendEmailInvite(workspaceId: string, inviteId: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/workspaces/${workspaceId}/email-invites/${inviteId}/resend`),
    {
      method: "POST",
      credentials: "include",
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 503) throw new Error(j.error ?? "Email is not configured.");
  if (!res.ok) throw new Error(j.error ?? "Could not resend invite.");
}

export async function patchWorkspaceMemberProjectAccess(
  workspaceId: string,
  userId: string,
  projectIds: string[],
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/workspaces/${workspaceId}/members/${encodeURIComponent(userId)}/project-access`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ projectIds }),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not update project access.");
  }
}

export async function removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/workspaces/${workspaceId}/members/${encodeURIComponent(userId)}`),
    { method: "DELETE", credentials: "include" },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not remove member.");
  }
}

/** Pro cloud: load persisted markups / measurements / calibration for a file revision. */
export async function fetchViewerState(fileVersionId: string): Promise<unknown | null> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/viewer-state`),
    { credentials: "include" },
  );
  if (res.status === 404) return null;
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Could not load viewer state.");
  }
  const j = (await res.json()) as { viewerState?: unknown | null };
  return j.viewerState ?? null;
}

/** Pro cloud: persist viewer state (debounced by caller). */
export async function putViewerState(
  fileVersionId: string,
  body: ViewerStatePayload,
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/viewer-state`),
    {
      method: "PUT",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Could not save viewer state.");
  }
}

/** When `/viewer` has `fileId` (+ optional `version`) but no `fileVersionId`, resolve the revision row for Pro sync (takeoff publish, viewer-state). */
export async function fetchResolvedFileRevision(
  fileId: string,
  version?: number,
): Promise<{ fileVersionId: string; version: number; projectId: string }> {
  const q =
    version != null && Number.isFinite(version)
      ? `?version=${encodeURIComponent(String(version))}`
      : "";
  const res = await fetch(
    apiUrl(`/api/v1/files/${encodeURIComponent(fileId)}/resolved-revision${q}`),
    {
      credentials: "include",
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    fileVersionId?: string;
    version?: number;
    projectId?: string;
  };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not resolve sheet revision.");
  }
  if (!j.fileVersionId || j.projectId == null || j.version == null) {
    throw new Error("Invalid resolve response.");
  }
  return {
    fileVersionId: j.fileVersionId,
    version: j.version,
    projectId: j.projectId,
  };
}

export type ProjectMeta = {
  id: string;
  name: string;
  workspaceId: string;
  projectNumber?: string | null;
  localBudget?: string | null;
  projectSize?: string | null;
  projectType?: string | null;
  location?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  stage?: string;
  progressPercent?: number;
  startDate?: string | null;
  endDate?: string | null;
};

export type PatchProjectBody = {
  name?: string;
  projectNumber?: string | null;
  localBudget?: number | string | null;
  projectSize?: string | null;
  projectType?: string | null;
  location?: string | null;
  websiteUrl?: string | null;
  stage?: string;
  progressPercent?: number;
  startDate?: string | null;
  endDate?: string | null;
};

export async function patchProject(
  projectId: string,
  body: PatchProjectBody,
): Promise<ProjectMeta> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}`), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown } & Partial<ProjectMeta>;
  if (!res.ok) {
    const err = j.error;
    const msg = typeof err === "string" ? err : "Could not update project.";
    throw new Error(msg);
  }
  return j as ProjectMeta;
}

export async function fetchProject(projectId: string): Promise<ProjectMeta> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load project.");
  return res.json() as Promise<ProjectMeta>;
}

export type ProjectTeamMemberRow = {
  userId: string;
  name: string;
  email: string;
  workspaceRole: "ADMIN" | "MEMBER";
  access: "full_workspace" | "project_only" | "no_access";
  canRemoveFromProject: boolean;
};

export type ProjectTeamResponse = {
  maxSeats: number;
  seatPressure: number;
  members: ProjectTeamMemberRow[];
};

export async function fetchProjectTeam(projectId: string): Promise<ProjectTeamResponse> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/team`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load project team.");
  return res.json() as Promise<ProjectTeamResponse>;
}

export type RfiRow = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  fromDiscipline: string | null;
  dueDate: string | null;
  risk: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchProjectRfis(projectId: string): Promise<RfiRow[]> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/rfis`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load RFIs.");
  return res.json() as Promise<RfiRow[]>;
}

export async function createProjectRfi(
  projectId: string,
  body: {
    title: string;
    description?: string;
    fromDiscipline?: string;
    risk?: "low" | "med" | "high" | null;
  },
): Promise<RfiRow> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/rfis`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not create RFI.");
  return j as RfiRow;
}

export type PunchRow = {
  id: string;
  projectId: string;
  location: string;
  trade: string;
  priority: string;
  status: string;
  notes: string | null;
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
  body: { location: string; trade: string; notes?: string },
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

export type FieldReportRow = {
  id: string;
  projectId: string;
  reportDate: string;
  weather: string | null;
  authorLabel: string | null;
  photoCount: number;
  issueCount: number;
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

// --- Issues (Pro, sheet-scoped) ---

export type IssueUserRef = { id: string; name: string; email: string };

export type IssueRow = {
  id: string;
  workspaceId: string;
  projectId: string;
  fileId: string;
  fileVersionId: string;
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
  assigneeId: string | null;
  creatorId: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: IssueUserRef | null;
  creator: IssueUserRef | null;
  file: { name: string };
  fileVersion: { version: number };
};

export async function fetchIssuesForFileVersion(fileVersionId: string): Promise<IssueRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/issues`),
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
  opts?: { fileVersionId?: string },
): Promise<IssueRow[]> {
  const q = opts?.fileVersionId ? `?fileVersionId=${encodeURIComponent(opts.fileVersionId)}` : "";
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

export async function createIssue(body: {
  workspaceId: string;
  fileId: string;
  fileVersionId: string;
  title: string;
  description?: string;
  annotationId?: string;
  assigneeId?: string;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  location?: string | null;
  pageNumber?: number;
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
    priority?: string;
    startDate?: string | null;
    dueDate?: string | null;
    location?: string | null;
    pageNumber?: number | null;
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

/** Relative URL to open the viewer on this issue (same sheet revision). */
export function viewerHrefForIssue(row: IssueRow): string {
  const q = new URLSearchParams();
  q.set("fileId", row.fileId);
  q.set("name", row.file.name);
  q.set("projectId", row.projectId);
  q.set("fileVersionId", row.fileVersionId);
  q.set("version", String(row.fileVersion.version));
  q.set("issueId", row.id);
  return `/viewer?${q.toString()}`;
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
