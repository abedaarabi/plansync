/**
 * Sticky filter bar under the overview: status chips + search / priority / due /
 * assignee / sort. Reset appears when any filter (or assetId query) is active.
 */

"use client";

import { Calendar, Flag, Search } from "lucide-react";
import {
  AssigneeFilterSelect,
  SortSelect,
  StatusFilterChips,
} from "@/components/enterprise/issueListControls";
import type { WorkspaceMemberRow } from "@/lib/api-client";
import type { IssueDueFilter, IssueListSortKey } from "@/lib/issueListFilters";
import { ISSUE_PRIORITY_LABEL, ISSUE_PRIORITY_ORDER } from "@/lib/issueStatusStyle";
import { OM_COMPACT_SELECT } from "@/lib/omCompactStyles";
import {
  ISSUE_FILTER_DEFS,
  ISSUE_SORT_OPTIONS,
  type AssigneeFilter,
  type PriorityFilter,
  type StatusFilter,
} from "./types";

const FILTER_LABEL_CLASS =
  "mb-0.5 flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text-muted)]";

function IssueSearchField({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <label className="min-w-[11rem] flex-1 sm:max-w-[16rem]">
      <span className={FILTER_LABEL_CLASS}>
        <Search className="h-3.5 w-3.5" aria-hidden />
        Search
      </span>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Title or sheet…"
        className={OM_COMPACT_SELECT}
      />
    </label>
  );
}

function IssuePrioritySelect({
  priorityFilter,
  onPriorityChange,
}: {
  priorityFilter: PriorityFilter;
  onPriorityChange: (value: PriorityFilter) => void;
}) {
  return (
    <label className="min-w-[8rem]">
      <span className={FILTER_LABEL_CLASS}>
        <Flag className="h-3.5 w-3.5" aria-hidden />
        Priority
      </span>
      <select
        id="issues-priority-filter"
        value={priorityFilter}
        onChange={(e) => onPriorityChange(e.target.value as PriorityFilter)}
        className={OM_COMPACT_SELECT}
      >
        <option value="ALL">All priorities</option>
        {ISSUE_PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {ISSUE_PRIORITY_LABEL[p] ?? p}
          </option>
        ))}
      </select>
    </label>
  );
}

function IssueDueSelect({
  dueFilter,
  onDueChange,
}: {
  dueFilter: IssueDueFilter;
  onDueChange: (value: IssueDueFilter) => void;
}) {
  return (
    <label className="min-w-[8rem]">
      <span className={FILTER_LABEL_CLASS}>
        <Calendar className="h-3.5 w-3.5" aria-hidden />
        Due
      </span>
      <select
        id="issues-due-filter"
        value={dueFilter}
        onChange={(e) => onDueChange(e.target.value as IssueDueFilter)}
        className={OM_COMPACT_SELECT}
      >
        <option value="ALL">Any due date</option>
        <option value="OVERDUE">Overdue</option>
        <option value="THIS_WEEK">Due this week</option>
        <option value="NONE">No due date</option>
      </select>
    </label>
  );
}

type IssuesFilterBarProps = {
  filter: StatusFilter;
  onFilterChange: (key: StatusFilter) => void;
  filtersActive: boolean;
  onReset: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  priorityFilter: PriorityFilter;
  onPriorityChange: (value: PriorityFilter) => void;
  dueFilter: IssueDueFilter;
  onDueChange: (value: IssueDueFilter) => void;
  assigneeFilter: AssigneeFilter;
  onAssigneeChange: (value: AssigneeFilter) => void;
  sort: IssueListSortKey;
  onSortChange: (value: IssueListSortKey) => void;
  members: WorkspaceMemberRow[];
};

export function IssuesFilterBar(props: IssuesFilterBarProps) {
  return (
    <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-surface)]/95 pb-3 backdrop-blur-md lg:static lg:bg-transparent">
      <StatusFilterChips
        defs={ISSUE_FILTER_DEFS}
        value={props.filter}
        onChange={props.onFilterChange}
        filtersActive={props.filtersActive}
        onReset={props.onReset}
      />
      <div className="flex flex-wrap items-end gap-2">
        <IssueSearchField search={props.search} onSearchChange={props.onSearchChange} />
        <IssuePrioritySelect
          priorityFilter={props.priorityFilter}
          onPriorityChange={props.onPriorityChange}
        />
        <IssueDueSelect dueFilter={props.dueFilter} onDueChange={props.onDueChange} />
        <AssigneeFilterSelect
          id="issues-assignee-filter"
          value={props.assigneeFilter}
          onChange={props.onAssigneeChange}
          members={props.members}
        />
        <SortSelect
          id="issues-sort"
          value={props.sort}
          onChange={props.onSortChange}
          options={ISSUE_SORT_OPTIONS}
        />
      </div>
    </div>
  );
}
