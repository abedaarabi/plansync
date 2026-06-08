/**
 * Workspace members, invites, viewer state, and RFI endpoints.
 */
import type { WorkspaceRole } from "@/types/enterprise";
import type { ViewerStatePayload } from "@/lib/viewerStateCloud";
import { apiUrl } from "@/lib/api-url";
import { getViewerCollabRevision, setViewerCollabRevision } from "@/lib/viewerCollabRevision";
import { jsonHeaders, readJsonErrorBody, readJsonOrEmpty } from "./shared";
import { HttpError, ProRequiredError } from "./errors";

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
  /** Hard cap on members + pending seat pressure (anti-abuse). */
  maxSeats: number;
  /** Seats included in base subscription price. */
  includedSeats: number;
  /** USD per month for each seat above `includedSeats`. */
  extraSeatMonthlyUsd: number;
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

/** Thrown when server revision does not match `baseRevision` (concurrent edit). */
export class ViewerStateConflictError extends Error {
  readonly currentRevision: number;
  readonly viewerState: unknown;
  constructor(currentRevision: number, viewerState: unknown) {
    super("revision_conflict");
    this.name = "ViewerStateConflictError";
    this.currentRevision = currentRevision;
    this.viewerState = viewerState;
  }
}

/** Pro cloud: load persisted markups / measurements / calibration for a file revision. */
export async function fetchViewerState(fileVersionId: string): Promise<{
  viewerState: unknown | null;
  revision: number;
}> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/viewer-state`),
    { credentials: "include" },
  );
  if (res.status === 404) return { viewerState: null, revision: 0 };
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Could not load viewer state.");
  }
  const j = (await res.json()) as { viewerState?: unknown | null; revision?: number };
  const revision = typeof j.revision === "number" ? j.revision : 0;
  return { viewerState: j.viewerState ?? null, revision };
}

/** Pro cloud: persist viewer state (debounced by caller). */
export async function putViewerState(
  fileVersionId: string,
  body: ViewerStatePayload,
  opts?: { skipRevisionCheck?: boolean },
): Promise<{ revision: number }> {
  const payload: Record<string, unknown> = { ...body };
  if (!opts?.skipRevisionCheck) {
    const br = getViewerCollabRevision();
    if (br >= 0) payload.baseRevision = br;
  }
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/viewer-state`),
    {
      method: "PUT",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (res.status === 409) {
    const j = (await res.json().catch(() => ({}))) as {
      currentRevision?: number;
      viewerState?: unknown;
    };
    throw new ViewerStateConflictError(j.currentRevision ?? 0, j.viewerState ?? null);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Could not save viewer state.");
  }
  const j = (await res.json().catch(() => ({}))) as { revision?: number };
  const revision = typeof j.revision === "number" ? j.revision : 0;
  setViewerCollabRevision(revision);
  return { revision };
}

export async function postViewerCollabHeartbeat(
  fileVersionId: string,
  connectionId: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/viewer-collab/heartbeat`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ connectionId }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Heartbeat failed.");
  }
}

/** Session host only; notifies all viewers to disconnect live collaboration. */
export async function postViewerCollabEndSession(fileVersionId: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/viewer-collab/end-session`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: "{}",
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    const err = j.error;
    const msg = typeof err === "string" ? err : "Could not end session.";
    throw new Error(msg);
  }
}

/**
 * Best-effort notify server to drop this SSE collab connection immediately (tab close / navigate).
 * Uses `keepalive` so the request can finish while the page tears down.
 */
export function postViewerCollabLeaveKeepalive(fileVersionId: string, connectionId: string): void {
  try {
    void fetch(
      apiUrl(`/api/v1/file-versions/${encodeURIComponent(fileVersionId)}/viewer-collab/leave`),
      {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders,
        body: JSON.stringify({ connectionId }),
        keepalive: true,
      },
    ).catch(() => {
      /* best-effort during unload / HMR; Failed to fetch must not be unhandled */
    });
  } catch {
    /* ignore sync errors from fetch() */
  }
}

export async function patchMeViewerPresence(hideViewerPresence: boolean): Promise<void> {
  const res = await fetch(apiUrl("/api/v1/me/viewer-presence"), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ hideViewerPresence }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not update presence.");
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

export type TakeoffPricingPublic = {
  projectDiscountPct: string;
  itemDiscountPctByKey: Record<string, string>;
};

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
  latitude?: number | null;
  longitude?: number | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  stage?: string;
  progressPercent?: number;
  startDate?: string | null;
  endDate?: string | null;
  takeoffPricing?: TakeoffPricingPublic;
  operationsMode?: boolean;
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
  latitude?: number | null;
  longitude?: number | null;
  websiteUrl?: string | null;
  stage?: string;
  progressPercent?: number;
  startDate?: string | null;
  endDate?: string | null;
  takeoffPricing?: {
    projectDiscountPct?: string | number;
    itemDiscountPctByKey?: Record<string, string | number>;
  };
  /** Super Admin only — enables O&M experience for this project. */
  operationsMode?: boolean;
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

export async function deleteProject(projectId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    const err = j.error;
    const msg = typeof err === "string" ? err : "Could not delete project.";
    throw new Error(msg);
  }
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
  includedSeats: number;
  extraSeatMonthlyUsd: number;
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
