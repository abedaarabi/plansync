"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  MessageSquareQuote,
  Ruler,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { EnterpriseNotificationsBell } from "./EnterpriseNotificationsBell";
import { UserMenu } from "./UserMenu";
import { ProjectPicker } from "./ProjectPicker";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { fetchProjects } from "@/lib/api-client";
import { DEFAULT_ENTERPRISE_PRIMARY_HEX } from "@/lib/enterpriseTheme";
import { extractProjectIdFromPath } from "@/lib/projectScopedPath";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient, trialDaysLeft } from "@/lib/workspaceSubscription";
import { isSuperAdmin } from "@/lib/workspaceRole";
import Link from "next/link";
import { markSkipProjectRestore } from "@/lib/lastProject";
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
    "/proposals": "proposalsDashboard",
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

function extractToolSegment(pathname: string): string | null {
  const match =
    pathname.match(/^\/projects\/[^/]+\/([^/]+)/) ??
    pathname.match(/^\/workspaces\/[^/]+\/projects\/[^/]+\/([^/]+)/);
  return match ? match[1] : null;
}

// fallow-ignore-next-line complexity
export function EnterpriseTopBar({
  onOpenCommandPalette,
  onToggleMobileNav: _onToggleMobileNav,
  mobileNavOpen: _mobileNavOpen,
  desktopSidebarCollapsed,
  onToggleDesktopSidebar,
}: EnterpriseTopBarProps) {
  const pathname = usePathname();
  const t = useTranslations("app.topBar");
  const tTools = useTranslations("app.topBar.tools");
  const tGlobal = useTranslations("app.topBar.global");

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

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const projectId = extractProjectIdFromPath(pathname);
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
        <div className="enterprise-type-nav flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 md:gap-3">
          {/* Mobile back — parent screen with chevron */}
          {isProjectContext && toolLabel ? (
            <Link
              href={projectHomeHref}
              className="flex min-h-11 max-w-[min(42vw,11rem)] shrink-0 items-center gap-0.5 rounded-xl px-1 text-[var(--enterprise-primary)] transition-all duration-150 active:scale-[0.97] active:bg-[var(--enterprise-hover-surface)] lg:hidden"
            >
              <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="enterprise-type-nav-strong truncate leading-tight">
                {activeProject?.name ?? t("projects")}
              </span>
            </Link>
          ) : null}

          {isProjectContext && toolLabel ? (
            <h1 className="enterprise-type-nav-strong min-w-0 flex-1 truncate text-center text-[var(--enterprise-text)] lg:hidden">
              {toolLabel}
            </h1>
          ) : null}

          {/* Breadcrumb — tablet/desktop */}
          <div
            className={`flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 md:gap-3 ${isProjectContext && toolLabel ? "hidden lg:flex" : ""}`}
          >
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
                className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-hidden sm:flex sm:gap-1"
                aria-label={t("breadcrumb")}
              >
                <Link
                  href="/projects"
                  onClick={() => markSkipProjectRestore()}
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
                className="hidden min-w-0 flex-1 items-center gap-1 sm:flex"
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

          <EnterpriseNotificationsBell />

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
