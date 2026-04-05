import type { MeResponse, WorkspaceRole } from "@/types/enterprise";
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

export type ProjectSessionModules = {
  issues: boolean;
  rfis: boolean;
  takeoff: boolean;
  proposals: boolean;
  punch: boolean;
  fieldReports: boolean;
};

export type ProjectSessionClientVisibility = {
  showIssues: boolean;
  showRfis: boolean;
  showFieldReports: boolean;
  showPunchList: boolean;
  allowClientComment: boolean;
};

export type ProjectSessionResponse = {
  projectId: string;
  projectName: string;
  workspaceId: string;
  workspaceRole: WorkspaceRole;
  isExternal: boolean;
  projectRole: string | null;
  trade: string | null;
  settings: {
    modules: ProjectSessionModules;
    clientVisibility: ProjectSessionClientVisibility;
  };
  uiMode: "internal" | "client" | "contractor" | "sub";
};

export async function fetchProjectSession(projectId: string): Promise<ProjectSessionResponse> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/session`), {
    credentials: "include",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Could not load project session.");
  }
  return res.json() as Promise<ProjectSessionResponse>;
}

export async function patchProjectSettings(
  projectId: string,
  body: {
    modules?: Partial<ProjectSessionModules>;
    clientVisibility?: Partial<ProjectSessionClientVisibility>;
  },
): Promise<{ projectId: string; settings: ProjectSessionResponse["settings"] }> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/settings`), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    projectId?: string;
    settings?: ProjectSessionResponse["settings"];
  };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not save project settings.");
  }
  if (!j.settings || !j.projectId) throw new Error("Invalid response.");
  return { projectId: j.projectId, settings: j.settings };
}

export type MeNotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string;
  readAt: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email?: string;
    image?: string | null;
  } | null;
};

export type MeNotificationsResponse = {
  unreadCount: number;
  items: MeNotificationRow[];
};

