"use client";

import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Bell,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  Menu,
  MessageSquareQuote,
  Ruler,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { UserMenu } from "./UserMenu";
import { ProjectPicker } from "./ProjectPicker";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import {
  fetchMeNotifications,
  fetchProjects,
  markAllNotificationsRead,
  markNotificationsRead,
  type MeNotificationRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { userInitials } from "@/lib/user-initials";
import Link from "next/link";

const TOOL_LABELS: Record<string, string> = {
  files: "Files & Drawings",
  issues: "Issues",
  rfi: "RFIs",
  takeoff: "Quantity Takeoff",
  punch: "Punch List",
  reports: "Field Reports",
  team: "Team",
  settings: "Project Settings",
};

const TOOL_ICONS: Record<string, LucideIcon> = {
  files: FileStack,
  issues: AlertCircle,
  rfi: MessageSquareQuote,
  takeoff: Ruler,
  punch: ClipboardCheck,
  reports: ClipboardList,
  team: Users,
  settings: Settings,
};

const GLOBAL_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/account": "Account",
  "/organization": "Organization",
  "/projects": "Projects",
  "/materials": "Materials",
};

function resolveGlobalTitle(pathname: string): string | null {
  if (GLOBAL_TITLES[pathname]) return GLOBAL_TITLES[pathname];
  if (pathname.includes("/materials")) return "Materials";
  return null;
}

type EnterpriseTopBarProps = {
  onOpenCommandPalette: () => void;
  onOpenMobileNav: () => void;
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
};

function extractProjectId(pathname: string): string | null {
  const match =
    pathname.match(/^\/projects\/([^/]+)/) ??
    pathname.match(/^\/workspaces\/[^/]+\/projects\/([^/]+)/);
  if (!match) return null;
  const segment = match[1];
  if (segment === "new") return null;
  return segment;
}

function extractToolSegment(pathname: string): string | null {
  const match =
    pathname.match(/^\/projects\/[^/]+\/([^/]+)/) ??
    pathname.match(/^\/workspaces\/[^/]+\/projects\/[^/]+\/([^/]+)/);
  return match ? match[1] : null;
}

