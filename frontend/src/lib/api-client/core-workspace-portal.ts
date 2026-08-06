/**
 * Workspace notifications, dashboard, billing, and invite endpoints.
 */
import type { Project } from "@/types/projects";
import { apiUrl } from "@/lib/api-url";
import { jsonHeaders, readJsonErrorBody } from "./shared";
import { HttpError, ProRequiredError } from "./errors";
import type { WorkspaceSummary } from "./core-project-ops";

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

export async function clearMeNotification(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/me/notifications/${encodeURIComponent(id)}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not clear notification.");
}

export async function clearAllMeNotifications(): Promise<void> {
  const res = await fetch(apiUrl("/api/v1/me/notifications/clear-all"), {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not clear notifications.");
}

/** Returns `null` when Web Push is not configured on the server (HTTP 404). */
export async function fetchVapidPublicKey(): Promise<string | null> {
  const res = await fetch(apiUrl("/api/v1/me/push/vapid-public-key"), { credentials: "include" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Could not load push configuration.");
  const j = (await res.json()) as { publicKey?: string };
  return typeof j.publicKey === "string" && j.publicKey.trim() ? j.publicKey.trim() : null;
}

export async function postWebPushSubscribe(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<void> {
  const res = await fetch(apiUrl("/api/v1/me/push/subscribe"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(subscription),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Could not save push subscription.");
  }
}

export async function postWebPushUnsubscribe(endpoint: string): Promise<void> {
  const res = await fetch(apiUrl("/api/v1/me/push/unsubscribe"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) throw new Error("Could not remove push subscription.");
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

type InviteRow = {
  id: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  createdAt: string;
};

async function fetchInvites(workspaceId: string): Promise<InviteRow[]> {
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

type CreateInviteResponse = {
  id: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
};

async function createInvite(
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

async function revokeInvite(workspaceId: string, inviteId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/workspaces/${workspaceId}/invites/${inviteId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not revoke invite.");
}
