/**
 * Pure helpers for the project Issues page (no React).
 *
 * - Entity copy differs by issue kind (issues vs work orders vs tenant requests).
 * - Filter “active” detection drives the Reset chip and results line.
 * - Mutation error toast keeps Pro / lock messaging consistent.
 */

import { MapPin, Wrench, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { formatIssueLockHint, ProRequiredError } from "@/lib/api-client";
import type { IssueDueFilter, IssueListSortKey } from "@/lib/issueListFilters";
import type { AssigneeFilter, IssueKind, PriorityFilter, StatusFilter } from "./types";

export function issueEntityLabels(kind: IssueKind): {
  entitySingular: string;
  listItemNoun: string;
  isWorkOrders: boolean;
  canCreate: boolean;
  createLabel: string;
  ListIcon: LucideIcon;
} {
  const isWorkOrders = kind === "WORK_ORDER";
  return {
    entitySingular: isWorkOrders ? "work order" : kind === "OCCUPANT" ? "tenant request" : "issue",
    listItemNoun: isWorkOrders ? "work orders" : kind === "OCCUPANT" ? "tenant requests" : "issues",
    isWorkOrders,
    canCreate: kind !== "OCCUPANT",
    createLabel: isWorkOrders ? "New work order" : "New issue",
    ListIcon: isWorkOrders ? Wrench : MapPin,
  };
}

export function issueFiltersAreActive(f: {
  status: StatusFilter;
  assignee: AssigneeFilter;
  priority: PriorityFilter;
  due: IssueDueFilter;
  search: string;
  sort: IssueListSortKey;
  assetId?: string;
}): boolean {
  return (
    f.status !== "ALL" ||
    f.assignee !== "ALL" ||
    f.priority !== "ALL" ||
    f.due !== "ALL" ||
    Boolean(f.search.trim()) ||
    f.sort !== "newest" ||
    Boolean(f.assetId)
  );
}

export function toastIssueActionError(e: Error): void {
  toast.error(
    e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e),
  );
}
