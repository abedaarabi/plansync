/**
 * Shared filtering, sorting, and cache-merge helpers for issue-style list pages
 * (project issues, work orders, tenant requests). Pure — no React, no fetches.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { IssueRow } from "@/lib/api-client";
import { isIssueDueThisWeek, isIssueOverdue } from "@/lib/issuesOverviewStats";
import { qk } from "@/lib/queryKeys";

export type IssueDueFilter = "ALL" | "OVERDUE" | "THIS_WEEK" | "NONE";
export type IssueListSortKey = "newest" | "file" | "status";

export type IssueListFilters = {
  status: string;
  assignee: string;
  sort: IssueListSortKey;
  priority?: string;
  due?: IssueDueFilter;
  search?: string;
  nowMs?: number;
};

export function issueSheetLabel(issue: IssueRow): string {
  const name = issue.sheetName?.trim() || issue.file?.name?.trim();
  if (!name) return "No sheet";
  const ver = issue.sheetVersion ?? issue.fileVersion?.version;
  return ver != null ? `${name} · v${ver}` : name;
}

function issueMatchesSearch(issue: IssueRow, query: string): boolean {
  return [issue.title, issue.sheetName, issue.file?.name].some((s) =>
    s?.toLowerCase().includes(query),
  );
}

function applyDueFilter(
  list: IssueRow[],
  due: IssueDueFilter | undefined,
  nowMs: number,
): IssueRow[] {
  if (due === "OVERDUE") return list.filter((i) => isIssueOverdue(i, nowMs));
  if (due === "THIS_WEEK") return list.filter((i) => isIssueDueThisWeek(i, nowMs));
  if (due === "NONE") return list.filter((i) => !i.dueDate);
  return list;
}

function sortIssueRows(list: IssueRow[], sort: IssueListSortKey): IssueRow[] {
  if (sort === "file")
    return [...list].sort((a, b) =>
      issueSheetLabel(a).localeCompare(issueSheetLabel(b), undefined, { sensitivity: "base" }),
    );
  if (sort === "status") return [...list].sort((a, b) => a.status.localeCompare(b.status));
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function filterIssueRows(items: IssueRow[], f: IssueListFilters): IssueRow[] {
  let list = f.status === "ALL" ? items : items.filter((i) => i.status === f.status);
  if (f.priority && f.priority !== "ALL")
    list = list.filter((i) => (i.priority ?? "MEDIUM") === f.priority);
  list = applyDueFilter(list, f.due, f.nowMs ?? Date.now());
  if (f.assignee === "UNASSIGNED") list = list.filter((i) => !i.assigneeId);
  else if (f.assignee !== "ALL") list = list.filter((i) => i.assigneeId === f.assignee);
  const q = f.search?.trim().toLowerCase();
  if (q) list = list.filter((i) => issueMatchesSearch(i, q));
  return sortIssueRows(list, f.sort);
}

/** Merge one updated row into the project list cache, its detail cache, and file-version lists. */
export function mergeIssueRowIntoLists(
  qc: QueryClient,
  issuesKey: readonly unknown[],
  row: IssueRow,
): void {
  const merge = (old: IssueRow[] | undefined) =>
    old?.some((i) => i.id === row.id) ? old.map((i) => (i.id === row.id ? row : i)) : old;
  qc.setQueryData(issuesKey, merge);
  qc.setQueryData(qk.issueById(row.id), row);
  qc.setQueriesData<IssueRow[]>({ queryKey: ["issues", "fileVersion"], exact: false }, merge);
}
