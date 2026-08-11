"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MaterialsPagedResponse } from "@/lib/api-client";

type Props = {
  paged: MaterialsPagedResponse | undefined;
  onPageChange: (page: number) => void;
};

export function MaterialsCatalogPagination({ paged, onPageChange }: Props) {
  const rangeStart = paged && paged.total > 0 ? (paged.page - 1) * paged.pageSize + 1 : 0;
  const rangeEnd =
    paged && paged.total > 0 ? Math.min(paged.page * paged.pageSize, paged.total) : 0;
  const page = paged?.page ?? 1;
  const totalPages = paged?.totalPages ?? 1;

  return (
    <div className="shrink-0 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-3.5 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-[var(--enterprise-text-muted)]">
          Showing{" "}
          <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
            {rangeStart}
          </span>
          –
          <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
            {rangeEnd}
          </span>{" "}
          of{" "}
          <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
            {paged?.total ?? 0}
          </span>{" "}
          materials
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!paged || page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Previous
          </button>
          <span className="min-w-[4.5rem] text-center text-xs font-semibold tabular-nums text-[var(--enterprise-text)]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={!paged || page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
