"use client";

/**
 * Loading placeholders for the file explorer shell — shimmer + layout match.
 */
export function FileExplorerPageSkeleton() {
  return (
    <div className="enterprise-animate-in flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-[var(--enterprise-shadow-card)] ring-1 ring-slate-900/[0.04]">
      {/* Indeterminate progress strip */}
      <div className="h-1 w-full overflow-hidden bg-slate-100/90">
        <div className="viewer-pdf-load-indeterminate h-full w-2/5 rounded-full bg-gradient-to-r from-[var(--enterprise-primary)]/25 via-[var(--enterprise-primary)]/55 to-[var(--enterprise-primary)]/25" />
      </div>
      <div className="h-16 shrink-0 border-b border-slate-100 bg-gradient-to-b from-slate-50/95 to-white px-4 md:px-6">
        <div className="flex h-full items-center gap-3">
          <div className="enterprise-skeleton h-8 w-8 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="enterprise-skeleton h-3.5 w-40 max-w-[50%] rounded-md" />
            <div className="enterprise-skeleton h-2.5 w-24 rounded-md" />
          </div>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)] md:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-slate-100 bg-slate-50/50 p-4">
          <div className="enterprise-skeleton mb-4 h-3 w-16 rounded-md" />
          <div className="space-y-2">
            <div className="enterprise-skeleton h-9 rounded-lg" />
            <div className="enterprise-skeleton h-8 rounded-lg pl-3" />
            <div className="enterprise-skeleton h-8 rounded-lg pl-5" />
            <div className="enterprise-skeleton h-8 rounded-lg pl-5" />
            <div className="enterprise-skeleton h-8 rounded-lg pl-3" />
          </div>
        </aside>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-50 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="enterprise-skeleton h-4 w-28 rounded-md" />
            <div className="flex gap-1 rounded-lg border border-slate-200/80 bg-white p-0.5">
              <div className="enterprise-skeleton h-8 w-8 rounded-md" />
              <div className="enterprise-skeleton h-8 w-8 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-slate-100/90 bg-white shadow-sm ring-1 ring-slate-900/[0.03]"
              >
                <div className="enterprise-skeleton aspect-[5/3] rounded-none rounded-t-xl" />
                <div className="space-y-2 border-t border-slate-100 bg-white p-2.5">
                  <div className="enterprise-skeleton h-3.5 w-[85%] rounded-md" />
                  <div className="enterprise-skeleton h-2.5 w-1/2 rounded-md" />
                  <div className="enterprise-skeleton h-2.5 w-2/3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