export async function fetchMeNotifications(limit = 30): Promise<MeNotificationsResponse> {
  const res = await fetch(
    apiUrl(`/api/v1/me/notifications?limit=${encodeURIComponent(String(limit))}`),
    { credentials: "include" },
  );
  if (res.status === 401) return { unreadCount: 0, items: [] };
  if (!res.ok) throw new Error("Could not load notifications.");
  return res.json() as Promise<MeNotificationsResponse>;
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const res = await fetch(apiUrl("/api/v1/me/notifications/read"), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Could not update notifications.");
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(apiUrl("/api/v1/me/notifications/read-all"), {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not mark all notifications read.");
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

export type FolderTemplateNode = {
  name: string;
  children?: FolderTemplateNode[];
};

/** Preset from `FolderStructureTemplate` — includes `tree` for UI preview before apply. */
export type FolderStructureTemplateWithTree = {
  id: string;
  name: string;
  description: string;
  tree: FolderTemplateNode[];
};

export async function fetchFolderStructureTemplates(
  workspaceId: string,
): Promise<FolderStructureTemplateWithTree[]> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/folder-structure-templates`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load folder templates.");
  return res.json() as Promise<FolderStructureTemplateWithTree[]>;
}

export type ApplyFolderStructureResult = {
  createdCount: number;
  reusedCount: number;
};

export async function applyFolderStructure(
  projectId: string,
  body: {
    targetParentId: string | null;
    source: { kind: "template"; templateId: string } | { kind: "project"; sourceProjectId: string };
  },
): Promise<ApplyFolderStructureResult> {
  const res = await fetch(apiUrl(`/api/v1/projects/${projectId}/folders/apply-structure`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & ApplyFolderStructureResult;
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not apply folder structure.",
    );
  }
  return {
    createdCount: data.createdCount,
    reusedCount: data.reusedCount,
  };
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

export type ProjectDashboardResponse = {
  activityLast14Days: { date: string; count: number }[];
};

export async function fetchProjectDashboard(projectId: string): Promise<ProjectDashboardResponse> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/dashboard`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load project dashboard.");
  return res.json() as Promise<ProjectDashboardResponse>;
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
    primaryColor?: string;
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
      throw new Error("Only the workspace owner (Super Admin) can update organization branding.");
    }
    const err = j.error;
    let text = "Could not save.";
    if (typeof err === "string") text = err;
    else if (err && typeof err === "object" && "formErrors" in err)
      text = "Check fields and try again.";
    throw new Error(text);
  }
}

/** Workspace row as returned by `workspaceJson` (e.g. after logo upload). */
export type WorkspaceBrandingJson = Record<string, unknown> & {
  id: string;
  logoUrl: string | null;
  storageQuotaBytes: string;
  storageUsedBytes: string;
};

/** Admin-only; stores logo in S3 and clears custom logo URL (website favicon unchanged until you save org form). */
export async function uploadWorkspaceLogo(
  workspaceId: string,
  file: File,
): Promise<WorkspaceBrandingJson> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch(apiUrl(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/logo`), {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<WorkspaceBrandingJson>;
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not upload logo.");
  if (!j.id || typeof j.storageQuotaBytes !== "string" || typeof j.storageUsedBytes !== "string") {
    throw new Error("Invalid response from logo upload.");
  }
  return j as WorkspaceBrandingJson;
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

export type EmailInviteKind = "INTERNAL" | "CLIENT" | "CONTRACTOR" | "SUBCONTRACTOR";

export type EmailInviteRow = {
  id: string;
  email: string;
  role: WorkspaceRole;
  inviteKind?: EmailInviteKind;
  trade?: string | null;
  inviteeName?: string | null;
  inviteeCompany?: string | null;
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
  /** Profile image URL when available (e.g. OAuth avatar). */
  image?: string | null;
  role: WorkspaceRole;
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
  role: WorkspaceRole,
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
    role?: WorkspaceRole;
    inviteKind?: EmailInviteKind;
    trade?: string;
    inviteeName?: string;
    inviteeCompany?: string;
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
  currency?: string;
  measurementSystem?: string;
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
  currency?: string;
  measurementSystem?: string;
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
  /** Profile image URL when available (e.g. OAuth avatar). */
  image?: string | null;
  workspaceRole: WorkspaceRole;
  access: "full" | "project";
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

export type RfiUserRef = { id: string; name: string; email: string };

export type RfiAttachmentRow = {
  id: string;
  rfiId: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  uploadedById: string | null;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
};

export type RfiIssueRef = {
  id: string;
  title: string;
  fileId: string;
  fileVersionId: string;
  pageNumber: number | null;
  sheetName: string | null;
  sheetVersion: number | null;
};

export type RfiRow = {
  id: string;
  projectId: string;
  rfiNumber: number;
  title: string;
  description: string | null;
  officialResponse: string | null;
  /** Designated answer message id (discussion thread). */
  answerMessageId?: string | null;
  answerMessage?: {
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; name: string; email: string; image: string | null } | null;
  } | null;
  status: string;
  fromDiscipline: string | null;
  /** Everyone designated to respond (any may submit the official answer). */
  assignees?: RfiUserRef[];
  assignedToUserId: string | null;
  /** First assignee; kept for list views and legacy use. */
  assignedTo: RfiUserRef | null;
  creatorId: string | null;
  creator: RfiUserRef | null;
  dueDate: string | null;
  priority: string;
  risk: string | null;
  /** Referenced site issues (many-to-many). */
  issues: RfiIssueRef[];
  fileId: string | null;
  file: { id: string; name: string } | null;
  fileVersionId: string | null;
  fileVersion: { id: string; version: number; fileId: string } | null;
  pageNumber: number | null;
  pinNormX: number | null;
  pinNormY: number | null;
  voidReason: string | null;
  lastOverdueNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: RfiAttachmentRow[];
};

export type RfiActivityRow = {
  id: string;
  type: string;
  createdAt: string;
  metadata: unknown;
  actor: { id: string; name: string; email: string; image: string | null } | null;
};

export type RfiMessageRow = {
  id: string;
  rfiId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string; image: string | null } | null;
};

export async function fetchProjectRfis(projectId: string): Promise<RfiRow[]> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/rfis`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load RFIs.");
  return res.json() as Promise<RfiRow[]>;
}

export async function fetchProjectRfi(projectId: string, rfiId: string): Promise<RfiRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/rfis/${encodeURIComponent(rfiId)}`),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Could not load RFI.");
  return res.json() as Promise<RfiRow>;
}

export async function fetchRfiActivity(
  projectId: string,
  rfiId: string,
): Promise<RfiActivityRow[]> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/rfis/${encodeURIComponent(rfiId)}/activity`,
    ),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Could not load RFI activity.");
  return res.json() as Promise<RfiActivityRow[]>;
}

