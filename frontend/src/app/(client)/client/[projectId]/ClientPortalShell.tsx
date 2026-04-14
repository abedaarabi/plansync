"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe, fetchProjectSession } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { QueryProvider } from "@/providers/QueryProvider";

function ClientNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const { data: session } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });
  const c = session?.settings.clientVisibility;
  const tabs = [
    { href: `/client/${projectId}`, label: "Drawings" },
    ...(c?.showIssues !== false ? [{ href: `/client/${projectId}/issues`, label: "Issues" }] : []),
    ...(c?.showFieldReports !== false
      ? [{ href: `/client/${projectId}/reports`, label: "Reports" }]
      : []),
    { href: `/client/${projectId}/proposals`, label: "Proposals" },
  ];
  return (
    <nav className="flex w-full gap-1 overflow-x-auto pb-1 sm:gap-2" aria-label="Client portal">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition sm:min-h-[44px] sm:px-4 ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ClientPortalShell({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const { data: me } = useQuery({ queryKey: qk.me(), queryFn: fetchMe });

  return (
    <QueryProvider>
      <div className="flex min-h-dvh min-w-0 max-w-full flex-col overflow-x-hidden bg-white text-slate-900">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-[15px] font-semibold tracking-tight text-blue-600">
                PlanSync
              </span>
              <span className="truncate text-sm text-slate-500">Client portal</span>
            </div>
            <div className="text-sm text-slate-600">
              {me?.user?.name ? (
                <span className="font-medium text-slate-800">{me.user.name}</span>
              ) : null}
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6">
            <ClientNav projectId={projectId} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </QueryProvider>
  );
}