function formatNotifyTime(iso: string): string {
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function EnterpriseTopBar({
  onOpenCommandPalette,
  onOpenMobileNav,
  sidebarExpanded,
  onToggleSidebar,
}: EnterpriseTopBarProps) {
  const pathname = usePathname();
  const qc = useQueryClient();
  const { primary } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = primary?.workspace.subscriptionStatus === "active";

  const [notifOpen, setNotifOpen] = useState(false);
  const notifWrapRef = useRef<HTMLDivElement>(null);

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const notifQuery = useQuery({
    queryKey: qk.meNotifications(),
    queryFn: () => fetchMeNotifications(30),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const unreadCount = notifQuery.data?.unreadCount ?? 0;
  const notifItems = notifQuery.data?.items ?? [];

  const markReadMut = useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(ids),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.meNotifications() }),
  });

  const markAllMut = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.meNotifications() }),
  });

  useEffect(() => {
    if (!notifOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = notifWrapRef.current;
      if (el && !el.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notifOpen]);

  function onNotificationNavigate(n: MeNotificationRow) {
    if (!n.readAt) markReadMut.mutate([n.id]);
    setNotifOpen(false);
  }

  const projectId = extractProjectId(pathname);
  const isProjectContext = Boolean(projectId);
  const activeProject = projectId ? projects.find((p) => p.id === projectId) : null;
  const toolSegment = extractToolSegment(pathname);
  const toolLabel = toolSegment ? (TOOL_LABELS[toolSegment] ?? null) : null;
  const ToolIcon = toolSegment ? TOOL_ICONS[toolSegment] : undefined;
  /** Project sub-routes live under `/projects/...` only; workspace-prefixed pages exist only for takeoff, team, and materials. */
  const projectHomeHref = projectId ? `/projects/${projectId}/home` : "/projects";

  return (
    <header className="sticky top-0 z-50 flex h-[3.25rem] shrink-0 items-center justify-between gap-3 border-b border-[var(--enterprise-border)]/80 bg-[color-mix(in_srgb,var(--enterprise-surface)_88%,transparent)] px-3 shadow-[0_1px_0_0_rgba(255,255,255,0.72)_inset,0_4px_24px_-16px_rgba(15,23,42,0.06)] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--enterprise-surface)_78%,transparent)] sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] sm:text-sm">
        {/* Mobile menu */}
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-surface)]/95 text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>

        {/* Sidebar toggle (desktop) */}
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarExpanded ? "Collapse sidebar (more space)" : "Expand sidebar"}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-surface)]/95 text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30 lg:inline-flex"
          aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={sidebarExpanded}
        >
          {sidebarExpanded ? (
            <ChevronsLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
          ) : (
            <ChevronsRight className="h-[18px] w-[18px]" strokeWidth={1.75} />
          )}
        </button>

        {/* Breadcrumb */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span
            className="flex shrink-0 select-none items-baseline gap-0 font-bold tracking-tight"
            aria-label="PlanSync"
          >
            <span className="text-[var(--enterprise-text)]">Plan</span>
            <span className="text-[var(--enterprise-primary)]">Sync</span>
          </span>
          <div className="hidden h-4 w-px bg-[var(--enterprise-border)] sm:block" />

          {isProjectContext ? (
            <nav className="flex min-w-0 items-center gap-1 text-[13px]" aria-label="Breadcrumb">
              <Link
                href="/projects"
                className="shrink-0 font-medium text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-text)]"
              >
                Projects
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] opacity-50" />
              <Link
                href={projectHomeHref}
                className="max-w-[180px] truncate font-medium text-[var(--enterprise-text)] transition hover:opacity-80"
              >
                {activeProject?.name ?? "…"}
              </Link>
              {toolLabel && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] opacity-50" />
                  <span className="flex min-w-0 items-center gap-1.5">
                    {ToolIcon ? (
                      <ToolIcon
                        className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    ) : null}
                    <span className="truncate font-medium text-[var(--enterprise-text)]">
                      {toolLabel}
                    </span>
                  </span>
                </>
              )}
            </nav>
          ) : (
            <nav
              className="flex min-w-0 items-center gap-1 text-[13px]"
              aria-label="Workspace context"
            >
              {resolveGlobalTitle(pathname) ? (
                <>
                  <span className="max-w-[200px] truncate font-medium text-[var(--enterprise-text)]">
                    {resolveGlobalTitle(pathname)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] opacity-50" />
                </>
              ) : null}
              <ProjectPicker />
            </nav>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Search / Command Palette */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="group flex h-9 max-w-[min(100%,280px)] items-center gap-2 rounded-xl border border-[var(--enterprise-border)]/95 bg-[var(--enterprise-surface)]/90 px-3 text-left text-[13px] text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25"
        >
          <Search className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
          <span className="hidden flex-1 sm:inline">Search…</span>
          <kbd className="ml-auto hidden rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--enterprise-text-muted)] sm:inline">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <div ref={notifWrapRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((o) => !o);
              void notifQuery.refetch();
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--enterprise-border)]/95 bg-[var(--enterprise-surface)]/90 text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--enterprise-primary)] px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_0_2px_var(--enterprise-surface)]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>

          {notifOpen ? (
            <div
              role="dialog"
              aria-label="Notifications"
              className="absolute right-0 top-[calc(100%+6px)] z-[100] w-[min(calc(100vw-1.5rem),22rem)] overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-lg sm:w-[24rem]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--enterprise-border)] px-3 py-2.5">
                <span className="text-sm font-semibold text-[var(--enterprise-text)]">
                  Notifications
                </span>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    disabled={markAllMut.isPending}
                    onClick={() => markAllMut.mutate()}
                    className="text-xs font-medium text-[var(--enterprise-primary)] hover:underline disabled:opacity-50"
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>
              <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
                {notifQuery.isPending ? (
                  <p className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
                    Loading…
                  </p>
                ) : notifQuery.isError ? (
                  <p className="px-3 py-6 text-center text-sm text-red-600">
                    Could not load notifications.
                  </p>
                ) : notifItems.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
                    No notifications yet. RFI updates for your projects will appear here.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--enterprise-border)]">
                    {notifItems.map((n) => (
                      <li key={n.id}>
                        <Link
                          href={n.href}
                          onClick={() => onNotificationNavigate(n)}
                          className={`flex gap-2.5 px-3 py-2.5 transition hover:bg-[var(--enterprise-hover-surface)] ${
                            n.readAt ? "" : "bg-[var(--enterprise-primary)]/[0.06]"
                          }`}
                        >
                          <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] text-[10px] font-semibold text-[var(--enterprise-text-muted)]">
                            {n.actor ? (
                              n.actor.image ? (
                                // eslint-disable-next-line @next/next/no-img-element -- profile URL from auth
                                <img
                                  src={n.actor.image}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                userInitials(n.actor.name, n.actor.email ?? null)
                              )
                            ) : (
                              <Bell className="h-4 w-4 opacity-70" strokeWidth={1.75} aria-hidden />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-sm leading-snug ${
                                  n.readAt
                                    ? "text-[var(--enterprise-text)]"
                                    : "font-medium text-[var(--enterprise-text)]"
                                }`}
                              >
                                {n.title}
                              </p>
                              <span className="shrink-0 text-[10px] text-[var(--enterprise-text-muted)]">
                                {formatNotifyTime(n.createdAt)}
                              </span>
                            </div>
                            {n.actor ? (
                              <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                                {n.actor.name}
                              </p>
                            ) : null}
                            {n.body ? (
                              <p className="mt-1 line-clamp-2 text-xs text-[var(--enterprise-text-muted)]">
                                {n.body}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <UserMenu />
      </div>
    </header>
  );
}
