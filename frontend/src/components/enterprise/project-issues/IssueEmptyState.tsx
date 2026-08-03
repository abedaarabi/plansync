/**
 * Empty / no-matches state for the issues list (desktop table + mobile cards).
 * Distinguishes “project has zero items” from “filters hid everything”.
 */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { FolderOpen, MapPin, Plus } from "lucide-react";

export function IssueEmptyState({
  noRows,
  projectId,
  entityLabel,
  canCreate,
  onCreateClick,
  emptyIcon: EmptyIcon = MapPin,
  emptyHint,
}: {
  noRows: boolean;
  projectId: string;
  entityLabel: string;
  canCreate: boolean;
  onCreateClick?: () => void;
  emptyIcon?: LucideIcon;
  emptyHint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-10 text-center sm:py-12">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
        <EmptyIcon
          className="h-7 w-7 text-[var(--enterprise-primary)]"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--enterprise-text)]">
          {noRows ? `No ${entityLabel}s yet` : "No matches"}
        </p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          {noRows
            ? canCreate
              ? (emptyHint ??
                `Create a ${entityLabel} here, or open a PDF from Files to place a pin on the sheet.`)
              : `No ${entityLabel}s in this project yet.`
            : "Try a different search or filter combination, or reset filters to see all items."}
        </p>
      </div>
      {noRows && canCreate && onCreateClick ? (
        <button
          type="button"
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--enterprise-shadow-sm)] transition hover:bg-[var(--enterprise-primary-deep)]"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          New {entityLabel}
        </button>
      ) : noRows ? (
        <Link
          href={`/projects/${projectId}/files`}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/30 hover:bg-[var(--enterprise-hover-surface)]"
        >
          <FolderOpen className="h-4 w-4 text-[var(--enterprise-primary)]" strokeWidth={1.75} />
          Open project files
        </Link>
      ) : null}
    </div>
  );
}
