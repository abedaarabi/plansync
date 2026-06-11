/**
 * Workspace, billing, project, and dashboard endpoints.
 */
import type { MeResponse } from "@/types/enterprise";
import type { WorkspaceRole } from "@/types/enterprise";
import type { Project } from "@/types/projects";
import type {
  OmTenantPortalUiSettings,
  ProjectSessionClientVisibility,
  ProjectSessionOmHandover,
} from "@plansync/shared/projectSessionSettings";

export type {
  OmTenantPortalUiSettings,
  ProjectSessionClientVisibility,
  ProjectSessionOmHandover,
} from "@plansync/shared/projectSessionSettings";
import { apiUrl } from "@/lib/api-url";
import { jsonHeaders, readJsonErrorBody, readJsonOrEmpty } from "./shared";
import { HttpError, ProRequiredError } from "./errors";

export async function fetchMe(): Promise<MeResponse | null> {
  const res = await fetch(apiUrl("/api/v1/me"), { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) {
    let msg = `Could not load session (HTTP ${res.status}).`;
    const j = (await readJsonOrEmpty(res)) as { error?: string };
    if (typeof j.error === "string" && j.error.trim()) msg = j.error;
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
  const j = (await readJsonOrEmpty(res)) as {
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

export type ProjectSessionResponse = {
  projectId: string;
  projectName: string;
  workspaceId: string;
  /** ISO 4217 — budgets, proposals, takeoff pricing */
  currency: string;
  /** Metric vs imperial for measurements */
  measurementSystem: string;
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
    omTenantPortalUi: OmTenantPortalUiSettings;
  };
  uiMode: "internal" | "client" | "contractor" | "sub";
};

export type ProjectApiKeyRow = {
  id: string;
  name: string;
  serviceLabel: string | null;
  scopes: string[];
  keyPrefix: string;
  createdById: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type ProjectWebhookRow = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
};

export async function fetchProjectSession(projectId: string): Promise<ProjectSessionResponse> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/session`), {
    credentials: "include",
  });
  if (!res.ok) {
    const j = (await readJsonOrEmpty(res)) as { error?: string };
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
    omTenantPortalUi?: { headline?: string | null };
  },
): Promise<{ projectId: string; settings: ProjectSessionResponse["settings"] }> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/settings`), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await readJsonOrEmpty(res)) as {
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

export async function listProjectApiKeys(
  projectId: string,
): Promise<{ projectId: string; items: ProjectApiKeyRow[] }> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/api-keys`), {
    credentials: "include",
  });
  const j = (await readJsonOrEmpty(res)) as {
    error?: string;
    projectId?: string;
    items?: ProjectApiKeyRow[];
  };
  if (!res.ok) {
    throw new Error(
      typeof j.error === "string" ? j.error : `Could not load API keys (HTTP ${res.status}).`,
    );
  }
  return {
    projectId: j.projectId ?? projectId,
    items: Array.isArray(j.items) ? j.items : [],
  };
}

export async function createProjectApiKey(
  projectId: string,
  body: { name?: string; serviceLabel?: string | null; scopes?: string[] },
): Promise<{ projectId: string; apiKey: string; key: ProjectApiKeyRow }> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/api-keys`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await readJsonOrEmpty(res)) as {
    error?: string;
    projectId?: string;
    apiKey?: string;
    key?: ProjectApiKeyRow;
  };
  if (!res.ok || typeof j.apiKey !== "string" || !j.key) {
    throw new Error(
      typeof j.error === "string" ? j.error : `Could not create API key (HTTP ${res.status}).`,
    );
  }
  return { projectId: j.projectId ?? projectId, apiKey: j.apiKey, key: j.key };
}

export async function revokeProjectApiKey(projectId: string, keyId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/api-keys/${encodeURIComponent(keyId)}/revoke`,
    ),
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!res.ok) {
    const j = (await readJsonOrEmpty(res)) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Could not revoke API key.");
  }
}

export async function listProjectWebhooks(
  projectId: string,
): Promise<{ projectId: string; items: ProjectWebhookRow[] }> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/webhooks`), {
    credentials: "include",
  });
  const j = (await readJsonOrEmpty(res)) as {
    error?: string;
    projectId?: string;
    items?: ProjectWebhookRow[];
  };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not load webhooks.");
  }
  return {
    projectId: j.projectId ?? projectId,
    items: Array.isArray(j.items) ? j.items : [],
  };
}

