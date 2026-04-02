import type { DashboardResponse } from "@/lib/api-client";

/** 0–100 composite “workspace health” from issues, storage, and recent activity (heuristic). */
export function computeWorkspaceHealthScore(dash: DashboardResponse | undefined): number {
  if (!dash?.workspace) return 72;
  const used = Number(dash.workspace.storageUsedBytes);
  const quota = Number(dash.workspace.storageQuotaBytes);
  const totalIssues = dash.issuesByStatus.reduce((a, x) => a + x._count, 0);
  const openIssues = dash.issuesByStatus
    .filter((x) => x.status === "OPEN" || x.status === "IN_PROGRESS")
    .reduce((a, x) => a + x._count, 0);

  const issueDrag = totalIssues > 0 ? (openIssues / totalIssues) * 38 : 0;
  const storageDrag = quota > 0 ? Math.min(32, (used / quota) * 32) : 0;
  const last7 = dash.activityLast14Days?.slice(-7).reduce((a, x) => a + x.count, 0) ?? 0;
  const momentum = Math.min(22, last7 * 1.4);

  return Math.round(Math.max(12, Math.min(98, 88 - issueDrag - storageDrag + momentum)));
}