export async function fetchRfiMessages(projectId: string, rfiId: string): Promise<RfiMessageRow[]> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/rfis/${encodeURIComponent(rfiId)}/messages`,
    ),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Could not load RFI messages.");
  return res.json() as Promise<RfiMessageRow[]>;
}

export async function postRfiMessage(
  projectId: string,
  rfiId: string,
  body: { body: string },
): Promise<RfiMessageRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/rfis/${encodeURIComponent(rfiId)}/messages`,
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
    const msg = typeof j.error === "string" ? j.error : "Could not post message.";
    throw new HttpError(res.status, msg);
  }
  return j as RfiMessageRow;
}

export async function createProjectRfi(
  projectId: string,
  body: {
    title: string;
    description: string;
    fromDiscipline?: string;
    assignedToUserId?: string;
    assigneeUserIds?: string[];
    dueDate?: string | null;
    priority?: "LOW" | "MEDIUM" | "HIGH";
    risk?: "low" | "med" | "high" | null;
    issueIds?: string[];
    fileId?: string;
    fileVersionId?: string;
    pageNumber?: number;
    pinNormX?: number;
    pinNormY?: number;
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

export async function patchProjectRfi(
  projectId: string,
  rfiId: string,
  body: Record<string, unknown>,
): Promise<RfiRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/rfis/${encodeURIComponent(rfiId)}`),
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
    const msg = typeof j.error === "string" ? j.error : "Could not update RFI.";
    throw new HttpError(res.status, msg);
  }
  return j as RfiRow;
}

export async function deleteProjectRfi(projectId: string, rfiId: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/rfis/${encodeURIComponent(rfiId)}`),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not delete RFI.");
}

export async function presignRfiAttachmentUpload(
  projectId: string,
  rfiId: string,
  body: { fileName: string; contentType?: string; sizeBytes: string | number | bigint },
): Promise<{ uploadUrl: string; key: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/rfis/${encodeURIComponent(rfiId)}/attachments/presign`,
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
          : "Could not presign upload.";
    throw new Error(msg);
  }
  return { uploadUrl: j.uploadUrl!, key: j.key! };
}

export async function completeRfiAttachmentUpload(
  projectId: string,
  rfiId: string,
  body: {
    key: string;
    fileName: string;
    mimeType?: string;
    sizeBytes: string | number | bigint;
  },
): Promise<RfiAttachmentRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/rfis/${encodeURIComponent(rfiId)}/attachments/complete`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({
        key: body.key,
        fileName: body.fileName,
        mimeType: body.mimeType ?? "application/octet-stream",
        sizeBytes: String(body.sizeBytes),
      }),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    const msg =
      typeof j.error === "string"
        ? j.error
        : res.status === 503
          ? "File storage is not configured on the server."
          : "Could not save attachment after upload.";
    throw new Error(msg);
  }
  return j as RfiAttachmentRow;
}

