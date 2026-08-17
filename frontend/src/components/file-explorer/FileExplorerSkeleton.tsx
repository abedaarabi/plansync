"use client";

/**
 * Loading placeholders for the file explorer shell — shimmer + layout match.
 */
export function FileExplorerPageSkeleton() {
  return (
    <div className="enterprise-animate-in flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="h-0.5 w-full overflow-hidden bg-[var(--enterprise-hover-surface)]">
        <div className="viewer-pdf-load-indeterminate h-full w-2/5 bg-[var(--enterprise-primary)]/40" />
      </div>
      <div className="h-14 shrink-0 bg-[var(--enterprise-surface)] px-4 sm:px-5">
        <div className="flex h-full items-center gap-3">
          <div className="enterprise-skeleton h-8 w-8 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="enterprise-skeleton h-3.5 w-40 max-w-[50%] rounded-md" />
            <div className="enterprise-skeleton h-2.5 w-24 rounded-md" />
          </div>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-y-auto bg-[var(--enterprise-hover-surface)]/50 p-3 lg:block">
          <div className="enterprise-skeleton mb-3 h-3 w-16 rounded-md" />
          <div className="space-y-2">
            <div className="enterprise-skeleton h-8 rounded-md" />
            <div className="enterprise-skeleton h-8 rounded-md" />
            <div className="enterprise-skeleton h-8 rounded-md" />
            <div className="enterprise-skeleton h-8 rounded-md" />
          </div>
        </aside>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--enterprise-bg)] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="enterprise-skeleton h-4 w-28 rounded-md" />
            <div className="flex gap-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-0.5">
              <div className="enterprise-skeleton h-8 w-8 rounded-md" />
              <div className="enterprise-skeleton h-8 w-8 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]"
              >
                <div className="enterprise-skeleton aspect-[5/3] rounded-none" />
                <div className="space-y-2 border-t border-[var(--enterprise-border)] p-2.5">
                  <div className="enterprise-skeleton h-3.5 w-[85%] rounded-md" />
                  <div className="enterprise-skeleton h-2.5 w-1/2 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
