"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  ChartGantt,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  LayoutDashboard,
  LayoutGrid,
  MessageSquareQuote,
  Package,
  Ruler,
  FileCheck2,
  FileSpreadsheet,
  ScrollText,
  Settings,
  UserRound,
  Users,
  Wrench,
  X,
  House,
  MapPin,
} from "lucide-react";
import { fetchProjectSession } from "@/lib/api-client";
import { projectScopedBaseFromPathname } from "@/lib/projectScopedPath";
import { faviconUrlFromHostname, normalizeWorkspaceWebsite } from "@/lib/workspaceBranding";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { isSuperAdmin } from "@/lib/workspaceRole";
import type { MeWorkspace } from "@/types/enterprise";

type EnterpriseSidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** Desktop (lg+) only — icon rail; mobile drawer always shows full labels. */
  desktopCollapsed: boolean;
  onToggleDesktopCollapse: () => void;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof House;
  disabled?: boolean;
  exact?: boolean;
};

type NavSection = {
  id: string;
  /** Section heading when expanded; omit for the first group (Home / files). */
  title?: string;
  /** Tooltip and fallback for `aria-label` when `title` is omitted */
  description?: string;
  /** Icon for the narrow category rail (desktop) / chips (mobile). */
  railIcon: typeof House;
  /** Short label under the rail icon (desktop two-level). */
  railLabel: string;
  items: NavItem[];
};

function extractWorkspaceIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/workspaces\/([^/]+)/);
  if (!m) return null;
  if (m[1] === "new") return null;
  return m[1];
}

function resolveActiveMembership(
  pathname: string,
  meWorkspaces: MeWorkspace[] | undefined,
  primary: MeWorkspace | null,
): MeWorkspace | null {
  const pathWid = extractWorkspaceIdFromPathname(pathname);
  if (pathWid && meWorkspaces?.length) {
    const hit = meWorkspaces.find((w) => w.workspace.id === pathWid);
    if (hit) return hit;
  }
  return primary;
}

