"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe, fetchProjectSession } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { QueryProvider } from "@/providers/QueryProvider";
import { CLIENT_TAB_ICONS, ClientMobileBottomNav } from "@/components/client/ClientMobileBottomNav";

export function ClientPortalShell({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: me } = useQuery({ queryKey: qk.me(), queryFn: fetchMe });
  const { data: session } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });
  const c = session?.settings.clientVisibility;

  const tabs = [
    {
      id: "drawings",
      href: `/client/${projectId}`,
      label: "Drawings",
      icon: CLIENT_TAB_ICONS.drawings,
    },
    ...(c?.showIssues !== false
      ? [
          {
            id: "issues",
            href: `/client/${projectId}/issues`,
            label: "Issues",
            icon: CLIENT_TAB_ICONS.issues,
          },
        ]
      : []),
    ...(c?.showFieldReports !== false
      ? [
          {
            id: "reports",
            href: `/client/${projectId}/reports`,
            label: "Reports",
            icon: CLIENT_TAB_ICONS.reports,
          },
        ]
      : []),
    {
      id: "proposals",
      href: `/client/${projectId}/proposals`,
      label: "Proposals",
      icon: CLIENT_TAB_ICONS.proposals,
    },
  ];

  const activeTab = tabs.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
  const parentHref =
    activeTab && pathname !== activeTab.href ? activeTab.href : `/client/${projectId}`;

  return (
    <QueryProvider>
      <div className="flex min-h-[100dvh] min-w-0 max-w-full flex-col overflow-x-hidden bg-white text-slate-900">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
          <div className="flex min-h-[var(--enterprise-topbar-h)] items-center gap-2 px-4">
            {pathname !== `/client/${projectId}` && activeTab ? (
              <Link
                href={parentHref}
                className="flex min-h-11 shrink-0 items-center gap-0.5 rounded-xl px-1 text-sm font-semibold text-blue-600 transition-all duration-150 active:scale-[0.97] active:bg-slate-100 lg:hidden"
              >
                <span aria-hidden>‹</span>
                <span className="truncate max-w-[8rem]">{activeTab.label}</span>
              </Link>
            ) : null}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-base font-semibold tracking-tight text-blue-600">
                  PlanSync
                </span>
                <p className="truncate text-sm text-slate-500">
                  {activeTab?.label ?? "Client portal"}
                </p>
              </div>
              {me?.user?.name ? (
                <span className="truncate text-sm font-medium text-slate-800">{me.user.name}</span>
              ) : null}
            </div>
          </div>
        </header>
        <main className="client-portal-scroll client-portal-main mobile-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {children}
        </main>
        <ClientMobileBottomNav tabs={tabs} />
      </div>
    </QueryProvider>
  );
}
