/**
 * Shared row props + compact icon-action styles for desktop table and mobile cards.
 * Both list UIs take the same callbacks so IssuesLists can build one props factory.
 */

import type { LucideIcon } from "lucide-react";
import type { IssueRow } from "@/lib/api-client";

export type IssueRowProps = {
  issue: IssueRow;
  nowMs: number;
  isPatching: boolean;
  isDeleting: boolean;
  onStatusChange: (issueId: string, status: string) => void;
  onDeleteClick: (issue: IssueRow) => void;
  onEditClick: (issue: IssueRow) => void;
  showPromoteOccupant?: boolean;
  onPromoteToWorkOrder?: (issueId: string) => void;
  promoteBusy?: boolean;
};

export const ROW_ACTION_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/40 disabled:opacity-40";

export const ROW_ACTION_DANGER_CLASS =
  "hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]";

export type RowActionProps = {
  label: string;
  Icon: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};
