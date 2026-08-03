/**
 * Shared types & filter/sort constants for the project Issues page.
 *
 * Used by the filter bar, list hooks, and the main orchestrator
 * (`ProjectIssuesClient`). Keep UI-only types (row props) next to the
 * components that render them — this file is for cross-cutting filter state.
 */

import type { LucideIcon } from "lucide-react";
import { Activity, Archive, CheckCircle2, CircleDot, LayoutGrid } from "lucide-react";
import type { SortSelectOption } from "@/components/enterprise/issueListControls";
import type { IssueListSortKey } from "@/lib/issueListFilters";

export type StatusFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type AssigneeFilter = "ALL" | "UNASSIGNED" | string;
export type PriorityFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";
/** Which issue kind this list page shows (undefined = construction issues). */
export type IssueKind = "WORK_ORDER" | "CONSTRUCTION" | "OCCUPANT" | undefined;

export const ISSUE_FILTER_DEFS: { key: StatusFilter; label: string; Icon: LucideIcon }[] = [
  { key: "ALL", label: "All", Icon: LayoutGrid },
  { key: "OPEN", label: "Open", Icon: CircleDot },
  { key: "IN_PROGRESS", label: "In progress", Icon: Activity },
  { key: "RESOLVED", label: "Resolved", Icon: CheckCircle2 },
  { key: "CLOSED", label: "Closed", Icon: Archive },
];

export const ISSUE_SORT_OPTIONS: SortSelectOption<IssueListSortKey>[] = [
  { value: "newest", label: "Newest first" },
  { value: "file", label: "File name" },
  { value: "status", label: "Status" },
];