export async function deleteRfiAttachment(
  projectId: string,
  rfiId: string,
  attachmentId: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/rfis/${encodeURIComponent(rfiId)}/attachments/${encodeURIComponent(attachmentId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    const msg =
      typeof j.error === "string"
        ? j.error
        : res.status === 503
          ? "Could not delete file from storage."
          : "Could not remove attachment.";
    throw new Error(msg);
  }
}

export async function presignReadRfiAttachment(
  projectId: string,
  rfiId: string,
  attachmentId: string,
): Promise<string> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/rfis/${encodeURIComponent(rfiId)}/attachments/${encodeURIComponent(attachmentId)}/presign-read`,
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
          : "Could not open attachment.";
    throw new Error(msg);
  }
  if (!j.url) throw new Error("Could not open attachment.");
  return j.url;
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

// --- Issues (Pro, sheet-scoped) ---

export type IssueUserRef = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

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
  /** RFIs linked to this issue (many-to-many). */
  linkedRfis: { id: string; rfiNumber: number; title: string; status: string }[];
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
  rfiId?: string;
  rfiIds?: string[];
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
    /** Replace linked RFIs for this issue. */
    rfiIds?: string[];
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

async function sheetAiJson<T>(
  fileVersionId: string,
  aiPath: "ai/sheet-summary" | "ai/chat",
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

// --- Proposals ---

export type ProposalListRow = {
  id: string;
  sequenceNumber: number;
  reference: string;
  title: string;
  status: string;
  clientName: string;
  clientEmail: string;
  sentAt: string | null;
  total: string;
  currency: string;
  createdAt: string;
  createdByName: string;
};

export type ProposalsListResponse = {
  proposals: ProposalListRow[];
  stats: {
    pipelineTotal: string;
    accepted: number;
    sent: number;
    draft: number;
    declined: number;
  };
};

export type ProposalItemRow = {
  id: string;
  itemName: string;
  quantity: string;
  unit: string;
  rate: string;
  lineTotal: string;
  sortOrder: number;
  sourceTakeoffLineId: string | null;
};

export type ProposalDetail = {
  id: string;
  projectId: string;
  workspaceId: string;
  templateId: string | null;
  /** Linked takeoff sheet revisions (merge order matches this array). */
  sourceFileVersionIds?: string[];
  /** First linked revision; prefer sourceFileVersionIds */
  sourceFileVersionId: string | null;
  takeoffSources?: { fileVersionId: string; fileName: string; version: number }[];
  sequenceNumber: number;
  reference: string;
  title: string;
  status: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  clientPhone: string | null;
  validUntil: string;
  currency: string;
  subtotal: string;
  taxPercent: string;
  discount: string;
  total: string;
  coverNote: string;
  publicToken: string | null;
  signerName: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  declineComment: string | null;
  changeRequestComment: string | null;
  changeRequestedAt: string | null;
  sentAt: string | null;
  firstViewedAt: string | null;
  items: ProposalItemRow[];
  attachments: { fileVersionId: string; fileName: string; version: number }[];
  template: { id: string; name: string; defaultsJson: unknown } | null;
  createdBy: { id: string; name: string; email: string };
  workspaceName: string;
  /** Resolved URL for &lt;img src&gt; (hosted or external) */
  workspaceLogoUrl?: string | null;
  projectName: string;
  sourceFileVersion: { id: string; version: number; fileName: string } | null;
};

export async function fetchProposalTakeoffFileVersions(projectId: string): Promise<{
  fileVersions: { id: string; label: string; fileId: string; fileName: string; version: number }[];
}> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/proposals/takeoff-file-versions`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load takeoff versions.");
  return res.json() as Promise<{
    fileVersions: {
      id: string;
      label: string;
      fileId: string;
      fileName: string;
      version: number;
    }[];
  }>;
}

export async function fetchProposalsList(projectId: string): Promise<ProposalsListResponse> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/proposals`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load proposals.");
  return res.json() as Promise<ProposalsListResponse>;
}

export async function createProposal(
  projectId: string,
  body: {
    title: string;
    clientName: string;
    clientEmail: string;
    clientCompany?: string | null;
    clientPhone?: string | null;
    currency?: string;
    validUntil?: string;
    templateId?: string | null;
    sourceFileVersionId?: string | null;
  },
): Promise<ProposalDetail> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/proposals`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not create proposal.");
  return j as ProposalDetail;
}

export async function fetchProposalDetail(
  projectId: string,
  proposalId: string,
): Promise<ProposalDetail> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load proposal.");
  return res.json() as Promise<ProposalDetail>;
}

export async function patchProposal(
  projectId: string,
  proposalId: string,
  body: Record<string, unknown>,
): Promise<ProposalDetail> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not save proposal.");
  return j as ProposalDetail;
}