export async function createProjectWebhook(
  projectId: string,
  body: { url: string; events?: string[]; isActive?: boolean },
): Promise<ProjectWebhookRow> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/webhooks`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await readJsonOrEmpty(res)) as { error?: string } & Partial<ProjectWebhookRow>;
  if (!res.ok || !j.id) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not create webhook.");
  }
  return j as ProjectWebhookRow;
}

export async function patchProjectWebhook(
  projectId: string,
  webhookId: string,
  patch: { events?: string[]; isActive?: boolean },
): Promise<ProjectWebhookRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/webhooks/${encodeURIComponent(webhookId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    },
  );
  const j = (await readJsonOrEmpty(res)) as { error?: string } & Partial<ProjectWebhookRow>;
  if (!res.ok || !j.id) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not update webhook.");
  }
  return j as ProjectWebhookRow;
}

export async function deleteProjectWebhook(projectId: string, webhookId: string): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/webhooks/${encodeURIComponent(webhookId)}`,
    ),
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (!res.ok) {
    const j = (await readJsonOrEmpty(res)) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Could not delete webhook.");
  }
}

export type ScheduleTaskStatus = "not_started" | "in_progress" | "delayed" | "completed";

export type ScheduleLinkType = "e2s" | "s2s" | "e2e" | "s2e";

export type ScheduleTaskLinkRow = {
  id: string;
  sourceId: string;
  targetId: string;
  type: ScheduleLinkType;
  lagDays: number;
};

export type ScheduleTaskLinkInput = ScheduleTaskLinkRow;

export type ProjectSchedulePayload = {
  tasks: ScheduleTaskRow[];
  links: ScheduleTaskLinkRow[];
};

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

export async function fetchProjectSchedule(projectId: string): Promise<ProjectSchedulePayload> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/schedule`), {
    credentials: "include",
  });
  if (res.status === 402) throw new ProRequiredError();
  if (res.status === 403) throw new Error("You don’t have access to the schedule.");
  if (!res.ok) throw new Error("Could not load schedule.");
  const j = (await res.json()) as ProjectSchedulePayload | ScheduleTaskRow[];
  if (Array.isArray(j)) return { tasks: j, links: [] };
  return {
    tasks: j.tasks ?? [],
    links: j.links ?? [],
  };
}

export async function putProjectSchedule(
  projectId: string,
  body: { tasks: ScheduleTaskInput[]; links?: ScheduleTaskLinkInput[] },
): Promise<ProjectSchedulePayload> {
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
  const j = (await res.json()) as ProjectSchedulePayload | ScheduleTaskRow[];
  if (Array.isArray(j)) return { tasks: j, links: [] };
  return {
    tasks: j.tasks ?? [],
    links: j.links ?? [],
  };
}

export async function fetchDatacenterCommissioningTemplate(
  projectId: string,
  mode: "append" | "replace" = "append",
): Promise<{
  mode: "append" | "replace";
  tasks: ScheduleTaskInput[];
  links: ScheduleTaskLinkInput[];
}> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/schedule/templates/datacenter-commissioning`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify({ mode }),
    },
  );
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      typeof j.error === "string" ? j.error : "Could not load datacenter schedule template.",
    );
  }
  const j = (await res.json()) as {
    mode?: "append" | "replace";
    tasks?: ScheduleTaskInput[];
    links?: ScheduleTaskLinkInput[];
  };
  return {
    mode: j.mode === "replace" ? "replace" : "append",
    tasks: Array.isArray(j.tasks) ? j.tasks : [],
    links: Array.isArray(j.links) ? j.links : [],
  };
}

export type JobRunRow = {
  id: string;
  kind: string;
  status: string;
  correlationId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  payloadJson: unknown;
  resultJson: unknown;
  errorJson: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function fetchProjectJobRuns(projectId: string): Promise<JobRunRow[]> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/job-runs`), {
    credentials: "include",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Could not load job runs.");
  }
  return res.json() as Promise<JobRunRow[]>;
}

export async function createProjectJobRun(
  projectId: string,
  body: { kind: string; status?: string; correlationId?: string | null; payloadJson?: unknown },
): Promise<JobRunRow> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/job-runs`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string } & Partial<JobRunRow>;
  if (!res.ok || !j.id) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not create job run.");
  }
  return j as JobRunRow;
}

