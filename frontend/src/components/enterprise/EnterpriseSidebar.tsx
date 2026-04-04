"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ArrowLeft,
  Building2,
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
import { fetchProjects } from "@/lib/api-client";
import { faviconUrlFromHostname, normalizeWorkspaceWebsite } from "@/lib/workspaceBranding";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

type EnterpriseSidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  expanded: boolean;
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

export function EnterpriseSidebar({ mobileOpen, onCloseMobile, expanded }: EnterpriseSidebarProps) {
  const pathname = usePathname();
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
  const activeProject = projectId ? projects.find((p) => p.id === projectId) : null;

  const collapsedDesktop = !expanded;
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

  const PROJECT_NAV = projectId
    ? [
        {
          href: `/projects/${projectId}/home`,
          label: "Home",
          icon: House,
        },
        {
          href: `/projects/${projectId}/files`,
          label: "Files & Drawings",
          icon: FileStack,
        },
        {
          href: `/projects/${projectId}/issues`,
          label: "Issues",
          icon: MapPin,
        },
        {
          href: `/projects/${projectId}/rfi`,
          label: "RFIs",
          icon: MessageSquareQuote,
        },
        {
          href: wid ? `/workspaces/${wid}/projects/${projectId}/takeoff` : "#",
          label: "Quantity Takeoff",
          icon: Ruler,
        },
        {
          href: wid
            ? `/workspaces/${wid}/projects/${projectId}/proposals`
            : `/projects/${projectId}/proposals`,
          label: "Proposals",
          icon: FileSpreadsheet,
        },
        {
          href: `/projects/${projectId}/punch`,
          label: "Punch List",
          icon: ClipboardCheck,
        },
        {
          href: `/projects/${projectId}/reports`,
          label: "Field Reports",
          icon: ClipboardList,
        },
        {
          href: wid
            ? `/workspaces/${wid}/projects/${projectId}/team`
            : `/projects/${projectId}/team`,
          label: "Team",
          icon: Users,
        },
        {
          href: `/projects/${projectId}/audit`,
          label: "Audit log",
          icon: ScrollText,
        },
        {
          href: `/projects/${projectId}/settings`,
          label: "Project Settings",
          icon: Settings,
          disabled: true,
        },
      ]
    : [];

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
    `enterprise-sidebar-nav-link group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium tracking-[-0.01em] transition-colors duration-200 ${
      collapsedDesktop ? "lg:justify-center lg:px-2" : ""
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
      data-sidebar-collapsed={collapsedDesktop ? "true" : undefined}
      className={`enterprise-sidebar-panel fixed bottom-0 left-0 top-[3.25rem] z-40 flex min-h-0 w-[min(280px,88vw)] shrink-0 flex-col overflow-hidden transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:static lg:top-auto lg:z-auto lg:h-auto lg:min-h-0 lg:max-h-none lg:translate-x-0 lg:self-stretch lg:border-b-0 lg:shadow-none ${
        expanded ? "lg:w-[264px]" : "lg:w-[72px]"
      } ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 ${!mobileOpen ? "pointer-events-none lg:pointer-events-auto" : ""}`}
    >
      {/* Header — workspace logo or company favicon from website */}
      <div
        className={`enterprise-sidebar-header flex h-[3.25rem] shrink-0 items-center gap-3 px-4 ${
          collapsedDesktop ? "lg:justify-center lg:px-2" : ""
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
        <div className={`min-w-0 flex-1 leading-tight ${collapsedDesktop ? "lg:hidden" : ""}`}>
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
              className={`mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-[#94A3B8] transition hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[#F8FAFC] ${
                collapsedDesktop ? "lg:justify-center lg:px-2" : ""
              }`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className={collapsedDesktop ? "lg:sr-only" : ""}>Projects</span>
            </Link>

            {/* Project name divider */}
            {!collapsedDesktop && (
              <div className="mb-2 px-3">
                <div className="border-t border-white/[0.08] pt-3">
                  <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/60">
                    {activeProject?.name ?? "Project"}
                  </p>
                </div>
              </div>
            )}

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
                    title={collapsedDesktop ? item.label : undefined}
                    onClick={(e) => {
                      if (disabled) e.preventDefault();
                      else afterNav();
                    }}
                    className={navLinkClass(active, disabled)}
                  >
                    <Icon className={iconClass(active)} strokeWidth={1.75} />
                    <span className={`truncate ${collapsedDesktop ? "lg:sr-only" : ""}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Global nav */}
            <div className="mb-2">
              {!collapsedDesktop && (
                <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/60">
                  Global
                </div>
              )}
              {GLOBAL_NAV.map((item) => {
                const active = isGlobalActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsedDesktop ? item.label : undefined}
                    onClick={afterNav}
                    className={navLinkClass(active)}
                  >
                    <Icon className={iconClass(active)} strokeWidth={1.75} />
                    <span className={`truncate ${collapsedDesktop ? "lg:sr-only" : ""}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Footer — Material Hub + Organization + Account */}
      <div className="enterprise-sidebar-footer p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          href={wid ? `/workspaces/${wid}/materials` : "#"}
          title={collapsedDesktop ? "Material Hub" : undefined}
          onClick={afterNav}
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
          <span className={`truncate ${collapsedDesktop ? "lg:sr-only" : ""}`}>Material Hub</span>
        </Link>
        <Link
          href="/organization"
          title={collapsedDesktop ? "Organization" : undefined}
          onClick={afterNav}
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
          <span className={`truncate ${collapsedDesktop ? "lg:sr-only" : ""}`}>Organization</span>
        </Link>
        <Link
          href="/account"
          title={collapsedDesktop ? "Account" : undefined}
          onClick={afterNav}
          className={navLinkClass(pathname === "/account" || pathname.startsWith("/account/"))}
        >
          <UserRound
            className={iconClass(pathname === "/account" || pathname.startsWith("/account/"))}
            strokeWidth={1.75}
          />
          <span className={`truncate ${collapsedDesktop ? "lg:sr-only" : ""}`}>Account</span>
        </Link>
      </div>
    </aside>
  );
}
