import type {
  BimClashRunPayload,
  BimClashRunStats,
  BimClashSetDef,
  BimClashStatus,
  BimClashType,
} from "@plansync/shared/bimClashTypes";
import { apiUrl } from "@/lib/api-url";
import { HttpError, ProRequiredError } from "./errors";
import { jsonHeaders } from "./shared";

export type ClashUserRef = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type ClashElementRef = {
  name: string | null;
  ifcType: string | null;
  ifcGuid: string;
};

export type ClashIssueRef = {
  id: string;
  status: string;
  title: string;
};

export type BimClashTestRow = {
  id: string;
  projectId: string;
  name: string;
  setA: BimClashSetDef;
  setB: BimClashSetDef;
  clearanceEnabled: boolean;
  clearanceMm: number;
  lastRunAt: string | null;
  lastRunById: string | null;
  lastRunStats: BimClashRunStats | null;
  clashCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type BimClashRow = {
  id: string;
  testId: string;
  projectId: string;
  fileVersionAId: string;
  fileVersionBId: string;
  elementAId: string;
  elementBId: string;
  guidA: string;
  guidB: string;
  clashType: BimClashType;
  distanceMm: number;
  point: { x: number; y: number; z: number };
  contactCount: number;
  status: BimClashStatus;
  statusChangedAt: string | null;
  statusDistanceMm: number | null;
  assigneeId: string | null;
  groupId: string | null;
  elementMissingSinceId: string | null;
  issueId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  elementA: ClashElementRef | null;
  elementB: ClashElementRef | null;
  assignee: ClashUserRef | null;
  issue: ClashIssueRef | null;
};

export type BimClashCommentRow = {
  id: string;
  body: string;
  createdAt: string;
  author: ClashUserRef;
};

async function parseClashError(res: Response, fallback: string): Promise<never> {
  if (res.status === 402) throw new ProRequiredError();
  const j = (await res.json().catch(() => ({}))) as { error?: unknown };
  const msg = typeof j.error === "string" ? j.error : fallback;
  throw new HttpError(res.status, msg);
}

export async function fetchClashTests(projectId: string): Promise<BimClashTestRow[]> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/clash-tests`), {
    credentials: "include",
  });
  if (!res.ok) await parseClashError(res, "Could not load clash tests.");
  const j = (await res.json()) as { tests: BimClashTestRow[] };
  return j.tests ?? [];
}

export type BuildingClashSummary = {
  openCount: number;
  resolvedCount: number;
  ignoredCount: number;
  byType: { HARD: number; CLEARANCE: number; DUPLICATE: number };
  lastRunAt: string | null;
  stale: boolean;
  tests: Array<{
    id: string;
    name: string;
    openCount: number;
    clashCount: number;
    lastRunAt: string | null;
    lastRunStats: BimClashRunStats | null;
  }>;
};

export async function fetchBuildingClashSummary(buildingId: string): Promise<BuildingClashSummary> {
  const res = await fetch(
    apiUrl(`/api/v1/buildings/${encodeURIComponent(buildingId)}/clash-summary`),
    { credentials: "include" },
  );
  if (!res.ok) await parseClashError(res, "Could not load clash summary.");
  const j = (await res.json()) as { summary: BuildingClashSummary };
  return j.summary;
}

/** Delete persisted clashes for a building's IFC versions (keeps clash test configs). */
export async function clearBuildingClashResults(
  buildingId: string,
): Promise<{ deletedCount: number }> {
  const res = await fetch(apiUrl(`/api/v1/buildings/${encodeURIComponent(buildingId)}/clashes`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) await parseClashError(res, "Could not clear clash results.");
  return (await res.json()) as { deletedCount: number };
}

export async function createClashTest(
  projectId: string,
  body: {
    name: string;
    setA: BimClashSetDef;
    setB: BimClashSetDef;
    clearanceEnabled?: boolean;
    clearanceMm?: number;
  },
): Promise<BimClashTestRow> {
  const res = await fetch(apiUrl(`/api/v1/projects/${encodeURIComponent(projectId)}/clash-tests`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseClashError(res, "Could not create clash test.");
  return (await res.json()) as BimClashTestRow;
}

export async function postClashRun(
  testId: string,
  payload: BimClashRunPayload,
): Promise<{ stats: BimClashRunStats; clashes: BimClashRow[] }> {
  const res = await fetch(apiUrl(`/api/v1/clash-tests/${encodeURIComponent(testId)}/runs`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseClashError(res, "Could not save clash results.");
  return (await res.json()) as { stats: BimClashRunStats; clashes: BimClashRow[] };
}

export async function fetchClashTestClashes(
  testId: string,
  opts?: { status?: BimClashStatus; assignee?: "me" },
): Promise<{ test: BimClashTestRow; clashes: BimClashRow[] }> {
  const q = new URLSearchParams();
  if (opts?.status) q.set("status", opts.status);
  if (opts?.assignee) q.set("assignee", opts.assignee);
  const qs = q.toString();
  const res = await fetch(
    apiUrl(`/api/v1/clash-tests/${encodeURIComponent(testId)}/clashes${qs ? `?${qs}` : ""}`),
    { credentials: "include" },
  );
  if (!res.ok) await parseClashError(res, "Could not load clashes.");
  return (await res.json()) as { test: BimClashTestRow; clashes: BimClashRow[] };
}

export async function patchClash(
  clashId: string,
  body: {
    status?: BimClashStatus;
    assigneeId?: string | null;
    groupId?: string | null;
    issueId?: string | null;
  },
): Promise<BimClashRow> {
  const res = await fetch(apiUrl(`/api/v1/clashes/${encodeURIComponent(clashId)}`), {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseClashError(res, "Could not update clash.");
  return (await res.json()) as BimClashRow;
}

export async function deleteClash(clashId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/clashes/${encodeURIComponent(clashId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) await parseClashError(res, "Could not delete clash.");
}

/** Delete all clashes for a test and clear last-run stats (keeps set configuration). */
export async function clearClashTestResults(testId: string): Promise<{ deletedCount: number }> {
  const res = await fetch(apiUrl(`/api/v1/clash-tests/${encodeURIComponent(testId)}/clashes`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) await parseClashError(res, "Could not clear clash results.");
  return (await res.json()) as { deletedCount: number };
}

export async function bulkPatchClashes(
  testId: string,
  body: {
    clashIds: string[];
    status?: BimClashStatus;
    assigneeId?: string | null;
    issueId?: string | null;
  },
): Promise<BimClashRow[]> {
  const res = await fetch(
    apiUrl(`/api/v1/clash-tests/${encodeURIComponent(testId)}/clashes/bulk`),
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) await parseClashError(res, "Could not update clashes.");
  const j = (await res.json()) as { clashes: BimClashRow[] };
  return j.clashes ?? [];
}

export async function fetchClashComments(clashId: string): Promise<BimClashCommentRow[]> {
  const res = await fetch(apiUrl(`/api/v1/clashes/${encodeURIComponent(clashId)}/comments`), {
    credentials: "include",
  });
  if (!res.ok) await parseClashError(res, "Could not load comments.");
  const j = (await res.json()) as { comments: BimClashCommentRow[] };
  return j.comments ?? [];
}

export async function createClashComment(
  clashId: string,
  body: string,
): Promise<BimClashCommentRow & { commentCount: number }> {
  const res = await fetch(apiUrl(`/api/v1/clashes/${encodeURIComponent(clashId)}/comments`), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ body }),
  });
  if (!res.ok) await parseClashError(res, "Could not add comment.");
  return (await res.json()) as BimClashCommentRow & { commentCount: number };
}
