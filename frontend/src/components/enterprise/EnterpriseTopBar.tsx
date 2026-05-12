"use client";

import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  Menu,
  MessageSquareQuote,
  Ruler,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { UserMenu } from "./UserMenu";
import { EnterpriseIconButton } from "./EnterpriseIconButton";
import { ProjectPicker } from "./ProjectPicker";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import {
  fetchMeNotifications,
  fetchProjects,
  markAllNotificationsRead,
  markNotificationsRead,
  type MeNotificationRow,
} from "@/lib/api-client";
import { DEFAULT_ENTERPRISE_PRIMARY_HEX } from "@/lib/enterpriseTheme";
import { qk } from "@/lib/queryKeys";
import { userInitials } from "@/lib/user-initials";
import { isWorkspaceProClient, trialDaysLeft } from "@/lib/workspaceSubscription";
import { isSuperAdmin } from "@/lib/workspaceRole";
import { clearAppBadgeSafe, syncAppBadgeFromUnreadCount } from "@/lib/appBadge";
import Link from "next/link";
import { useTranslations } from "next-intl";

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

function resolveGlobalTitle(pathname: string, tGlobal: (key: string) => string): string | null {
  const exact: Record<string, string> = {
    "/dashboard": "dashboard",
    "/account": "account",
    "/organization": "organization",
    "/projects": "projects",
    "/materials": "materials",
  };
  const k = exact[pathname];
  if (k) return tGlobal(k);
  if (pathname.includes("/materials")) return tGlobal("materials");
  return null;
}

