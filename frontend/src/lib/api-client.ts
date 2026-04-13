import type { MeResponse, WorkspaceRole } from "@/types/enterprise";
import type { Project } from "@/types/projects";
import type { ViewerStatePayload } from "@/lib/viewerStateCloud";
import { apiUrl } from "@/lib/api-url";
import { getViewerCollabRevision, setViewerCollabRevision } from "@/lib/viewerCollabRevision";

const jsonHeaders = { "Content-Type": "application/json" };

function readJsonErrorBody(j: Record<string, unknown>, res: Response, fallback: string): string {
  const err = j.error;
  if (typeof err === "string" && err.trim()) return err;
  const msg = j.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  return `${fallback} (HTTP ${res.status})`;
}

export async function fetchMe(): Promise<MeResponse | null> {
  const res = await fetch(apiUrl("/api/v1/me"), { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) {
    let msg = `Could not load session (HTTP ${res.status}).`;
    try {
      const j = (await res.json()) as { error?: string };
      if (typeof j.error === "string" && j.error.trim()) msg = j.error;
    } catch {
      /* empty or non-JSON body */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<MeResponse>;
}

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  storageQuotaBytes: string;
  storageUsedBytes: string;
  subscriptionStatus?: string | null;
};

export async function createWorkspace(name: string, slug: string): Promise<WorkspaceSummary> {
  const res = await fetch(apiUrl("/api/v1/workspaces"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ name, slug }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: { formErrors?: string[] } | string;
  } & WorkspaceSummary;
  if (!res.ok) {
    const message =
      typeof j.error === "string"
        ? j.error
        : Array.isArray(j.error?.formErrors) && j.error.formErrors[0]
          ? j.error.formErrors[0]
          : "Could not create workspace.";
    throw new Error(message);
  }
  return j;
}

export type ProjectSessionModules = {
  issues: boolean;
  rfis: boolean;
  takeoff: boolean;
  proposals: boolean;
  punch: boolean;
  fieldReports: boolean;
  omAssets: boolean;
  omMaintenance: boolean;
  omInspections: boolean;
  omTenantPortal: boolean;
  schedule: boolean;
};

export type ProjectSessionClientVisibility = {
  showIssues: boolean;
  showRfis: boolean;
  showFieldReports: boolean;
  showPunchList: boolean;
  allowClientComment: boolean;
};

export type ProjectSessionOmHandover = {
  notes: string;
  handoverCompletedAt: string | null;
  buildingLabel: string | null;
  facilityManagerUserId: string | null;
  handoverDate: string | null;
  transferAsBuilt: boolean;
  transferClosedIssues: boolean;
  transferPunch: boolean;
  transferTeamAccess: boolean;
  handoverWizardCompletedAt: string | null;
  /** Inspection complete → PDF emailed to this address (Resend). */
  buildingOwnerEmail: string | null;
};

export type ProjectSessionResponse = {
  projectId: string;
  projectName: string;
  workspaceId: string;
  workspaceRole: WorkspaceRole;
  isExternal: boolean;
  projectRole: string | null;
  trade: string | null;
  /** When true, project is in Operations & Maintenance mode (sidebar + O&M modules). */
  operationsMode: boolean;
  settings: {
    modules: ProjectSessionModules;
    clientVisibility: ProjectSessionClientVisibility;
    omHandover: ProjectSessionOmHandover;
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
    omHandover?: Partial<ProjectSessionOmHandover>;
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

export type ScheduleTaskStatus = "not_started" | "in_progress" | "delayed" | "completed";

export type ScheduleTaskRow = {
  id: string;
  title: string;
  parentId: string | null;
  sortOrder: number;
  startDate: string;
  endDate: string;
  isMilestone: boolean;
  progressPercent: number;
  status: ScheduleTaskStatus;
  /** Linked quantity takeoff line ids (same project). */
  takeoffLineIds: string[];
  updatedAt: string;
};

export type ScheduleTaskInput = Omit<ScheduleTaskRow, "updatedAt">;

export async function fetchProjectSchedule(projectId: string): Promise<ScheduleTaskRow[]> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/schedule`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (res.status === 403) throw new Error("You don’t have access to the schedule.");
  if (!res.ok) throw new Error("Could not load schedule.");
  return res.json() as Promise<ScheduleTaskRow[]>;
}

export async function putProjectSchedule(
  projectId: string,
  body: { tasks: ScheduleTaskInput[] },
): Promise<ScheduleTaskRow[]> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/schedule`), {
    method: "PUT",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Could not save schedule.");
  }
  return res.json() as Promise<ScheduleTaskRow[]>;
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
    viewerCollaborationEnabled?: boolean;
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

/** Super Admin — Stripe Checkout for PlanSync Pro or Enterprise (subscription). Returns to `/dashboard` after pay. */
export async function createStripeCheckoutSession(
  workspaceId: string,
  plan: "pro" | "enterprise" = "pro",
): Promise<{ url: string }> {
  const res = await fetch(apiUrl("/api/stripe/checkout"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ workspaceId, plan }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown> & { url?: string };
  if (res.status === 503) {
    throw new Error("Billing is not configured. Add Stripe keys to the API environment.");
  }
  if (res.status === 401) {
    throw new Error(readJsonErrorBody(j, res, "Sign in again to continue"));
  }
  if (res.status === 403) {
    const msg = typeof j.error === "string" ? j.error : "";
    if (msg === "Email verification required") {
      throw new Error("Verify your email address before subscribing.");
    }
    throw new Error("Only the workspace owner (Super Admin) can manage billing.");
  }
  if (!res.ok) {
    throw new Error(readJsonErrorBody(j, res, "Could not start checkout"));
  }
  if (!j.url || typeof j.url !== "string") throw new Error("No checkout URL returned.");
  return { url: j.url };
}

/** After Checkout success, links the workspace to Stripe when webhooks are not available (e.g. local dev). */
export async function syncStripeCheckoutSession(sessionId: string): Promise<void> {
  const res = await fetch(apiUrl("/api/stripe/sync-checkout-session"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ sessionId }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 503) {
    throw new Error("Billing is not configured.");
  }
  if (res.status === 401) {
    throw new Error(readJsonErrorBody(j, res, "Sign in again to continue"));
  }
  if (res.status === 403) {
    const msg = typeof j.error === "string" ? j.error : "";
    if (msg === "Email verification required") {
      throw new Error("Verify your email address first.");
    }
    throw new Error("Only the workspace owner can confirm checkout.");
  }
  if (!res.ok) {
    throw new Error(readJsonErrorBody(j, res, "Could not confirm checkout"));
  }
}

/** Super Admin — Stripe Customer Portal (payment method, invoices, cancel). */
export async function createStripePortalSession(workspaceId: string): Promise<{ url: string }> {
  const res = await fetch(apiUrl("/api/stripe/portal"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ workspaceId }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown> & { url?: string };
  if (res.status === 503) {
    throw new Error("Billing is not configured. Add Stripe keys to the API environment.");
  }
  if (res.status === 401) {
    throw new Error(readJsonErrorBody(j, res, "Sign in again to continue"));
  }
  if (res.status === 403) {
    const msg = typeof j.error === "string" ? j.error : "";
    if (msg === "Email verification required") {
      throw new Error("Verify your email address before opening billing.");
    }
    throw new Error("Only the workspace owner (Super Admin) can manage billing.");
  }
  if (!res.ok) {
    throw new Error(readJsonErrorBody(j, res, "Could not open billing portal"));
  }
  if (!j.url || typeof j.url !== "string") throw new Error("No portal URL returned.");
  return { url: j.url };
}

/** Super Admin — switch existing Stripe subscription between Pro and Enterprise (same subscription, prorated). */
export async function changeWorkspaceSubscriptionPlan(
  workspaceId: string,
  plan: "pro" | "enterprise",
): Promise<{ alreadyOnPlan: boolean; plan: "pro" | "enterprise" }> {
  const res = await fetch(apiUrl("/api/stripe/change-subscription-plan"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ workspaceId, plan }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    alreadyOnPlan?: boolean;
    plan?: "pro" | "enterprise";
  };
  if (res.status === 503) {
    throw new Error("Billing is not configured. Add Stripe keys to the API environment.");
  }
  if (res.status === 401) {
    throw new Error(readJsonErrorBody(j, res, "Sign in again to continue"));
  }
  if (res.status === 403) {
    throw new Error("Only the workspace Super Admin can change the plan.");
  }
  if (!res.ok) {
    throw new Error(readJsonErrorBody(j, res, "Could not change plan"));
  }
  const outPlan = j.plan === "pro" || j.plan === "enterprise" ? j.plan : plan;
  return { alreadyOnPlan: j.alreadyOnPlan === true, plan: outPlan };
}

/** Super Admin — cancel Stripe subscription in-app (default: at period end). */
export async function cancelWorkspaceStripeSubscription(
  workspaceId: string,
  options?: { immediate?: boolean },
): Promise<{
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  status: string;
}> {
  const res = await fetch(apiUrl("/api/stripe/cancel-subscription"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ workspaceId, immediate: options?.immediate === true }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
    status?: string;
  };
  if (res.status === 503) {
    throw new Error("Billing is not configured. Add Stripe keys to the API environment.");
  }
  if (res.status === 401) {
    throw new Error(readJsonErrorBody(j, res, "Sign in again to continue"));
  }
  if (res.status === 403) {
    throw new Error("Only the workspace Super Admin can cancel the subscription.");
  }
  if (!res.ok) {
    throw new Error(readJsonErrorBody(j, res, "Could not cancel subscription"));
  }
  return {
    cancelAtPeriodEnd: Boolean(j.cancelAtPeriodEnd),
    currentPeriodEnd: typeof j.currentPeriodEnd === "string" ? j.currentPeriodEnd : null,
    status: typeof j.status === "string" ? j.status : "",
  };
}

/** Super Admin — permanently delete the workspace and all related data (DB + S3). Cancels Stripe first if needed. */
export async function deleteWorkspacePermanently(
  workspaceId: string,
  confirmWorkspaceName: string,
): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}`), {
    method: "DELETE",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ confirmWorkspaceName }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401) {
    throw new Error(readJsonErrorBody(j, res, "Sign in again to continue"));
  }
  if (res.status === 403) {
    throw new Error("Only the workspace Super Admin can delete this organization.");
  }
  if (!res.ok) {
    throw new Error(readJsonErrorBody(j, res, "Could not delete workspace"));
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
  title: string;
  location: string;
  trade: string;
  priority: string;
  status: string;
  assigneeId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  templateId: string | null;
  assignee: { id: string; name: string; email: string; image: string | null } | null;
  notes: string | null;
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
    dueDateYmd?: string | null;
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

export async function applyPunchTemplate(projectId: string, templateId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/punch/templates/${encodeURIComponent(templateId)}/apply`,
    ),
    { method: "POST", credentials: "include", headers: jsonHeaders },
  );
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not apply template.");
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
  file: { name: string };
  fileVersion: { version: number };
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

export async function fetchIssuesForFileVersion(
  fileVersionId: string,
  opts?: { issueKind?: "WORK_ORDER" | "CONSTRUCTION" },
): Promise<IssueRow[]> {
  const params = new URLSearchParams();
  if (opts?.issueKind) params.set("issueKind", opts.issueKind);
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
    issueKind?: "WORK_ORDER" | "CONSTRUCTION";
  },
): Promise<IssueRow[]> {
  const params = new URLSearchParams();
  if (opts?.fileVersionId) params.set("fileVersionId", opts.fileVersionId);
  if (opts?.assetId) params.set("assetId", opts.assetId);
  if (opts?.issueKind) params.set("issueKind", opts.issueKind);
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
  fileId: string;
  fileVersionId: string;
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
  /** Percent of line subtotal added as work / labor before tax. */
  workPricePercent: string;
  workAmount: string;
  taxableSubtotal: string;
  taxAmount: string;
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
  workPricePercent: string;
  workAmount: string;
  taxableSubtotal: string;
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
    occupantPortal: { activeMagicLinks: number };
    punchOpen: number;
    constructionIssuesOpen: number;
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
    maintenanceScheduledThisWeek: number;
    assetsTracked: number;
    overdueMaintenanceTasks: number;
    maintenanceDueSoon: number;
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

export type OmMaintenanceRow = {
  id: string;
  assetId: string;
  title: string;
  frequency: string;
  intervalDays: number | null;
  nextDueAt: string | null;
  lastCompletedAt: string | null;
  assignedVendorLabel: string | null;
  isActive: boolean;
  health: "overdue" | "dueSoon" | "onTrack";
  asset: { id: string; tag: string; name: string };
  createdAt: string;
  updatedAt: string;
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

export async function postOmMaintenanceComplete(
  projectId: string,
  scheduleId: string,
): Promise<OmMaintenanceRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/om/maintenance/${encodeURIComponent(scheduleId)}/complete`,
    ),
    { method: "POST", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not mark complete.");
  return res.json() as Promise<OmMaintenanceRow>;
}

export async function postOmGenerateWorkOrders(
  projectId: string,
): Promise<{ createdIds: string[] }> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/om/maintenance/generate-work-orders`),
    { method: "POST", credentials: "include" },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error("Could not generate work orders.");
  return res.json() as Promise<{ createdIds: string[] }>;
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

export async function fetchOccupantMeta(
  token: string,
): Promise<{ projectId: string; projectName: string }> {
  const res = await fetch(apiUrl(`/api/v1/occupant/${encodeURIComponent(token)}/meta`));
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Invalid link.");
  }
  return res.json() as Promise<{ projectId: string; projectName: string }>;
}

export async function postOccupantSubmit(
  token: string,
  body: {
    description: string;
    floor?: string;
    room?: string;
    reporterName: string;
    reporterEmail: string;
  },
): Promise<{ ok: true; issueId: string }> {
  const res = await fetch(apiUrl(`/api/v1/occupant/${encodeURIComponent(token)}/submit`), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: unknown;
    ok?: boolean;
    issueId?: string;
  };
  if (!res.ok) {
    const err = j.error;
    const msg =
      typeof err === "string" ? err : Array.isArray(err) ? "Invalid request" : "Could not submit.";
    throw new Error(msg);
  }
  if (!j.issueId) throw new Error("Invalid response.");
  return { ok: true as const, issueId: j.issueId };
}
