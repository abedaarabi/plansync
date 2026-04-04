"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  LayoutDashboard,
  MessageSquareQuote,
  Package,
  Ruler,
  FileSpreadsheet,
  ScrollText,
  Settings,
  UserRound,
  Users,
  X,
  House,
  MapPin,
} from "lucide-react";
import { fetchProjects, fetchProjectSession } from "@/lib/api-client";
import { faviconUrlFromHostname, normalizeWorkspaceWebsite } from "@/lib/workspaceBranding";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { isSuperAdmin } from "@/lib/workspaceRole";

type EnterpriseSidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** Desktop (lg+) only — icon rail; mobile drawer always shows full labels. */
  desktopCollapsed: boolean;
  onToggleDesktopCollapse: () => void;
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

export function EnterpriseSidebar({
  mobileOpen,
  onCloseMobile,
  desktopCollapsed,
  onToggleDesktopCollapse,
}: EnterpriseSidebarProps) {
  const pathname = usePathname();
  const [isDesktopLg, setIsDesktopLg] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktopLg(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const railCollapsed = Boolean(desktopCollapsed && isDesktopLg);
  const { primary, loading } = useEnterpriseWorkspace();
  const ws = primary?.workspace;
  const wid = ws?.id;
  const isPro = isWorkspaceProClient(ws?.subscriptionStatus);
  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const projectId = extractProjectId(pathname);
  const isProjectContext = Boolean(projectId);

  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(projectId ?? ""),
    queryFn: () => fetchProjectSession(projectId!),
    enabled: Boolean(wid && projectId && isPro && isProjectContext),
    staleTime: 30_000,
  });
  const activeProject = projectId ? projects.find((p) => p.id === projectId) : null;
  const workspaceRole = primary?.role;
  const defaultModules = {
    issues: true,
    rfis: true,
    takeoff: true,
    proposals: true,
    punch: true,
    fieldReports: true,
  };
  const mod = projectSession?.settings.modules ?? defaultModules;

  const afterNav = () => onCloseMobile();

  const sidebarLogoSrc = useMemo(() => {
    if (!ws) return null;
    const explicit = ws.logoUrl?.trim();
    if (explicit) return explicit;
    const site = ws.website?.trim();
    if (!site) return null;
    const n = normalizeWorkspaceWebsite(site);
    return n.ok ? faviconUrlFromHostname(n.hostname) : null;
  }, [ws?.logoUrl, ws?.website]);

  const GLOBAL_NAV = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FileStack },
  ];

  const PROJECT_NAV = useMemo(() => {
    if (!projectId) return [];
    const ui = projectSession?.uiMode;
    if (ui === "contractor" || ui === "sub") {
      const items: Array<{ href: string; label: string; icon: typeof House; disabled?: boolean }> =
        [
          { href: `/projects/${projectId}/home`, label: "Home", icon: House },
          { href: `/projects/${projectId}/files`, label: "My Drawings", icon: FileStack },
        ];
      if (mod.issues)
        items.push({ href: `/projects/${projectId}/issues`, label: "My Issues", icon: MapPin });
      if (mod.punch)
        items.push({
          href: `/projects/${projectId}/punch`,
          label: "Punch List",
          icon: ClipboardCheck,
        });
      return items;
    }
    const showProposals = mod.proposals && workspaceRole !== "MEMBER";
    const showAudit = workspaceRole !== "MEMBER";
    const items: Array<{
      href: string;
      label: string;
      icon: typeof House;
      disabled?: boolean;
    }> = [
      { href: `/projects/${projectId}/home`, label: "Home", icon: House },
      { href: `/projects/${projectId}/files`, label: "Files & Drawings", icon: FileStack },
    ];
    if (mod.issues)
      items.push({ href: `/projects/${projectId}/issues`, label: "Issues", icon: MapPin });
    if (mod.rfis)
      items.push({ href: `/projects/${projectId}/rfi`, label: "RFIs", icon: MessageSquareQuote });
    if (mod.takeoff) {
      items.push({
        href: wid ? `/workspaces/${wid}/projects/${projectId}/takeoff` : "#",
        label: "Quantity Takeoff",
        icon: Ruler,
        disabled: !wid,
      });
    }
    if (showProposals) {
      items.push({
        href: wid
          ? `/workspaces/${wid}/projects/${projectId}/proposals`
          : `/projects/${projectId}/proposals`,
        label: "Proposals",
        icon: FileSpreadsheet,
        disabled: !wid,
      });
    }
    if (mod.punch)
      items.push({
        href: `/projects/${projectId}/punch`,
        label: "Punch List",
        icon: ClipboardCheck,
      });
    if (mod.fieldReports)
      items.push({
        href: `/projects/${projectId}/reports`,
        label: "Field Reports",
        icon: ClipboardList,
      });
    items.push({
      href: wid ? `/workspaces/${wid}/projects/${projectId}/team` : `/projects/${projectId}/team`,
      label: "Team",
      icon: Users,
    });
    if (showAudit) {
      items.push({ href: `/projects/${projectId}/audit`, label: "Audit log", icon: ScrollText });
    }
    items.push({
      href: `/projects/${projectId}/settings`,
      label: "Project Settings",
      icon: Settings,
      disabled: !isSuperAdmin(workspaceRole),
    });
    return items;
  }, [projectId, wid, mod, workspaceRole, primary, projectSession?.uiMode]);

  function isNavActive(href: string, exact?: boolean): boolean {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  function isGlobalActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/projects")
      return (
        pathname === "/projects" ||
        pathname.startsWith("/projects/") ||
        pathname.includes("/projects/")
      );
    return pathname === href;
  }

  const navLinkClass = (active: boolean, disabled?: boolean) =>
    `enterprise-sidebar-nav-link group flex items-center rounded-xl py-2.5 text-[13.5px] font-medium tracking-[-0.01em] transition-colors duration-200 ${
      railCollapsed ? "justify-center gap-0 px-2" : "gap-3 px-3"
    } ${
      active
        ? "enterprise-nav-active"
        : disabled
          ? "cursor-not-allowed opacity-40 text-[var(--enterprise-sidebar-muted)]"
          : "text-[var(--enterprise-sidebar-muted)] hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[var(--enterprise-sidebar-active)]"
    }`;

  const iconClass = (active: boolean) =>
    `h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-[1.03] ${
      active ? "text-[var(--enterprise-sidebar-active)]" : "text-[var(--enterprise-sidebar-muted)]"
    }`;

  return (
    <aside
      id="enterprise-sidebar-panel"
      data-sidebar-collapsed={railCollapsed ? "true" : "false"}
      className={`enterprise-sidebar-panel fixed bottom-0 left-0 top-[3.25rem] z-40 flex min-h-0 w-[min(280px,88vw)] shrink-0 flex-col overflow-hidden transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:static lg:top-auto lg:z-auto lg:h-auto lg:min-h-0 lg:max-h-none lg:translate-x-0 lg:self-stretch lg:border-b-0 lg:shadow-none ${
        railCollapsed ? "lg:w-[72px]" : "lg:w-[264px]"
      } ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 ${!mobileOpen ? "pointer-events-none lg:pointer-events-auto" : ""}`}
    >
      {/* Header — workspace logo or company favicon from website */}
      <div
        className={`enterprise-sidebar-header flex h-[3.25rem] shrink-0 items-center px-4 ${
          railCollapsed ? "justify-center gap-0 lg:px-2" : "gap-3"
        }`}
      >
        <div
          className={
            sidebarLogoSrc
              ? "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-500/30 bg-white ring-1 ring-black/5"
              : "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-white/15"
          }
          aria-hidden
        >
          {sidebarLogoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sidebarLogoSrc} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <Image
              src="/logo.svg"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg object-cover"
            />
          )}
        </div>
        {!railCollapsed ? (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px] font-semibold text-[#F8FAFC]">
              {loading ? (
                "…"
              ) : ws?.name ? (
                ws.name
              ) : (
                <>
                  <span className="text-[#F8FAFC]">Plan</span>
                  <span className="text-[var(--enterprise-primary)]">Sync</span>
                </>
              )}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#94A3B8]">
              Workspace
            </p>
          </div>
        ) : null}
        {!railCollapsed ? (
          <button
            type="button"
            onClick={onToggleDesktopCollapse}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[#F8FAFC] lg:flex"
            aria-label="Collapse sidebar"
            title="Collapse sidebar — [ or ]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCloseMobile}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[#F8FAFC] lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 pt-2" aria-label="Main">
        {isProjectContext ? (
          <>
            {/* ← Projects button */}
            <Link
              href="/projects"
              onClick={afterNav}
              title="Projects"
              className={`mb-1 flex items-center rounded-xl py-2 text-[13px] font-medium text-[#94A3B8] transition hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[#F8FAFC] ${
                railCollapsed ? "justify-center px-2" : "gap-2.5 px-3"
              }`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className={railCollapsed ? "sr-only" : ""}>Projects</span>
            </Link>

            {/* Project name divider */}
            <div className={`mb-2 px-3 ${railCollapsed ? "hidden" : ""}`}>
              <div className="border-t border-white/[0.08] pt-3">
                <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/60">
                  {activeProject?.name ?? "Project"}
                </p>
              </div>
            </div>

            {/* Project-scoped nav */}
            <div className="space-y-0.5">
              {PROJECT_NAV.map((item) => {
                const active = isNavActive(item.href, "exact" in item && Boolean(item.exact));
                const Icon = item.icon;
                const disabled = "disabled" in item && item.disabled;
                return (
                  <Link
                    key={item.href}
                    href={disabled ? "#" : item.href}
                    onClick={(e) => {
                      if (disabled) e.preventDefault();
                      else afterNav();
                    }}
                    title={item.label}
                    className={navLinkClass(active, disabled)}
                  >
                    <Icon className={iconClass(active)} strokeWidth={1.75} />
                    <span className={railCollapsed ? "sr-only" : "truncate"}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Global nav */}
            <div className="mb-2">
              <div
                className={`mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/60 ${
                  railCollapsed ? "hidden" : ""
                }`}
              >
                Global
              </div>
              {GLOBAL_NAV.map((item) => {
                const active = isGlobalActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={afterNav}
                    title={item.label}
                    className={navLinkClass(active)}
                  >
                    <Icon className={iconClass(active)} strokeWidth={1.75} />
                    <span className={railCollapsed ? "sr-only" : "truncate"}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Footer — expand (collapsed desktop) + Material Hub + Organization + Account */}
      <div className="enterprise-sidebar-footer p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {railCollapsed ? (
          <button
            type="button"
            onClick={onToggleDesktopCollapse}
            className="mb-2 hidden w-full items-center justify-center rounded-lg py-2 text-[#94A3B8] transition hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[#F8FAFC] lg:flex"
            aria-label="Expand sidebar"
            title="Expand sidebar — [ or ]"
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        ) : null}
        <Link
          href={wid ? `/workspaces/${wid}/materials` : "#"}
          onClick={afterNav}
          title="Material Hub"
          className={navLinkClass(
            pathname === "/materials" ||
              pathname.startsWith("/materials/") ||
              pathname.includes("/materials"),
          )}
        >
          <Package
            className={iconClass(
              pathname === "/materials" ||
                pathname.startsWith("/materials/") ||
                pathname.includes("/materials"),
            )}
            strokeWidth={1.75}
          />
          <span className={railCollapsed ? "sr-only" : "truncate"}>Material Hub</span>
        </Link>
        {isSuperAdmin(workspaceRole) ? (
          <Link
            href="/organization"
            onClick={afterNav}
            title="Organization"
            className={navLinkClass(
              pathname === "/organization" || pathname.startsWith("/organization/"),
            )}
          >
            <Building2
              className={iconClass(
                pathname === "/organization" || pathname.startsWith("/organization/"),
              )}
              strokeWidth={1.75}
            />
            <span className={railCollapsed ? "sr-only" : "truncate"}>Organization</span>
          </Link>
        ) : null}
        <Link
          href="/account"
          onClick={afterNav}
          title="Account"
          className={navLinkClass(pathname === "/account" || pathname.startsWith("/account/"))}
        >
          <UserRound
            className={iconClass(pathname === "/account" || pathname.startsWith("/account/"))}
            strokeWidth={1.75}
          />
          <span className={railCollapsed ? "sr-only" : "truncate"}>Account</span>
        </Link>
      </div>
    </aside>
  );
}