export async function syncProposalFromTakeoff(
  projectId: string,
  proposalId: string,
  fileVersionIds: string[],
  mode?: "replace" | "quantities_only",
): Promise<ProposalDetail> {
  const body =
    fileVersionIds.length === 1
      ? { fileVersionId: fileVersionIds[0]!, mode }
      : { fileVersionIds, mode };
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/items/sync-from-takeoff`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not sync takeoff.");
  return j as ProposalDetail;
}

export type ProposalPreviewPayload = {
  html: string;
  takeoffTableHtml: string;
  letterMarkdown: string;
  letterHtml: string | null;
};

export async function previewProposalHtml(
  projectId: string,
  proposalId: string,
): Promise<ProposalPreviewPayload> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/preview`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not preview.");
  return res.json() as Promise<ProposalPreviewPayload>;
}

export async function fetchProposalPdfBlob(projectId: string, proposalId: string): Promise<Blob> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/pdf`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load PDF.");
  return res.blob();
}

export async function sendProposalToClient(
  projectId: string,
  proposalId: string,
): Promise<ProposalDetail> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/send`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not send proposal.");
  return j as ProposalDetail;
}

export async function resendProposal(projectId: string, proposalId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/resend`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not resend.");
}

export async function duplicateProposal(
  projectId: string,
  proposalId: string,
): Promise<ProposalDetail> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/duplicate`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders, body: "{}" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not duplicate.");
  return res.json() as Promise<ProposalDetail>;
}

export async function deleteProposal(projectId: string, proposalId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok)
    throw new Error(typeof j.error === "string" ? j.error : "Could not delete proposal.");
}

export async function proposalAiDraft(
  projectId: string,
  proposalId: string,
  body: { userPrompt?: string; section?: "cover" | "executive_summary" },
): Promise<{ text: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/ai-draft`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string; text?: string };
  if (res.status === 503) throw new Error(j.error ?? "AI not configured.");
  if (!res.ok) throw new Error(j.error ?? "AI draft failed.");
  return { text: j.text ?? "" };
}

export type ProposalTemplateRow = {
  id: string;
  name: string;
  body: string;
  defaultsJson: unknown;
  updatedAt: string;
};

export async function fetchProposalTemplates(workspaceId: string): Promise<{
  templates: ProposalTemplateRow[];
}> {
  const res = await fetch(
    apiUrl(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/proposal-templates`),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Could not load templates.");
  return res.json() as Promise<{ templates: ProposalTemplateRow[] }>;
}

export async function createProposalTemplate(
  workspaceId: string,
  body: { name: string; body: string; defaultsJson?: Record<string, unknown> | null },
): Promise<{ id: string }> {
  const res = await fetch(
    apiUrl(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/proposal-templates`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error("Could not create template.");
  return res.json() as Promise<{ id: string }>;
}

export async function patchProposalTemplate(
  workspaceId: string,
  templateId: string,
  body: Partial<{ name: string; body: string; defaultsJson: Record<string, unknown> | null }>,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/proposal-templates/${encodeURIComponent(templateId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error("Could not save template.");
}

export async function deleteProposalTemplate(
  workspaceId: string,
  templateId: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/proposal-templates/${encodeURIComponent(templateId)}`,
    ),
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok) throw new Error("Could not delete template.");
}

export type PublicProposalPayload = {
  reference: string;
  title: string;
  status: string;
  workspaceName: string;
  workspaceLogoUrl?: string | null;
  clientName: string;
  validUntil: string;
  currency: string;
  coverHtml: string;
  subtotal: string;
  taxPercent: string;
  taxAmount: string;
  discount: string;
  total: string;
  items: ProposalItemRow[];
  attachments: {
    fileVersionId: string;
    fileName: string;
    version: number;
    readUrl: string | null;
  }[];
  expired: boolean;
};

export async function fetchPublicProposal(token: string): Promise<PublicProposalPayload> {
  const res = await fetch(apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}`), {
    credentials: "omit",
  });
  if (!res.ok) throw new Error("Proposal not found.");
  return res.json() as Promise<PublicProposalPayload>;
}

export async function postPublicProposalView(token: string): Promise<void> {
  await fetch(apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/view`), {
    method: "POST",
    credentials: "omit",
    headers: jsonHeaders,
    body: "{}",
  });
}