export type OrchestrationEnvironmentRow = {
  id: string;
  name: string;
  region: string;
  availabilityZone: string | null;
  isProduction: boolean;
};

export type OrchestrationWorkflowStepRow = {
  id: string;
  name: string;
  stepType: string;
  sortOrder: number;
  timeoutSeconds: number | null;
};

export type OrchestrationWorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  environment: { id: string; name: string; region: string } | null;
  steps: OrchestrationWorkflowStepRow[];
};

export type OrchestrationRunRow = {
  id: string;
  workflow: { id: string; name: string };
  environment: { id: string; name: string; region: string } | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  changeWindowStart: string | null;
  changeWindowEnd: string | null;
  approvals: {
    id: string;
    status: string;
    note: string | null;
    requestedAt: string;
    respondedAt: string | null;
  }[];
  createdAt: string;
};

export async function fetchOrchestrationEnvironments(
  projectId: string,
): Promise<OrchestrationEnvironmentRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/orchestration/environments`),
    { credentials: "include" },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Could not load environments.");
  }
  return res.json() as Promise<OrchestrationEnvironmentRow[]>;
}

export async function createOrchestrationEnvironment(
  projectId: string,
  body: {
    name: string;
    region: string;
    availabilityZone?: string | null;
    isProduction?: boolean;
  },
): Promise<OrchestrationEnvironmentRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/orchestration/environments`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<OrchestrationEnvironmentRow>;
  if (!res.ok || !j.id) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not create environment.");
  }
  return j as OrchestrationEnvironmentRow;
}

export async function fetchOrchestrationWorkflows(
  projectId: string,
): Promise<OrchestrationWorkflowRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/orchestration/workflows`),
    { credentials: "include" },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Could not load workflows.");
  }
  return res.json() as Promise<OrchestrationWorkflowRow[]>;
}

export async function createOrchestrationWorkflow(
  projectId: string,
  body: {
    name: string;
    description?: string | null;
    environmentId?: string | null;
    steps: { name: string; stepType: string; sortOrder?: number; timeoutSeconds?: number | null }[];
  },
): Promise<OrchestrationWorkflowRow> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/orchestration/workflows`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<OrchestrationWorkflowRow>;
  if (!res.ok || !j.id) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not create workflow.");
  }
  return j as OrchestrationWorkflowRow;
}

export async function fetchOrchestrationRuns(projectId: string): Promise<OrchestrationRunRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/orchestration/runs`),
    { credentials: "include" },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(typeof j.error === "string" ? j.error : "Could not load orchestration runs.");
  }
  return res.json() as Promise<OrchestrationRunRow[]>;
}

export async function createOrchestrationRun(
  projectId: string,
  workflowId: string,
  body?: {
    environmentId?: string | null;
    changeWindowStart?: string | null;
    changeWindowEnd?: string | null;
  },
): Promise<{ id: string; status: string; createdAt: string }> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/orchestration/workflows/${encodeURIComponent(workflowId)}/runs`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body ?? {}),
    },
  );
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    id?: string;
    status?: string;
    createdAt?: string;
  };
  if (!res.ok || !j.id) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not start orchestration run.");
  }
  return {
    id: j.id,
    status: j.status ?? "QUEUED",
    createdAt: j.createdAt ?? new Date().toISOString(),
  };
}

export async function createOrchestrationApproval(
  projectId: string,
  runId: string,
  body: { status: "PENDING" | "APPROVED" | "REJECTED"; note?: string | null },
): Promise<{
  id: string;
  status: string;
  note: string | null;
  requestedAt: string;
  respondedAt: string | null;
}> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/orchestration/runs/${encodeURIComponent(runId)}/approvals`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    id?: string;
    status?: string;
    note?: string | null;
    requestedAt?: string;
    respondedAt?: string | null;
  };
  if (!res.ok || !j.id) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not create approval decision.");
  }
  return {
    id: j.id,
    status: j.status ?? "PENDING",
    note: j.note ?? null,
    requestedAt: j.requestedAt ?? new Date().toISOString(),
    respondedAt: j.respondedAt ?? null,
  };
}
