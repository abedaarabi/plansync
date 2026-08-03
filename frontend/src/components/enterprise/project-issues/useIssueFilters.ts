/**
 * Local filter UI state + “clear all” (including `?assetId=` from the URL).
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { IssueDueFilter, IssueListSortKey } from "@/lib/issueListFilters";
import type { AssigneeFilter, PriorityFilter, StatusFilter } from "./types";

export function useIssueFilterState() {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<IssueListSortKey>("newest");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [dueFilter, setDueFilter] = useState<IssueDueFilter>("ALL");
  const [search, setSearch] = useState("");
  return {
    filter,
    setFilter,
    sort,
    setSort,
    assigneeFilter,
    setAssigneeFilter,
    priorityFilter,
    setPriorityFilter,
    dueFilter,
    setDueFilter,
    search,
    setSearch,
  };
}

type IssueFilterState = ReturnType<typeof useIssueFilterState>;

export function useClearIssueFilters(
  fs: IssueFilterState,
  filterAssetId: string | undefined,
  pathname: string | null,
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
) {
  const clearAssetFilterHref = useMemo(() => {
    if (!filterAssetId || !pathname) return null;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("assetId");
    const q = p.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [filterAssetId, pathname, searchParams]);

  const clearFilters = useCallback(() => {
    fs.setFilter("ALL");
    fs.setAssigneeFilter("ALL");
    fs.setPriorityFilter("ALL");
    fs.setDueFilter("ALL");
    fs.setSearch("");
    fs.setSort("newest");
    if (clearAssetFilterHref && pathname) router.replace(clearAssetFilterHref);
  }, [fs, clearAssetFilterHref, pathname, router]);

  return { clearFilters, clearAssetFilterHref };
}
