/**
 * Responsive issues list: mobile cards (`lg:hidden`) + desktop table.
 * Builds shared `IssueRowProps` once so both surfaces stay in sync.
 */

"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, Calendar, ExternalLink, Flag, MapPin, UserRound } from "lucide-react";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import type { IssueRow } from "@/lib/api-client";
import { IssueEmptyState } from "./IssueEmptyState";
import type { IssueRowProps } from "./issueRowShared";
import { ProjectIssueMobileCard } from "./ProjectIssueMobileCard";
import { ProjectIssueTableRow } from "./ProjectIssueTableRow";

const TABLE_TH_CLASS =
  "sticky top-0 z-10 bg-[var(--enterprise-bg)] px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]";

type IssuesListsProps = {
  isPending: boolean;
  listTitle: string;
  filtered: IssueRow[];
  totalCount: number;
  projectId: string;
  entitySingular: string;
  canCreate: boolean;
  onCreateClick: () => void;
  ListIcon: LucideIcon;
  isWorkOrders: boolean;
  nowMs: number;
  patchingIssueId: string | null;
  deletingIssueId: string | null;
  promotingIssueId: string | null;
  canPromoteOccupant: boolean;
  onStatusChange: (issueId: string, status: string) => void;
  onDeleteClick: (issue: IssueRow) => void;
  onEditClick: (issue: IssueRow) => void;
  onPromote: (issueId: string) => void;
};

function IssuesLoadingCard() {
  return (
    <div className="enterprise-card py-16">
      <EnterpriseLoadingState
        variant="minimal"
        message="Loading issues…"
        label="Loading project issues"
      />
    </div>
  );
}

function IssuesTableHead() {
  return (
    <thead>
      <tr className="border-b border-[var(--enterprise-border)]">
        <th className={TABLE_TH_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Issue
          </span>
        </th>
        <th className={TABLE_TH_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Status
          </span>
        </th>
        <th className={TABLE_TH_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Assignee
          </span>
        </th>
        <th className={TABLE_TH_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <Flag className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Priority
          </span>
        </th>
        <th className={TABLE_TH_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Due
          </span>
        </th>
        <th className={TABLE_TH_CLASS}>
          <span className="flex items-center justify-end gap-1.5">
            <ExternalLink className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
            Actions
          </span>
        </th>
      </tr>
    </thead>
  );
}

function IssuesMobileList({
  listTitle,
  filtered,
  empty,
  rowPropsFor,
}: {
  listTitle: string;
  filtered: IssueRow[];
  empty: ReactNode;
  rowPropsFor: (issue: IssueRow) => IssueRowProps;
}) {
  return (
    <ul className="space-y-3 lg:hidden" aria-label={listTitle}>
      {filtered.length === 0 ? (
        <li className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]">
          {empty}
        </li>
      ) : (
        filtered.map((issue) => <ProjectIssueMobileCard key={issue.id} {...rowPropsFor(issue)} />)
      )}
    </ul>
  );
}

function IssuesDesktopTable({
  filtered,
  empty,
  rowPropsFor,
}: {
  filtered: IssueRow[];
  empty: ReactNode;
  rowPropsFor: (issue: IssueRow) => IssueRowProps;
}) {
  return (
    <div className="enterprise-card hidden overflow-hidden rounded-2xl p-0 lg:block">
      <div className="mobile-table-wrap max-h-[calc(100dvh-15rem)] overflow-auto">
        <table className="w-full min-w-[720px] text-left">
          <IssuesTableHead />
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-0">
                  {empty}
                </td>
              </tr>
            ) : (
              filtered.map((issue) => (
                <ProjectIssueTableRow key={issue.id} {...rowPropsFor(issue)} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IssuesLists(props: IssuesListsProps) {
  if (props.isPending) return <IssuesLoadingCard />;

  const empty = (
    <IssueEmptyState
      noRows={props.totalCount === 0}
      projectId={props.projectId}
      entityLabel={props.entitySingular}
      canCreate={props.canCreate}
      onCreateClick={props.onCreateClick}
      emptyIcon={props.ListIcon}
      emptyHint={
        props.isWorkOrders
          ? "Create a work order tied to project equipment, or generate one from maintenance schedules."
          : undefined
      }
    />
  );

  const rowPropsFor = (issue: IssueRow): IssueRowProps => ({
    issue,
    nowMs: props.nowMs,
    isPatching: props.patchingIssueId === issue.id,
    isDeleting: props.deletingIssueId === issue.id,
    onStatusChange: props.onStatusChange,
    onDeleteClick: props.onDeleteClick,
    onEditClick: props.onEditClick,
    showPromoteOccupant: props.canPromoteOccupant,
    onPromoteToWorkOrder: props.onPromote,
    promoteBusy: props.promotingIssueId === issue.id,
  });

  return (
    <>
      <IssuesMobileList
        listTitle={props.listTitle}
        filtered={props.filtered}
        empty={empty}
        rowPropsFor={rowPropsFor}
      />
      <IssuesDesktopTable filtered={props.filtered} empty={empty} rowPropsFor={rowPropsFor} />
    </>
  );
}
