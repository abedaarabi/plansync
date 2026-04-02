"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import { fetchProjects } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
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

export function EnterpriseTopBar({
  onOpenCommandPalette,
  onOpenMobileNav,
  sidebarExpanded,
  onToggleSidebar,
}: EnterpriseTopBarProps) {
  const pathname = usePathname();
  const { primary } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = primary?.workspace.subscriptionStatus === "active";

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const projectId = extractProjectId(pathname);
  const isProjectContext = Boolean(projectId);
  const activeProject = projectId ? projects.find((p) => p.id === projectId) : null;
  const toolSegment = extractToolSegment(pathname);
  const toolLabel = toolSegment ? (TOOL_LABELS[toolSegment] ?? null) : null;
  const ToolIcon = toolSegment ? TOOL_ICONS[toolSegment] : undefined;
  /** Project sub-routes live under `/projects/...` only; workspace-prefixed pages exist only for takeoff, team, and materials. */
  const projectHomeHref = projectId ? `/projects/${projectId}/home` : "/projects";

  return (
    <header className="sticky top-0 z-50 flex h-[3.25rem] shrink-0 items-center justify-between gap-3 border-b border-[var(--enterprise-border-subtle)] bg-[color-mix(in_srgb,var(--enterprise-surface)_82%,transparent)] px-3 shadow-[0_1px_0_0_rgba(255,255,255,0.65)_inset] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--enterprise-surface)_72%,transparent)] sm:gap-4 sm:px-6">
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
          <Link
            href="/dashboard"
            className="hidden shrink-0 font-bold tracking-tight hover:opacity-90 sm:inline"
          >
            <span className="text-[var(--enterprise-text)]">Plan</span>
            <span className="text-[var(--enterprise-primary)]">Sync</span>
          </Link>
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
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--enterprise-border)]/95 bg-[var(--enterprise-surface)]/90 text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--enterprise-primary)] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]" />
        </button>

        <UserMenu />
      </div>
    </header>
  );
}