type EnterpriseTopBarProps = {
  onOpenCommandPalette: () => void;
  onToggleMobileNav: () => void;
  /** Mobile drawer open — drives menu button `aria-expanded`. Desktop nav is a separate column. */
  mobileNavOpen: boolean;
  desktopSidebarCollapsed: boolean;
  onToggleDesktopSidebar: () => void;
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

export function EnterpriseTopBar({
  onOpenCommandPalette,
  onToggleMobileNav,
  mobileNavOpen,
  desktopSidebarCollapsed,
  onToggleDesktopSidebar,
}: EnterpriseTopBarProps) {
  const pathname = usePathname();
  const t = useTranslations("app.topBar");
  const tTools = useTranslations("app.topBar.tools");
  const tGlobal = useTranslations("app.topBar.global");

  const formatNotifyTime = useCallback(
    (iso: string) => {
      const d = new Date(iso);
      const diff = Math.max(0, Date.now() - d.getTime());
      const mins = Math.floor(diff / 60_000);
      if (mins < 1) return t("timeJustNow");
      if (mins < 60) return `${mins}m`;
      const h = Math.floor(mins / 60);
      if (h < 24) return `${h}h`;
      const days = Math.floor(h / 24);
      if (days < 7) return `${days}d`;
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    },
    [t],
  );

  const qc = useQueryClient();
  const { primary, me } = useEnterpriseWorkspace();
  const pathWid = pathname.match(/^\/workspaces\/([^/]+)/)?.[1];
  const workspaceFromPath =
    pathWid && pathWid !== "new"
      ? me?.workspaces?.find((w) => w.workspace.id === pathWid)?.workspace
      : undefined;
  const activeWs = workspaceFromPath ?? primary?.workspace;
  const wid = activeWs?.id;
  const workspaceNameForAria = activeWs?.name?.trim() || "PlanSync";
  const isPro = isWorkspaceProClient(activeWs);
  const trialDays =
    activeWs?.subscriptionStatus === "trialing" ? trialDaysLeft(activeWs.currentPeriodEnd) : null;

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

  useEffect(() => {
    if (!me) {
      clearAppBadgeSafe();
      return;
    }
    syncAppBadgeFromUnreadCount(unreadCount);
  }, [me, unreadCount]);

  function onNotificationNavigate(n: MeNotificationRow) {
    if (!n.readAt) markReadMut.mutate([n.id]);
    setNotifOpen(false);
  }

  const projectId = extractProjectId(pathname);
  const globalPageTitle = resolveGlobalTitle(pathname, tGlobal);
  const isProjectContext = Boolean(projectId);
  const activeProject = projectId ? projects.find((p) => p.id === projectId) : null;
  const toolSegment = extractToolSegment(pathname);
  const toolLabel =
    toolSegment && Object.hasOwn(TOOL_ICONS, toolSegment)
      ? tTools(toolSegment as keyof typeof TOOL_ICONS)
      : null;
  const ToolIcon = toolSegment ? TOOL_ICONS[toolSegment] : undefined;
  /** Project sub-routes live under `/projects/...` only; workspace-prefixed pages exist only for takeoff, team, and materials. */
  const projectHomeHref = projectId ? `/projects/${projectId}/home` : "/projects";

  return (
    <header className="sticky top-0 z-50 flex shrink-0 flex-col border-b border-[var(--enterprise-border)]/80 bg-[color-mix(in_srgb,var(--enterprise-surface)_88%,transparent)] pt-[env(safe-area-inset-top,0px)] shadow-[0_1px_0_0_rgba(255,255,255,0.72)_inset,0_8px_36px_-22px_rgba(15,23,42,0.04)] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--enterprise-surface)_78%,transparent)]">
      <div className="flex h-[var(--enterprise-topbar-h)] min-h-[var(--enterprise-topbar-h)] w-full items-center justify-between gap-1.5 px-2 sm:gap-2.5 sm:px-3 md:gap-3 md:px-4 lg:gap-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] sm:gap-2 sm:text-[13px] md:text-sm">
          {/* Mobile menu */}
          <EnterpriseIconButton
            type="button"
            onClick={onToggleMobileNav}
            size="md"
            className="border-[var(--enterprise-border)]/90 bg-[var(--enterprise-surface)]/95 text-[var(--enterprise-text)] lg:hidden"
            aria-label={mobileNavOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={mobileNavOpen}
            aria-controls="enterprise-sidebar-panel"
          >
            {mobileNavOpen ? (
              <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
            ) : (
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
            )}
          </EnterpriseIconButton>

          {/* Breadcrumb */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 md:gap-3">
            <button
              type="button"
              onClick={onToggleDesktopSidebar}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25 lg:flex"
              aria-label={desktopSidebarCollapsed ? t("expandSidebar") : t("collapseSidebar")}
              title={desktopSidebarCollapsed ? t("expandSidebar") : t("collapseSidebar")}
            >
              {desktopSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
            <span
              className="hidden shrink-0 select-none items-baseline gap-0 font-bold tracking-tight sm:inline-flex"
              aria-label={workspaceNameForAria}
            >
              <span className="text-[var(--enterprise-text)]">Plan</span>
              <span style={{ color: DEFAULT_ENTERPRISE_PRIMARY_HEX }}>Sync</span>
            </span>
            <div className="hidden h-4 w-px shrink-0 bg-[var(--enterprise-border)] sm:block" />
            <WorkspaceSwitcher />

            {isProjectContext ? (
              <nav
                className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden text-[12px] sm:gap-1 sm:text-[13px]"
                aria-label={t("breadcrumb")}
              >
                <Link
                  href="/projects"
                  className="hidden min-[400px]:inline shrink-0 font-medium text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-text)]"
                >
                  {t("projects")}
                </Link>
                <ChevronRight className="hidden min-[400px]:inline h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] opacity-50" />
                <Link
                  href={projectHomeHref}
                  className="min-w-0 max-w-[9rem] flex-1 truncate font-medium text-[var(--enterprise-text)] transition hover:opacity-80 sm:max-w-[11rem] md:max-w-[180px] md:flex-none"
                  title={activeProject?.name ?? undefined}
                >
                  {activeProject?.name ?? "…"}
                </Link>
                {toolLabel && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] opacity-50" />
                    <span className="flex min-w-0 max-w-[5.5rem] shrink-0 items-center gap-1 sm:max-w-[10rem] md:max-w-none">
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
                className="flex min-w-0 flex-1 items-center gap-1 text-[12px] sm:text-[13px]"
                aria-label={t("workspaceContext")}
              >
                {globalPageTitle ? (
                  <>
                    <span className="max-w-[7rem] truncate font-medium text-[var(--enterprise-text)] sm:max-w-[200px]">
                      {globalPageTitle}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] opacity-50" />
                  </>
                ) : null}
                <ProjectPicker />
              </nav>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2">
          {activeWs?.subscriptionStatus === "trialing" ? (
            <Link
              href={isSuperAdmin(primary?.role) ? "/organization?tab=billing" : "/organization"}
              className="hidden rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100 md:inline-flex"
            >
              {activeWs.stripeSubscriptionId
                ? trialDays === 0
                  ? t("trialManageBilling")
                  : trialDays != null
                    ? t("trialStripe", { days: trialDays })
                    : t("trialStripeGeneric")
                : trialDays === 0
                  ? t("trialEnded")
                  : trialDays != null
                    ? trialDays === 1
                      ? t("trialOneDayLeft")
                      : t("trialManyDaysLeft", { days: trialDays })
                    : t("trialFree")}
            </Link>
          ) : null}

          {/* Search / Command Palette */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label={t("search")}
            className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)]/95 bg-[var(--enterprise-surface)]/90 text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25 sm:w-auto sm:max-w-[min(48vw,220px)] sm:justify-start sm:gap-2 sm:px-2.5 sm:text-left sm:text-[13px] lg:max-w-[min(100%,280px)] lg:px-3"
          >
            <Search className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
            <span className="hidden flex-1 sm:inline">{t("searchEllipsis")}</span>
            <kbd className="ml-auto hidden rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--enterprise-text-muted)] lg:inline">
              {t("searchShortcut")}
            </kbd>
          </button>

          {/* Notifications */}
          <div ref={notifWrapRef} className="relative">
            <EnterpriseIconButton
              type="button"
              className="relative text-[var(--enterprise-text-muted)]"
              onClick={() => {
                setNotifOpen((o) => !o);
                void notifQuery.refetch();
              }}
              aria-label={
                unreadCount > 0
                  ? t("notificationsUnread", { count: unreadCount })
                  : t("notifications")
              }
              aria-expanded={notifOpen}
              aria-haspopup="dialog"
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--enterprise-primary)] px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_0_2px_var(--enterprise-surface)]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </EnterpriseIconButton>

            {notifOpen ? (
              <div
                role="dialog"
                aria-label={t("notifications")}
                className="fixed left-2 right-2 top-[calc(var(--enterprise-topbar-offset)_+_0.25rem)] z-[100] max-h-[min(24rem,70vh)] w-auto overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-lg sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-[calc(100%+6px)] sm:mt-0 sm:max-h-[min(24rem,70vh)] sm:w-[min(calc(100vw-1.5rem),24rem)] md:w-[26rem]"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--enterprise-border)] px-3 py-3">
                  <span className="text-sm font-semibold text-[var(--enterprise-text)]">
                    {t("notifications")}
                  </span>
                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      disabled={markAllMut.isPending}
                      onClick={() => markAllMut.mutate()}
                      className="min-h-10 rounded-md px-2 text-xs font-medium text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-50"
                    >
                      {t("markAllRead")}
                    </button>
                  ) : null}
                </div>
                <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
                  {notifQuery.isPending ? (
                    <p className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
                      {t("notifLoading")}
                    </p>
                  ) : notifQuery.isError ? (
                    <p className="px-3 py-6 text-center text-sm text-red-600">{t("notifError")}</p>
                  ) : notifItems.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
                      {t("notifEmpty")}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--enterprise-border)]">
                      {notifItems.map((n) => (
                        <li key={n.id}>
                          <Link
                            href={n.href}
                            onClick={() => onNotificationNavigate(n)}
                            className={`flex min-h-12 gap-2.5 px-3 py-2.5 transition hover:bg-[var(--enterprise-hover-surface)] ${
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
                                <Bell
                                  className="h-4 w-4 opacity-70"
                                  strokeWidth={1.75}
                                  aria-hidden
                                />
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
                <div className="border-t border-[var(--enterprise-border)] px-3 py-2.5">
                  <Link
                    href="/account"
                    onClick={() => setNotifOpen(false)}
                    className="inline-flex min-h-10 items-center rounded-md px-2 text-xs font-medium text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-hover-surface)]"
                  >
                    {t("deviceAlertsLink")}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
