"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarRange,
  ChartGantt,
  ChevronDown,
  History,
  Pin,
  PinOff,
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
};

const SIDEBAR_PINNED_KEY = "plansync-enterprise-sidebar-pinned-v1";
const SIDEBAR_RECENT_KEY = "plansync-enterprise-sidebar-recent-v1";

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

type QuickNavItem = {
  href: string;
  label: string;
  icon: typeof House;
  sectionId: string;
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

function pickNavItemForPathname(items: QuickNavItem[], pathname: string): QuickNavItem | null {
  let best: { item: QuickNavItem; len: number } | null = null;
  for (const item of items) {
    const href = item.href;
    if (pathname === href || pathname.startsWith(href + "/")) {
      if (!best || href.length > best.len) best = { item, len: href.length };
    }
  }
  return best?.item ?? null;
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
          title: "Site Workspace",
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
        title: "Project Workspace",
        description: "Home, files, and drawings",
        railIcon: House,
        railLabel: "Project",
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
        title: "Collaboration",
        description: "RFIs, takeoff, proposals, punch, field reports",
        railIcon: MessageSquareQuote,
        railLabel: "Collab",
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
      title: "Workspace Control",
      description: "Team, audit, project settings",
      railIcon: Users,
      railLabel: "Control",
      items: adminItems,
    });

    return sections;
  }, [pathname, projectId, wid, mod, workspaceRole, projectSession?.uiMode, operationsMode]);

  const globalMainSection = useMemo(
    (): NavSection => ({
      id: "main",
      title: "Overview",
      description: "Dashboard and projects",
      railIcon: LayoutDashboard,
      railLabel: "Overview",
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
        title: "Resource Hub",
        description: "Material library and procurement tools",
        railIcon: Package,
        railLabel: "Resources",
        items: [
          {
            href: wid ? `/workspaces/${wid}/materials` : "#",
            label: "Resource Hub",
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
    return list;
  }, [wid, workspaceRole]);

  const SIDEBAR_NAV_SECTIONS = useMemo(
    (): NavSection[] => [...SIDEBAR_NAV_PRIMARY, ...SIDEBAR_RAIL_FOOTER_SECTIONS],
    [SIDEBAR_NAV_PRIMARY, SIDEBAR_RAIL_FOOTER_SECTIONS],
  );

  const sidebarNavMultiSection = SIDEBAR_NAV_SECTIONS.length > 1;
  const useTwoLevelNav = sidebarNavMultiSection && !railCollapsed;

  const derivedSidebarSectionId = useMemo(
    () => (sidebarNavMultiSection ? pickSectionIdForPathname(SIDEBAR_NAV_SECTIONS, pathname) : ""),
    [SIDEBAR_NAV_SECTIONS, pathname, sidebarNavMultiSection],
  );

  const [selectedSidebarSectionId, setSelectedSidebarSectionId] = useState("");
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);
  const [quickNavReady, setQuickNavReady] = useState(false);

  useEffect(() => {
    if (derivedSidebarSectionId) setSelectedSidebarSectionId(derivedSidebarSectionId);
  }, [derivedSidebarSectionId]);

  const sidebarFlatNavItems = useMemo((): QuickNavItem[] => {
    const rows: QuickNavItem[] = [];
    for (const section of SIDEBAR_NAV_SECTIONS) {
      for (const item of section.items) {
        if ("disabled" in item && item.disabled) continue;
        if (item.href === "#") continue;
        rows.push({ href: item.href, label: item.label, icon: item.icon, sectionId: section.id });
      }
    }
    return rows;
  }, [SIDEBAR_NAV_SECTIONS]);

  const sidebarFlatNavMap = useMemo(
    () => new Map(sidebarFlatNavItems.map((item) => [item.href, item])),
    [sidebarFlatNavItems],
  );

  const currentQuickNavItem = useMemo(
    () => pickNavItemForPathname(sidebarFlatNavItems, pathname),
    [sidebarFlatNavItems, pathname],
  );
  const currentQuickNavHref = currentQuickNavItem?.href ?? null;

  useEffect(() => {
    try {
      const rawPinned = localStorage.getItem(SIDEBAR_PINNED_KEY);
      const rawRecent = localStorage.getItem(SIDEBAR_RECENT_KEY);
      const parsedPinned = rawPinned ? (JSON.parse(rawPinned) as string[]) : [];
      const parsedRecent = rawRecent ? (JSON.parse(rawRecent) as string[]) : [];
      setPinnedHrefs(Array.isArray(parsedPinned) ? parsedPinned : []);
      setRecentHrefs(Array.isArray(parsedRecent) ? parsedRecent : []);
    } catch {
      setPinnedHrefs([]);
      setRecentHrefs([]);
    }
    setQuickNavReady(true);
  }, []);

  useEffect(() => {
    if (!quickNavReady) return;
    try {
      localStorage.setItem(SIDEBAR_PINNED_KEY, JSON.stringify(pinnedHrefs));
      localStorage.setItem(SIDEBAR_RECENT_KEY, JSON.stringify(recentHrefs));
    } catch {
      /* ignore */
    }
  }, [pinnedHrefs, quickNavReady, recentHrefs]);

  useEffect(() => {
    if (!quickNavReady || !currentQuickNavHref) return;
    setRecentHrefs((prev) => {
      if (prev[0] === currentQuickNavHref) return prev;
      return [currentQuickNavHref, ...prev.filter((h) => h !== currentQuickNavHref)].slice(0, 6);
    });
  }, [currentQuickNavHref, quickNavReady]);

  const pinnedItems = useMemo(
    () => pinnedHrefs.map((href) => sidebarFlatNavMap.get(href)).filter(Boolean) as QuickNavItem[],
    [pinnedHrefs, sidebarFlatNavMap],
  );

  const recentItems = useMemo(
    () =>
      recentHrefs
        .filter((href) => !pinnedHrefs.includes(href))
        .map((href) => sidebarFlatNavMap.get(href))
        .filter(Boolean)
        .slice(0, 4) as QuickNavItem[],
    [pinnedHrefs, recentHrefs, sidebarFlatNavMap],
  );

  const canPinCurrent = Boolean(
    currentQuickNavItem && !pinnedHrefs.includes(currentQuickNavItem.href),
  );

  const pinHref = (href: string) =>
    setPinnedHrefs((prev) => (prev.includes(href) ? prev : [href, ...prev].slice(0, 6)));
  const unpinHref = (href: string) => setPinnedHrefs((prev) => prev.filter((h) => h !== href));

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

  const linkActiveInSection = (section: NavSection, item: NavItem) =>
    section.id === "main"
      ? isGlobalActive(item.href)
      : isNavActive(item.href, "exact" in item && Boolean(item.exact));

  return (
    <aside
      id="enterprise-sidebar-panel"
      data-sidebar-collapsed={railCollapsed ? "true" : "false"}
      className={`enterprise-sidebar-panel fixed bottom-0 left-0 top-[3.25rem] z-40 flex min-h-0 w-[min(280px,88vw)] shrink-0 flex-col overflow-hidden transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:static lg:top-auto lg:z-auto lg:h-auto lg:min-h-0 lg:max-h-none lg:translate-x-0 lg:self-stretch lg:border-b-0 lg:shadow-none ${
        railCollapsed ? "lg:w-[72px]" : useTwoLevelNav ? "lg:w-[248px]" : "lg:w-[236px]"
      } ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 ${!mobileOpen ? "pointer-events-none lg:pointer-events-auto" : ""}`}
    >
      {/* Brand row — logo, workspace name, actions (single block; stable DOM for hydration) */}
      <div
        className={`enterprise-sidebar-header flex min-h-[3.25rem] shrink-0 items-center px-3 py-2.5 ${
          desktopIconRail ? "justify-center lg:px-2" : "gap-2.5"
        }`}
        aria-label={desktopIconRail ? `Workspace: ${workspaceTitle}` : undefined}
      >
        <div className={`flex shrink-0 ${desktopIconRail ? "mx-auto" : ""}`}>
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
        </div>
        <div className={desktopIconRail ? "sr-only" : "min-w-0 flex-1 leading-tight"}>
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
          useTwoLevelNav ? "overflow-hidden" : "overflow-y-auto"
        }`}
        aria-label="Main"
      >
        {isProjectContext && !railCollapsed ? (
          <Link
            href="/projects"
            onClick={afterNav}
            title="Projects"
            className="mb-1 flex shrink-0 items-center rounded-md px-3 py-2 text-[13px] font-medium text-[#94A3B8] transition hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[#F8FAFC]"
          >
            <span>Projects</span>
          </Link>
        ) : null}

        {useTwoLevelNav ? (
          <div className="enterprise-scrollbar enterprise-sidebar-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
            {(pinnedItems.length > 0 || recentItems.length > 0 || canPinCurrent) && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 shadow-[0_6px_20px_rgba(2,6,23,0.18)]">
                <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Quick Access
                  </span>
                  {canPinCurrent && currentQuickNavItem ? (
                    <button
                      type="button"
                      onClick={() => pinHref(currentQuickNavItem.href)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                      title={`Pin ${currentQuickNavItem.label}`}
                    >
                      <Pin className="h-3 w-3" strokeWidth={1.75} />
                      Pin current
                    </button>
                  ) : null}
                </div>
                {pinnedItems.length > 0 ? (
                  <div className="space-y-1">
                    {pinnedItems.map((item) => {
                      const Icon = item.icon;
                      const active = linkActiveInSection(
                        SIDEBAR_NAV_SECTIONS.find((s) => s.id === item.sectionId) ??
                          SIDEBAR_NAV_SECTIONS[0],
                        { href: item.href, label: item.label, icon: item.icon },
                      );
                      return (
                        <div key={`pin-${item.href}`} className="flex items-center gap-1">
                          <Link
                            href={item.href}
                            onClick={afterNav}
                            className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition ${
                              active
                                ? "bg-white/[0.1] text-white"
                                : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => unpinHref(item.href)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100"
                            title={`Unpin ${item.label}`}
                            aria-label={`Unpin ${item.label}`}
                          >
                            <PinOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {recentItems.length > 0 ? (
                  <div
                    className={pinnedItems.length > 0 ? "mt-2 border-t border-white/10 pt-2" : ""}
                  >
                    <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      <History className="h-3 w-3" strokeWidth={1.75} />
                      Recent
                    </div>
                    <div className="space-y-1">
                      {recentItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={`recent-${item.href}`}
                            href={item.href}
                            onClick={afterNav}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            {SIDEBAR_NAV_SECTIONS.map((section, sectionIndex) => {
              const selected = selectedSidebarSectionId === section.id;
              const sectionIsSingle = section.items.length === 1;
              const sectionLabel =
                section.title?.trim() || section.description?.trim() || section.railLabel;
              const sectionHint = section.railLabel;
              const sectionDescription = section.description?.trim() || null;
              const Icon = section.railIcon;
              const isFooterStart = sectionIndex === SIDEBAR_NAV_PRIMARY.length;
              const singleItem = sectionIsSingle ? section.items[0] : null;
              const singleActive =
                sectionIsSingle && singleItem ? linkActiveInSection(section, singleItem) : false;
              const cardActive = sectionIsSingle ? singleActive : selected;
              return (
                <div
                  key={section.id}
                  className={`rounded-xl border p-1 shadow-[0_10px_24px_rgba(2,6,23,0.18)] transition-colors ${
                    cardActive
                      ? "border-[color-mix(in_srgb,var(--enterprise-primary)_42%,rgba(255,255,255,0.18))] bg-[linear-gradient(180deg,rgba(37,99,235,0.18),rgba(15,23,42,0.45))]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/18 hover:bg-white/[0.04]"
                  } ${isFooterStart ? "mt-2" : ""}`}
                >
                  {sectionIsSingle && singleItem ? (
                    <Link
                      href={"disabled" in singleItem && singleItem.disabled ? "#" : singleItem.href}
                      onClick={(e) => {
                        if ("disabled" in singleItem && singleItem.disabled) e.preventDefault();
                        else afterNav();
                      }}
                      title={singleItem.label}
                      className={`group flex items-center gap-2 rounded-lg px-2.5 py-2.5 transition-colors ${
                        singleActive
                          ? "bg-black/15 text-white"
                          : "text-slate-300/90 hover:bg-white/[0.04] hover:text-slate-100"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                          singleActive
                            ? "border-white/30 bg-white/12"
                            : "border-white/15 bg-black/20"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-[0.01em]">
                        {singleItem.label}
                      </span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      aria-expanded={selected}
                      aria-controls={`enterprise-sidebar-group-${section.id}`}
                      onClick={() => setSelectedSidebarSectionId(section.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                        selected
                          ? "bg-black/15 text-white"
                          : "text-slate-300/90 hover:bg-white/[0.04] hover:text-slate-100"
                      }`}
                      title={sectionLabel}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                          selected ? "border-white/30 bg-white/12" : "border-white/15 bg-black/20"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400/90">
                          {sectionHint}
                        </span>
                        <span className="block truncate text-[12px] font-semibold tracking-[0.01em]">
                          {sectionLabel}
                        </span>
                        {selected && sectionDescription ? (
                          <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-300/80">
                            {sectionDescription}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`mr-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                          selected
                            ? "border-white/30 bg-white/15 text-white"
                            : "border-white/15 bg-black/25 text-slate-300/90"
                        }`}
                        aria-label={`${section.items.length} links`}
                      >
                        {section.items.length}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                          selected ? "rotate-180 text-slate-100" : "text-slate-500"
                        }`}
                        strokeWidth={2}
                      />
                    </button>
                  )}
                  {selected && !sectionIsSingle ? (
                    <div
                      id={`enterprise-sidebar-group-${section.id}`}
                      className="mt-1 space-y-1 border-l border-white/10 pl-2"
                    >
                      {section.items.map((item) => {
                        const active = linkActiveInSection(section, item);
                        const ItemIcon = item.icon;
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
                            title={t ? `${t}: ${item.label}` : item.label}
                            className={`group relative flex items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-2 text-[13px] font-medium tracking-[-0.01em] transition-[color,background-color,border-color,transform] ${
                              active
                                ? "border border-[color-mix(in_srgb,var(--enterprise-primary)_35%,rgba(255,255,255,0.22))] bg-[linear-gradient(90deg,rgba(37,99,235,0.22),rgba(37,99,235,0.06))] text-white shadow-[inset_2px_0_0_0_var(--enterprise-primary)]"
                                : disabled
                                  ? "cursor-not-allowed border border-transparent text-[var(--enterprise-sidebar-muted)]/45 opacity-55"
                                  : "border border-transparent text-[var(--enterprise-sidebar-muted)] hover:translate-x-[1px] hover:bg-white/[0.04] hover:text-[var(--enterprise-sidebar-active)]"
                            }`}
                          >
                            <ItemIcon
                              className={`h-[17px] w-[17px] shrink-0 ${
                                active ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                              }`}
                              strokeWidth={1.75}
                            />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
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
    </aside>
  );
}