export async function postPublicProposalAccept(
  token: string,
  body: { signerName: string; signatureData: string },
): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/accept`), {
    method: "POST",
    credentials: "omit",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Could not accept.");
}

export async function postPublicProposalDecline(
  token: string,
  body: { reason: string; comment?: string | null },
): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/decline`), {
    method: "POST",
    credentials: "omit",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Could not decline.");
}

export async function postPublicProposalRequestChanges(
  token: string,
  comment: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/request-changes`),
    {
      method: "POST",
      credentials: "omit",
      headers: jsonHeaders,
      body: JSON.stringify({ comment }),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Could not submit.");
}

export async function fetchPublicProposalMessages(
  token: string,
): Promise<{ messages: { id: string; body: string; isFromClient: boolean; createdAt: string }[] }> {
  const res = await fetch(
    apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/messages`),
    {
      credentials: "omit",
    },
  );
  if (!res.ok) throw new Error("Could not load messages.");
  return res.json() as Promise<{
    messages: { id: string; body: string; isFromClient: boolean; createdAt: string }[];
  }>;
}

export async function postPublicProposalMessage(token: string, body: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/public/proposals/${encodeURIComponent(token)}/messages`),
    {
      method: "POST",
      credentials: "omit",
      headers: jsonHeaders,
      body: JSON.stringify({ body }),
    },
  );
  if (!res.ok) throw new Error("Could not send message.");
}

export async function downloadProposalPdf(projectId: string, proposalId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/pdf`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not download PDF.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `proposal-${proposalId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ProposalAnalyticsSummary = {
  totalProposals: number;
  accepted: number;
  declined: number;
  sent: number;
  winRate: number | null;
};

export async function fetchProposalAnalyticsSummary(
  projectId: string,
): Promise<ProposalAnalyticsSummary> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/proposals/analytics/summary`),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load analytics.");
  return res.json() as Promise<ProposalAnalyticsSummary>;
}

export type ProposalRevisionRow = {
  id: string;
  sentAt: string;
  snapshot: {
    reference?: string;
    title?: string;
    total?: string;
    subtotal?: string;
    taxPercent?: string;
    discount?: string;
    sentAt?: string;
  };
};

export async function fetchProposalRevisions(
  projectId: string,
  proposalId: string,
): Promise<{ revisions: ProposalRevisionRow[] }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/revisions`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load revisions.");
  return res.json() as Promise<{ revisions: ProposalRevisionRow[] }>;
}

export type ProposalPortalMessageRow = {
  id: string;
  body: string;
  isFromClient: boolean;
  createdAt: string;
};

export async function fetchProposalPortalMessages(
  projectId: string,
  proposalId: string,
): Promise<{ messages: ProposalPortalMessageRow[] }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/portal-messages`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not load messages.");
  return res.json() as Promise<{ messages: ProposalPortalMessageRow[] }>;
}

export async function postProposalPortalMessageStaff(
  projectId: string,
  proposalId: string,
  messageBody: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/portal-messages`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ body: messageBody }),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not send message.");
}

export async function downloadProposalCsvExport(
  projectId: string,
  proposalId: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/export-csv`,
    ),
    { credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not export CSV.");
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  let filename = `proposal-${proposalId}-lines.csv`;
  const m = cd?.match(/filename="([^"]+)"/);
  if (m?.[1]) filename = m[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ProposalRateHint = {
  itemName: string;
  avgRate: number;
  sampleSize: number;
  currency: string;
};

export async function fetchWorkspaceProposalRateHints(
  workspaceId: string,
  q: string,
): Promise<{ hints: ProposalRateHint[] }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/proposals/rate-hints?q=${encodeURIComponent(q)}`,
    ),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Could not load rate hints.");
  return res.json() as Promise<{ hints: ProposalRateHint[] }>;
}

export async function postProposalExternalSignExport(
  projectId: string,
  proposalId: string,
): Promise<{ configured: boolean; message?: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/proposals/${encodeURIComponent(proposalId)}/external-sign-export`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders },
  );
  const j = (await res.json().catch(() => ({}))) as {
    configured?: boolean;
    message?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(j.error ?? "Request failed.");
  return { configured: Boolean(j.configured), message: j.message };
}