/** Section whose navigation item best matches the current path (longest href prefix). */
function pickSectionIdForPathname(sections: NavSection[], pathname: string): string {
  let best: { id: string; len: number } | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      if ("disabled" in item && item.disabled) continue;
      if (item.href === "#") continue;
      const href = item.href;
      if (pathname === href || pathname.startsWith(href + "/")) {
        if (!best || href.length > best.len) {
          best = { id: section.id, len: href.length };
        }
      }
    }
  }
  return best?.id ?? sections[0]?.id ?? "";
}

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
  const { primary, loading, me } = useEnterpriseWorkspace();
  const activeMembership = resolveActiveMembership(pathname, me?.workspaces, primary);
  const ws = activeMembership?.workspace;
  const wid = ws?.id;
  const isPro = isWorkspaceProClient(ws?.subscriptionStatus);
  const projectId = extractProjectId(pathname);
  const isProjectContext = Boolean(projectId);

  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(projectId ?? ""),
    queryFn: () => fetchProjectSession(projectId!),
    enabled: Boolean(wid && projectId && isPro && isProjectContext),
    staleTime: 30_000,
  });
  const workspaceRole = activeMembership?.role;
  const defaultModules = {
    issues: true,
    rfis: true,
    takeoff: true,
    proposals: true,
    punch: true,
    fieldReports: true,
    omAssets: true,
    omMaintenance: true,
    omInspections: true,
    omTenantPortal: true,
    schedule: true,
  };
  const mod = projectSession?.settings.modules ?? defaultModules;
  const operationsMode = projectSession?.operationsMode ?? false;

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

  const PROJECT_NAV_SECTIONS = useMemo((): NavSection[] => {
    if (!projectId) return [];
    const omBase = projectScopedBaseFromPathname(pathname) ?? `/projects/${projectId}`;
    const ui = projectSession?.uiMode;
    if (ui === "contractor" || ui === "sub") {
      const items: NavItem[] = [
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
      return [
        {
          id: "contractor",
          description: "Home, drawings, and site tools",
          railIcon: House,
          railLabel: "Site",
          items,
        },
      ];
    }

    const showProposals = mod.proposals && workspaceRole !== "MEMBER";
    const showAudit = workspaceRole !== "MEMBER";

    const projectItems: NavItem[] = [
      { href: `/projects/${projectId}/home`, label: "Home", icon: House },
      { href: `/projects/${projectId}/files`, label: "Files & Drawings", icon: FileStack },
    ];
    if (mod.schedule)
      projectItems.push({
        href: `/projects/${projectId}/schedule`,
        label: "Schedule",
        icon: ChartGantt,
      });
    if (!operationsMode && mod.issues) {
      projectItems.push({ href: `/projects/${projectId}/issues`, label: "Issues", icon: MapPin });
    }

    const sections: NavSection[] = [
      {
        id: "core",
        title: "Core",
        description: "Home, files, and drawings",
        railIcon: House,
        railLabel: "Core",
        items: projectItems,
      },
    ];

    if (operationsMode) {
      const omItems: NavItem[] = [
        {
          href: `${omBase}/om/dashboard`,
          label: "FM dashboard",
          icon: LayoutGrid,
        },
        {
          href: `${omBase}/om/handover`,
          label: "Handover",
          icon: FileCheck2,
        },
      ];
      if (mod.omAssets) {
        omItems.push({
          href: `${omBase}/om/assets`,
          label: "Assets",
          icon: Package,
        });
      }
      if (mod.issues) {
        omItems.push({
          href: `${omBase}/om/work-orders`,
          label: "Work orders",
          icon: Wrench,
        });
      }
      if (mod.omMaintenance) {
        omItems.push({
          href: `${omBase}/om/maintenance`,
          label: "Maintenance",
          icon: CalendarRange,
        });
      }
      if (mod.omInspections) {
        omItems.push({
          href: `${omBase}/om/inspections`,
          label: "Inspections",
          icon: ClipboardList,
        });
      }
      if (mod.omTenantPortal) {
        omItems.push({
          href: `${omBase}/om/tenant-portal`,
          label: "Tenant portal",
          icon: Building2,
        });
      }
      sections.push({
        id: "om",
        title: "O&M",
        description:
          "Operations — handover, assets, work orders, maintenance, inspections, tenant portal",
        railIcon: LayoutGrid,
        railLabel: "O&M",
        items: omItems,
      });
    }

    const coordinationItems: NavItem[] = [];
    if (mod.rfis)
      coordinationItems.push({
        href: `/projects/${projectId}/rfi`,
        label: "RFIs",
        icon: MessageSquareQuote,
      });
    if (mod.takeoff) {
      coordinationItems.push({
        href: wid ? `/workspaces/${wid}/projects/${projectId}/takeoff` : "#",
        label: "Quantity Takeoff",
        icon: Ruler,
        disabled: !wid,
      });
    }
    if (showProposals) {
      coordinationItems.push({
        href: wid
          ? `/workspaces/${wid}/projects/${projectId}/proposals`
          : `/projects/${projectId}/proposals`,
        label: "Proposals",
        icon: FileSpreadsheet,
        disabled: !wid,
      });
    }
    if (mod.punch)
      coordinationItems.push({
        href: `/projects/${projectId}/punch`,
        label: "Punch List",
        icon: ClipboardCheck,
      });
    if (mod.fieldReports)
      coordinationItems.push({
        href: `/projects/${projectId}/reports`,
        label: "Field Reports",
        icon: ClipboardList,
      });

    if (coordinationItems.length > 0) {
      sections.push({
        id: "coordination",
        title: "Coordination",
        description: "RFIs, takeoff, proposals, punch, field reports",
        railIcon: MessageSquareQuote,
        railLabel: "Coord",
        items: coordinationItems,
      });
    }

    const adminItems: NavItem[] = [
      {
        href: wid ? `/workspaces/${wid}/projects/${projectId}/team` : `/projects/${projectId}/team`,
        label: "Team",
        icon: Users,
      },
    ];
    if (showAudit) {
      adminItems.push({
        href: `/projects/${projectId}/audit`,
        label: "Audit log",
        icon: ScrollText,
      });
    }
    adminItems.push({
      href: `/projects/${projectId}/settings`,
      label: "Project Settings",
      icon: Settings,
      disabled: !isSuperAdmin(workspaceRole),
    });

    sections.push({
      id: "team-admin",
      title: "Team & admin",
      description: "Team, audit, project settings",
      railIcon: Users,
      railLabel: "Admin",
      items: adminItems,
    });

    return sections;
  }, [pathname, projectId, wid, mod, workspaceRole, projectSession?.uiMode, operationsMode]);

  const globalMainSection = useMemo(
    (): NavSection => ({
      id: "main",
      title: "General",
      description: "Dashboard and projects",
      railIcon: LayoutDashboard,
      railLabel: "General",
      items: GLOBAL_NAV.map((item) => ({
        href: item.href,
        label: item.label,
        icon: item.icon,
      })),
    }),
    [],
  );

  const SIDEBAR_NAV_PRIMARY = useMemo((): NavSection[] => {
    if (isProjectContext) return PROJECT_NAV_SECTIONS;
    return [globalMainSection];
  }, [isProjectContext, PROJECT_NAV_SECTIONS, globalMainSection]);

  /** First-level rail entries pinned to the bottom (Materials, Org, Account). */
  const SIDEBAR_RAIL_FOOTER_SECTIONS = useMemo((): NavSection[] => {
    const list: NavSection[] = [
      {
        id: "materials",
        title: "Material Hub",
        description: "Material Hub",
        railIcon: Package,
        railLabel: "Materials",
        items: [
          {
            href: wid ? `/workspaces/${wid}/materials` : "#",
            label: "Material Hub",
            icon: Package,
            disabled: !wid,
          },
        ],
      },
    ];
    if (isSuperAdmin(workspaceRole)) {
      list.push({
        id: "organization",
        title: "Organization",
        description: "Organization",
        railIcon: Building2,
        railLabel: "Org",
        items: [{ href: "/organization", label: "Organization", icon: Building2 }],
      });
    }
    list.push({
      id: "account",
      title: "Account",
      description: "Account",
      railIcon: UserRound,
      railLabel: "Account",
      items: [{ href: "/account", label: "Account", icon: UserRound }],
    });
    return list;
  }, [wid, workspaceRole]);

  const SIDEBAR_NAV_SECTIONS = useMemo(
    (): NavSection[] => [...SIDEBAR_NAV_PRIMARY, ...SIDEBAR_RAIL_FOOTER_SECTIONS],
    [SIDEBAR_NAV_PRIMARY, SIDEBAR_RAIL_FOOTER_SECTIONS],
  );

  const sidebarNavMultiSection = SIDEBAR_NAV_SECTIONS.length > 1;
  const useDesktopTwoLevelNav = sidebarNavMultiSection && !railCollapsed && isDesktopLg === true;
  const useMobileCategoryChips = sidebarNavMultiSection && isDesktopLg === false;

  const derivedSidebarSectionId = useMemo(
    () => (sidebarNavMultiSection ? pickSectionIdForPathname(SIDEBAR_NAV_SECTIONS, pathname) : ""),
    [SIDEBAR_NAV_SECTIONS, pathname, sidebarNavMultiSection],
  );

  const [selectedSidebarSectionId, setSelectedSidebarSectionId] = useState("");

  useEffect(() => {
    if (derivedSidebarSectionId) setSelectedSidebarSectionId(derivedSidebarSectionId);
  }, [derivedSidebarSectionId]);

  const activeSidebarSection =
    SIDEBAR_NAV_SECTIONS.find((s) => s.id === selectedSidebarSectionId) ?? SIDEBAR_NAV_SECTIONS[0];

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

  const workspaceTitle = loading ? "…" : ws?.name?.trim() || "Workspace";
  /** lg icon-only rail: hide workspace title visually, keep sr-only for a11y */
  const desktopIconRail = Boolean(railCollapsed && isDesktopLg === true);

  const navLinkClass = (active: boolean, disabled?: boolean, iconOnly?: boolean) => {
    const io = iconOnly === undefined ? railCollapsed : iconOnly;
    return `enterprise-sidebar-nav-link group flex items-center rounded-md py-2 text-[13px] font-medium tracking-[-0.01em] transition-[color,background-color,box-shadow] duration-150 ${
      io ? "justify-center gap-0 px-2" : "gap-2.5 px-3"
    } ${
      active
        ? "enterprise-nav-active"
        : disabled
          ? "cursor-not-allowed opacity-40 text-[var(--enterprise-sidebar-muted)]"
          : "text-[var(--enterprise-sidebar-muted)] hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[var(--enterprise-sidebar-active)]"
    }`;
  };

  const iconClass = (active: boolean) =>
    `h-[18px] w-[18px] shrink-0 transition-colors duration-150 ${
      active ? "text-[var(--enterprise-sidebar-active)]" : "text-[var(--enterprise-sidebar-muted)]"
    }`;

  /** Muted icons for the secondary link column (SaaS-style). */
  const subNavIconClass = (active: boolean) =>
    `h-[17px] w-[17px] shrink-0 ${
      active ? "text-[var(--enterprise-sidebar-active)]" : "text-slate-500"
    }`;

  const linkActiveInSection = (section: NavSection, item: NavItem) =>
    section.id === "main"
      ? isGlobalActive(item.href)
      : isNavActive(item.href, "exact" in item && Boolean(item.exact));

  const renderRailCategoryButton = (section: NavSection) => {
    const Icon = section.railIcon;
    const selected = selectedSidebarSectionId === section.id;
    const tabId = `enterprise-sidebar-tab-${section.id}`;
    return (
      <button
        key={section.id}
        type="button"
        role="tab"
        id={tabId}
        aria-selected={selected}
        aria-controls="enterprise-sidebar-panel-links"
        title={section.description ?? section.title}
        onClick={() => setSelectedSidebarSectionId(section.id)}
        className={`relative flex w-full flex-col items-center gap-0.5 rounded-md border-l-2 py-2 pl-[3px] pr-0.5 text-center transition-colors duration-150 ${
          selected
            ? "border-[var(--enterprise-primary)] bg-white/[0.06] text-[#F8FAFC]"
            : "border-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
        }`}
      >
        <Icon
          className={`h-[17px] w-[17px] shrink-0 ${selected ? "text-[#F8FAFC]" : "text-slate-500"}`}
          strokeWidth={1.75}
        />
        <span className="line-clamp-2 w-full px-0.5 text-[9px] font-medium leading-tight tracking-tight">
          {section.railLabel}
        </span>
      </button>
    );
  };

  return (
    <aside
      id="enterprise-sidebar-panel"
      data-sidebar-collapsed={railCollapsed ? "true" : "false"}
      className={`enterprise-sidebar-panel fixed bottom-0 left-0 top-[3.25rem] z-40 flex min-h-0 w-[min(280px,88vw)] shrink-0 flex-col overflow-hidden transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:static lg:top-auto lg:z-auto lg:h-auto lg:min-h-0 lg:max-h-none lg:translate-x-0 lg:self-stretch lg:border-b-0 lg:shadow-none ${
        railCollapsed ? "lg:w-[72px]" : useDesktopTwoLevelNav ? "lg:w-[288px]" : "lg:w-[264px]"
      } ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 ${!mobileOpen ? "pointer-events-none lg:pointer-events-auto" : ""}`}
    >
      {/* Brand row — logo, workspace name, actions (single block; stable DOM for hydration) */}
      <div
        className={`enterprise-sidebar-header flex min-h-[3.25rem] shrink-0 items-center px-3 py-2.5 ${
          desktopIconRail ? "justify-center gap-0 lg:px-2" : "gap-3"
        }`}
        aria-label={desktopIconRail ? `Workspace: ${workspaceTitle}` : undefined}
      >
        <div
          className={
            sidebarLogoSrc
              ? "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
              : "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900/35 ring-1 ring-white/[0.06]"
          }
          aria-hidden
        >
          {sidebarLogoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sidebarLogoSrc} alt="" className="h-full w-full object-contain p-1.5" />
          ) : (
            <Image
              src="/logo.svg"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-[10px] object-cover"
            />
          )}
        </div>
        <div className={`min-w-0 flex-1 leading-tight ${desktopIconRail ? "lg:sr-only" : ""}`}>
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Workspace
          </p>
          <p
            className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--enterprise-sidebar-active)]"
            title={ws?.name?.trim() ? ws.name : undefined}
          >
            {workspaceTitle}
          </p>
        </div>
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
      <nav
        className={`flex min-h-0 flex-1 flex-col gap-1 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
          useDesktopTwoLevelNav || useMobileCategoryChips ? "overflow-hidden" : "overflow-y-auto"
        }`}
        aria-label="Main"
      >
        {isProjectContext ? (
          <Link
            href="/projects"
            onClick={afterNav}
            title="Projects"
            className={`mb-1 flex shrink-0 items-center rounded-md py-2 text-[13px] font-medium text-[#94A3B8] transition hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[#F8FAFC] ${
              railCollapsed ? "justify-center px-2" : "gap-2.5 px-3"
            }`}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className={railCollapsed ? "sr-only" : ""}>Projects</span>
          </Link>
        ) : null}

        {useDesktopTwoLevelNav ? (
          <div className="flex min-h-0 flex-1 flex-row gap-2 overflow-hidden">
            <div className="flex w-[92px] min-h-0 shrink-0 flex-col border-r border-white/[0.08]">
              <div
                role="tablist"
                aria-label="Navigation"
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-0.5 pr-2">
                  {SIDEBAR_NAV_PRIMARY.map((section) => renderRailCategoryButton(section))}
                </div>
                <div className="flex shrink-0 flex-col gap-0.5 border-t border-white/[0.08] py-1.5 pr-2 pt-2">
                  {SIDEBAR_RAIL_FOOTER_SECTIONS.map((section) => renderRailCategoryButton(section))}
                </div>
              </div>
            </div>
            <div
              id="enterprise-sidebar-panel-links"
              role="tabpanel"
              aria-labelledby={`enterprise-sidebar-tab-${selectedSidebarSectionId}`}
              className="min-h-0 w-[156px] shrink-0 space-y-0.5 overflow-y-auto overflow-x-hidden py-0.5"
            >
              {activeSidebarSection.items.map((item) => {
                const active = linkActiveInSection(activeSidebarSection, item);
                const Icon = item.icon;
                const disabled = "disabled" in item && item.disabled;
                const t = activeSidebarSection.title?.trim();
                return (
                  <Link
                    key={`${activeSidebarSection.id}-${item.href}`}
                    href={disabled ? "#" : item.href}
                    onClick={(e) => {
                      if (disabled) e.preventDefault();
                      else afterNav();
                    }}
                    title={t ? `${t}: ${item.label}` : item.label}
                    className={navLinkClass(active, disabled, false)}
                  >
                    <Icon className={subNavIconClass(active)} strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : useMobileCategoryChips ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <div
              className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 pb-0.5"
              role="tablist"
              aria-label="Navigation"
            >
              {SIDEBAR_NAV_PRIMARY.map((section) => {
                const selected = selectedSidebarSectionId === section.id;
                const label = section.railLabel;
                const tabId = `enterprise-sidebar-m-tab-${section.id}`;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    id={tabId}
                    aria-selected={selected}
                    aria-controls="enterprise-sidebar-panel-links-mobile"
                    onClick={() => setSelectedSidebarSectionId(section.id)}
                    className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] font-medium tracking-tight transition-colors duration-150 ${
                      selected
                        ? "border-white/10 bg-white/[0.08] text-[#F8FAFC]"
                        : "border-transparent bg-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              {SIDEBAR_RAIL_FOOTER_SECTIONS.length > 0 ? (
                <div className="mx-0.5 h-6 w-px shrink-0 self-center bg-white/10" aria-hidden />
              ) : null}
              {SIDEBAR_RAIL_FOOTER_SECTIONS.map((section) => {
                const selected = selectedSidebarSectionId === section.id;
                const label = section.railLabel;
                const tabId = `enterprise-sidebar-m-tab-${section.id}`;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    id={tabId}
                    aria-selected={selected}
                    aria-controls="enterprise-sidebar-panel-links-mobile"
                    onClick={() => setSelectedSidebarSectionId(section.id)}
                    className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] font-medium tracking-tight transition-colors duration-150 ${
                      selected
                        ? "border-white/10 bg-white/[0.08] text-[#F8FAFC]"
                        : "border-transparent bg-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div
              id="enterprise-sidebar-panel-links-mobile"
              role="tabpanel"
              aria-labelledby={`enterprise-sidebar-m-tab-${selectedSidebarSectionId}`}
              className="min-h-0 flex-1 space-y-0.5 overflow-y-auto"
            >
              {activeSidebarSection.items.map((item) => {
                const active = linkActiveInSection(activeSidebarSection, item);
                const Icon = item.icon;
                const disabled = "disabled" in item && item.disabled;
                const t = activeSidebarSection.title?.trim();
                return (
                  <Link
                    key={`${activeSidebarSection.id}-${item.href}`}
                    href={disabled ? "#" : item.href}
                    onClick={(e) => {
                      if (disabled) e.preventDefault();
                      else afterNav();
                    }}
                    title={t ? `${t}: ${item.label}` : item.label}
                    className={navLinkClass(active, disabled, false)}
                  >
                    <Icon className={subNavIconClass(active)} strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0 overflow-y-auto">
            {SIDEBAR_NAV_PRIMARY.map((section, sectionIndex) => (
              <div
                key={section.id}
                role="group"
                aria-label={section.title?.trim() || section.description || "Navigation"}
                className={
                  sectionIndex > 0
                    ? railCollapsed
                      ? "mt-2"
                      : "mt-3 border-t border-white/[0.08] pt-3 lg:mt-3.5 lg:pt-3.5"
                    : ""
                }
              >
                {railCollapsed && sectionIndex > 0 ? (
                  <div
                    className="mx-auto mb-2 hidden h-px w-8 shrink-0 bg-white/12 lg:block"
                    aria-hidden
                  />
                ) : null}
                {section.title?.trim() ? (
                  <div
                    className={`mb-1.5 px-3 ${railCollapsed ? "sr-only" : ""}`}
                    title={section.description}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]/60">
                      {section.title}
                    </p>
                  </div>
                ) : null}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = linkActiveInSection(section, item);
                    const Icon = item.icon;
                    const disabled = "disabled" in item && item.disabled;
                    const t = section.title?.trim();
                    return (
                      <Link
                        key={`${section.id}-${item.href}`}
                        href={disabled ? "#" : item.href}
                        onClick={(e) => {
                          if (disabled) e.preventDefault();
                          else afterNav();
                        }}
                        title={railCollapsed && t ? `${t}: ${item.label}` : item.label}
                        className={navLinkClass(active, disabled)}
                      >
                        <Icon className={iconClass(active)} strokeWidth={1.75} />
                        <span className={railCollapsed ? "sr-only" : "truncate"}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            {SIDEBAR_RAIL_FOOTER_SECTIONS.length > 0 ? (
              <div
                className={
                  railCollapsed
                    ? "mt-2"
                    : "mt-3 border-t border-white/[0.08] pt-3 lg:mt-3.5 lg:pt-3.5"
                }
                role="group"
                aria-label="Workspace"
              >
                {railCollapsed ? (
                  <div
                    className="mx-auto mb-2 hidden h-px w-8 shrink-0 bg-white/12 lg:block"
                    aria-hidden
                  />
                ) : null}
                <div className="space-y-0.5">
                  {SIDEBAR_RAIL_FOOTER_SECTIONS.flatMap((section) =>
                    section.items.map((item) => {
                      const active = linkActiveInSection(section, item);
                      const Icon = item.icon;
                      const disabled = "disabled" in item && item.disabled;
                      return (
                        <Link
                          key={`${section.id}-${item.href}`}
                          href={disabled ? "#" : item.href}
                          onClick={(e) => {
                            if (disabled) e.preventDefault();
                            else afterNav();
                          }}
                          title={item.label}
                          className={navLinkClass(active, disabled)}
                        >
                          <Icon className={iconClass(active)} strokeWidth={1.75} />
                          <span className={railCollapsed ? "sr-only" : "truncate"}>
                            {item.label}
                          </span>
                        </Link>
                      );
                    }),
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </nav>

      {railCollapsed ? (
        <div className="enterprise-sidebar-footer p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onToggleDesktopCollapse}
            className="hidden w-full items-center justify-center rounded-lg py-2 text-[#94A3B8] transition hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[#F8FAFC] lg:flex"
            aria-label="Expand sidebar"
            title="Expand sidebar — [ or ]"
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
