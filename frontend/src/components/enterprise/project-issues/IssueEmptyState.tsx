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
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center sm:py-10">
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]">
        <EmptyIcon
          className="h-4 w-4 text-[var(--enterprise-text-muted)]"
          strokeWidth={1.75}
          aria-hidden
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--enterprise-text)]">
          {noRows ? `No ${entityLabel}s yet` : "No matches"}
        </p>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
          {noRows
            ? canCreate
              ? (emptyHint ??
                `Create a ${entityLabel}, or open a drawing to place a pin on the sheet.`)
              : `No ${entityLabel}s in this project yet.`
            : "Try a different search or filter, or reset filters."}
        </p>
      </div>
      {noRows && canCreate && onCreateClick ? (
        <button
          type="button"
          onClick={onCreateClick}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--enterprise-primary)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--enterprise-primary-deep)]"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          New {entityLabel}
        </button>
      ) : noRows ? (
        <Link
          href={`/projects/${projectId}/files`}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
        >
          <FolderOpen className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
          Open project files
        </Link>
      ) : null}
    </div>
  );
}
