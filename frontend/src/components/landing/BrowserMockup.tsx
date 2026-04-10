export function BrowserMockup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--enterprise-shadow-card)] ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100/95 bg-linear-to-b from-slate-50 to-white px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/95 shadow-sm ring-1 ring-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/95 shadow-sm ring-1 ring-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/95 shadow-sm ring-1 ring-black/10" />
        </div>
        <div className="mx-auto flex h-7 min-w-0 max-w-[min(16rem,72%)] flex-1 items-center justify-center rounded-lg bg-slate-100/90 px-3 text-[11px] font-medium tracking-tight text-slate-500 ring-1 ring-slate-200/80">
          <span className="truncate">plansync.dev</span>
        </div>
        <span className="w-[52px] shrink-0" aria-hidden />
      </div>
      {children}
    </div>
  );
}
