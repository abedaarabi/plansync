/**
 * Project Issues page orchestrator.
 *
 * Layout (top → bottom):
 *   1. Header + Pro/asset banners          → IssuesPageSections
 *   2. KPI / overview dashboard            → IssuesOverview (sibling module)
 *   3. Filter bar (status, search, …)      → IssuesFilterBar
 *   4. Results line + error banner         → IssuesPageSections
 *   5. Mobile cards / desktop table        → IssuesLists
 *   6. Create / edit / delete overlays     → IssuesSlideOvers
 *
 * Data & interactions live in hooks under this folder (`useProjectIssuesData`,
 * `useIssueFilters`, `useIssueListMutations`, `useIssueSlideOvers`).
 *
 * Prefer editing the focused file for the piece you need — avoid growing this
 * orchestrator beyond wiring props.
 */

"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { IssuesOverview } from "@/components/enterprise/IssuesOverview";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { useProjectWorkspaceMembers } from "@/components/enterprise/issueListControls";
import { filterIssueRows } from "@/lib/issueListFilters";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { issueEntityLabels, issueFiltersAreActive } from "./helpers";
import { IssuesFilterBar } from "./IssuesFilterBar";
import { IssuesLists } from "./IssuesLists";
import {
  IssuesMsgBanner,
  IssuesPageHeader,
  IssuesResultsLine,
  IssuesTopBanners,
} from "./IssuesPageSections";
import { IssuesSlideOvers } from "./IssuesSlideOvers";
import type { StatusFilter } from "./types";
import { useClearIssueFilters, useIssueFilterState } from "./useIssueFilters";
import { useIssueListMutations } from "./useIssueListMutations";
import { useIssueSlideOvers } from "./useIssueSlideOvers";
import { useProjectIssuesData } from "./useProjectIssuesData";

export function ProjectIssuesClient({
  projectId,
  issueKindFilter,
  listTitle = "Issues",
}: {
  projectId: string;
  issueKindFilter?: "WORK_ORDER" | "CONSTRUCTION" | "OCCUPANT";
  listTitle?: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace);
  const filterAssetId = searchParams.get("assetId")?.trim() || undefined;
  const nowMs = useTickNowMs();
  const labels = issueEntityLabels(issueKindFilter);

  const fs = useIssueFilterState();
  const data = useProjectIssuesData(projectId, issueKindFilter, filterAssetId);
  const { workspaceId, members } = useProjectWorkspaceMembers(projectId);
  const mut = useIssueListMutations(qc, data.issuesKey, projectId, labels.entitySingular);
  const so = useIssueSlideOvers(qc, data.issuesKey, mut.mergeRow, mut.setMsg);
  const { clearFilters, clearAssetFilterHref } = useClearIssueFilters(
    fs,
    filterAssetId,
    pathname,
    router,
    searchParams,
  );

  const filtered = useMemo(
    () =>
      filterIssueRows(data.items, {
        status: fs.filter,
        assignee: fs.assigneeFilter,
        sort: fs.sort,
        priority: fs.priorityFilter,
        due: fs.dueFilter,
        search: fs.search,
        nowMs,
      }),
    [data.items, fs, nowMs],
  );

  const filtersActive = issueFiltersAreActive({
    status: fs.filter,
    assignee: fs.assigneeFilter,
    priority: fs.priorityFilter,
    due: fs.dueFilter,
    search: fs.search,
    sort: fs.sort,
    assetId: filterAssetId,
  });

  return (
    <div className={`${OM_PAGE_CLASS} w-full min-w-0 max-w-full`}>
      <IssuesPageHeader
        listTitle={listTitle}
        isPending={data.isPending}
        total={data.items.length}
        listItemNoun={labels.listItemNoun}
        canCreate={labels.canCreate}
        ctxLoading={ctxLoading}
        isPro={isPro}
        isWorkOrders={labels.isWorkOrders}
        createLabel={labels.createLabel}
        projectId={projectId}
        onCreateClick={so.openCreateForm}
      />
      <IssuesTopBanners
        showProGate={labels.canCreate && !isPro}
        listItemNoun={labels.listItemNoun}
        filterAssetId={filterAssetId}
        clearAssetFilterHref={clearAssetFilterHref}
      />
      {!data.isPending && data.items.length > 0 ? (
        <IssuesOverview
          projectId={projectId}
          items={data.items}
          statusFilter={fs.filter}
          onStatusFilterChange={(key) => fs.setFilter(key as StatusFilter)}
        />
      ) : null}
      <IssuesFilterBar
        filter={fs.filter}
        onFilterChange={fs.setFilter}
        filtersActive={filtersActive}
        onReset={clearFilters}
        search={fs.search}
        onSearchChange={fs.setSearch}
        priorityFilter={fs.priorityFilter}
        onPriorityChange={fs.setPriorityFilter}
        dueFilter={fs.dueFilter}
        onDueChange={fs.setDueFilter}
        assigneeFilter={fs.assigneeFilter}
        onAssigneeChange={fs.setAssigneeFilter}
        sort={fs.sort}
        onSortChange={fs.setSort}
        members={members}
      />
      <IssuesResultsLine
        show={!data.isPending && data.items.length > 0}
        filteredCount={filtered.length}
        totalCount={data.items.length}
        listItemNoun={labels.listItemNoun}
        filtersActive={filtersActive}
        patchPending={mut.patchMut.isPending}
      />
      <IssuesMsgBanner msg={mut.msg} onDismiss={() => mut.setMsg(null)} />
      <IssuesLists
        isPending={data.isPending}
        listTitle={listTitle}
        filtered={filtered}
        totalCount={data.items.length}
        projectId={projectId}
        entitySingular={labels.entitySingular}
        canCreate={labels.canCreate && isPro}
        onCreateClick={so.openCreateForm}
        ListIcon={labels.ListIcon}
        isWorkOrders={labels.isWorkOrders}
        nowMs={nowMs}
        patchingIssueId={mut.patchingIssueId}
        deletingIssueId={mut.deletingIssueId}
        promotingIssueId={mut.promotingIssueId}
        canPromoteOccupant={data.canPromoteOccupant}
        onStatusChange={(issueId, status) => mut.patchMut.mutate({ id: issueId, status })}
        onDeleteClick={mut.setDeleteConfirmIssue}
        onEditClick={so.openEditForm}
        onPromote={mut.promoteMut.mutate}
      />
      <IssuesSlideOvers
        isWorkOrders={labels.isWorkOrders}
        createOpen={so.createOpen}
        editOpen={so.editOpen}
        editingIssue={so.editingIssue}
        deleteConfirmIssue={mut.deleteConfirmIssue}
        deletePending={mut.deleteMut.isPending}
        entitySingular={labels.entitySingular}
        projectId={projectId}
        workspaceId={workspaceId}
        wid={wid}
        isPro={isPro}
        members={members}
        filterAssetId={filterAssetId}
        onCreated={so.handleIssueCreated}
        onCreateClose={so.closeCreateForm}
        onEditClose={so.closeEditForm}
        onSaved={so.handleIssueSaved}
        onDeleteCancel={mut.cancelDelete}
        onDeleteConfirm={mut.confirmDelete}
      />
    </div>
  );
}
