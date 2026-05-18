"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarRange,
  ChartGantt,
  ChevronDown,
  Inbox,
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
import { useTranslations } from "next-intl";
import { fetchProjectSession } from "@/lib/api-client";
import { projectScopedBaseFromPathname } from "@/lib/projectScopedPath";
import {
  faviconUrlFromHostname,
  isGoogleFaviconUrl,
  normalizeWorkspaceWebsite,
} from "@/lib/workspaceBranding";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceOmBillingClient, isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { isSuperAdmin } from "@/lib/workspaceRole";
import type { MeWorkspace } from "@/types/enterprise";

type EnterpriseSidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** Desktop (lg+) only — icon rail; mobile drawer always shows full labels. */
  desktopCollapsed: boolean;
};

const LAST_PROJECT_PATH_KEY = "plansync-enterprise-last-project-path-v1";

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
  const t = useTranslations("app.shell");
  const pathname = usePathname();
  /** false until layout sync — avoids treating desktop as mobile before matchMedia runs. */
  const [isDesktopLg, setIsDesktopLg] = useState(false);

  useLayoutEffect(() => {
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
  const isPro = isWorkspaceProClient(ws);
  const omBilling = isWorkspaceOmBillingClient(ws);
  const projectId = extractProjectId(pathname);
  const isProjectContext = Boolean(projectId);
  const [lastProjectPath, setLastProjectPath] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(LAST_PROJECT_PATH_KEY);
      if (cached) setLastProjectPath(cached);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isProjectContext) return;
    setLastProjectPath(pathname);
    try {
      localStorage.setItem(LAST_PROJECT_PATH_KEY, pathname);
    } catch {
      /* ignore */
    }
  }, [isProjectContext, pathname]);

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
  }, [ws]);

  const [workspaceLogoFailed, setWorkspaceLogoFailed] = useState(false);
  useEffect(() => {
    setWorkspaceLogoFailed(false);
  }, [sidebarLogoSrc]);

  const PROJECT_NAV_SECTIONS = useMemo((): NavSection[] => {
    if (!projectId) return [];
    const omBase = projectScopedBaseFromPathname(pathname) ?? `/projects/${projectId}`;
    const ui = projectSession?.uiMode;
    if (ui === "contractor" || ui === "sub") {
      const items: NavItem[] = [
        { href: `/projects/${projectId}/home`, label: t("home"), icon: House },
        { href: `/projects/${projectId}/files`, label: t("myDrawings"), icon: FileStack },
      ];
      if (mod.issues)
        items.push({ href: `/projects/${projectId}/issues`, label: t("myIssues"), icon: MapPin });
      if (mod.punch)
        items.push({
          href: `/projects/${projectId}/punch`,
          label: t("punchList"),
          icon: ClipboardCheck,
        });
      return [
        {
          id: "contractor",
          title: t("siteWorkspace"),
          description: t("siteWorkspaceDesc"),
          railIcon: House,
          railLabel: t("siteRail"),
          items,
        },
      ];
    }

    const showProposals = mod.proposals && workspaceRole !== "MEMBER";
    const showAudit = workspaceRole !== "MEMBER";

    const projectItems: NavItem[] = [
      { href: `/projects/${projectId}/home`, label: t("home"), icon: House },
      { href: `/projects/${projectId}/files`, label: t("filesDrawings"), icon: FileStack },
    ];
    if (mod.schedule)
      projectItems.push({
        href: `/projects/${projectId}/schedule`,
        label: t("schedule"),
        icon: ChartGantt,
      });
    if (!operationsMode && mod.issues) {
      projectItems.push({
        href: `/projects/${projectId}/issues`,
        label: t("issues"),
        icon: MapPin,
      });
    }

    const sections: NavSection[] = [
      {
        id: "core",
        title: t("projectWorkspace"),
        description: t("projectWorkspaceDesc"),
        railIcon: House,
        railLabel: t("projectRail"),
        items: projectItems,
      },
    ];

    if (operationsMode && omBilling) {
      const omItems: NavItem[] = [
        {
          href: `${omBase}/om/dashboard`,
          label: t("fmDashboard"),
          icon: LayoutGrid,
        },
        {
          href: `${omBase}/om/handover`,
          label: t("handover"),
          icon: FileCheck2,
        },
      ];
      if (mod.omAssets) {
        omItems.push({
          href: `${omBase}/om/assets`,
          label: t("assets"),
          icon: Package,
        });
      }
      if (mod.issues) {
        omItems.push({
          href: `${omBase}/om/work-orders`,
          label: t("workOrders"),
          icon: Wrench,
        });
        omItems.push({
          href: `${omBase}/issues?issueKind=CONSTRUCTION`,
          label: t("constructionIssues"),
          icon: MapPin,
        });
        if (mod.omTenantPortal) {
          omItems.push({
            href: `${omBase}/om/tenant-portal`,
            label: t("occupantHub"),
            icon: LayoutDashboard,
          });
          omItems.push({
            href: `${omBase}/om/tenant-requests`,
            label: t("occupantInbox"),
            icon: Inbox,
          });
        }
      }
      if (mod.omMaintenance) {
        omItems.push({
          href: `${omBase}/om/maintenance`,
          label: t("maintenance"),
          icon: CalendarRange,
        });
      }
      if (mod.omInspections) {
        omItems.push({
          href: `${omBase}/om/inspections`,
          label: t("inspections"),
          icon: ClipboardList,
        });
      }
      sections.push({
        id: "om",
        title: t("omTitle"),
        description: t("omDesc"),
        railIcon: LayoutGrid,
        railLabel: t("omRail"),
        items: omItems,
      });
    }

    const coordinationItems: NavItem[] = [];
    if (mod.rfis)
      coordinationItems.push({
        href: `/projects/${projectId}/rfi`,
        label: t("rfis"),
        icon: MessageSquareQuote,
      });
    if (mod.takeoff) {
      coordinationItems.push({
        href: wid ? `/workspaces/${wid}/projects/${projectId}/takeoff` : "#",
        label: t("quantityTakeoff"),
        icon: Ruler,
        disabled: !wid,
      });
    }
    if (showProposals) {
      coordinationItems.push({
        href: wid
          ? `/workspaces/${wid}/projects/${projectId}/proposals`
          : `/projects/${projectId}/proposals`,
        label: t("proposals"),
        icon: FileSpreadsheet,
        disabled: !wid,
      });
    }
    if (mod.punch)
      coordinationItems.push({
        href: `/projects/${projectId}/punch`,
        label: t("punchList"),
        icon: ClipboardCheck,
      });
    if (mod.fieldReports)
      coordinationItems.push({
        href: `/projects/${projectId}/reports`,
        label: t("fieldReports"),
        icon: ClipboardList,
      });

    if (coordinationItems.length > 0) {
      sections.push({
        id: "coordination",
        title: t("collaboration"),
        description: t("collaborationDesc"),
        railIcon: MessageSquareQuote,
        railLabel: t("collabRail"),
        items: coordinationItems,
      });
    }

    const adminItems: NavItem[] = [
      {
        href: wid ? `/workspaces/${wid}/projects/${projectId}/team` : `/projects/${projectId}/team`,
        label: t("team"),
        icon: Users,
      },
    ];
    if (showAudit) {
      adminItems.push({
        href: `/projects/${projectId}/audit`,
        label: t("auditLog"),
        icon: ScrollText,
      });
    }
    adminItems.push({
      href: `/projects/${projectId}/settings`,
      label: t("projectSettings"),
      icon: Settings,
      disabled: !isSuperAdmin(workspaceRole),
    });

    sections.push({
      id: "team-admin",
      title: t("workspaceControl"),
      description: t("workspaceControlDesc"),
      railIcon: Users,
      railLabel: t("controlRail"),
      items: adminItems,
    });

    return sections;
  }, [
    t,
    pathname,
    projectId,
    wid,
    mod,
    workspaceRole,
    projectSession?.uiMode,
    operationsMode,
    omBilling,
  ]);

  const globalMainSection = useMemo(
    (): NavSection => ({
      id: "main",
      title: t("overview"),
      description: t("overviewDesc"),
      railIcon: LayoutDashboard,
      railLabel: t("overviewRail"),
      items: [
        { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
        { href: "/projects", label: t("projects"), icon: FileStack },
      ],
    }),
    [t],
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
        title: t("resourceHub"),
        description: t("resourceHubDesc"),
        railIcon: Package,
        railLabel: t("resourcesRail"),
        items: [
          {
            href: wid ? `/workspaces/${wid}/materials` : "#",
            label: t("resourceHub"),
            icon: Package,
            disabled: !wid,
          },
        ],
      },
    ];
    if (isSuperAdmin(workspaceRole)) {
      list.push({
        id: "organization",
        title: t("organization"),
        description: t("organizationDesc"),
        railIcon: Building2,
        railLabel: t("orgRail"),
        items: [{ href: "/organization", label: t("organization"), icon: Building2 }],
      });
    }
    return list;
  }, [wid, workspaceRole, t]);

  const SIDEBAR_NAV_SECTIONS = useMemo(
    (): NavSection[] => [...SIDEBAR_NAV_PRIMARY, ...SIDEBAR_RAIL_FOOTER_SECTIONS],
    [SIDEBAR_NAV_PRIMARY, SIDEBAR_RAIL_FOOTER_SECTIONS],
  );

  const sidebarNavMultiSection = SIDEBAR_NAV_SECTIONS.length > 1;
  const useTwoLevelNav = sidebarNavMultiSection && !railCollapsed;
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>([]);

  useEffect(() => {
    setCollapsedSectionIds((prev) => {
      const filtered = prev.filter((id) =>
        SIDEBAR_NAV_SECTIONS.some((section) => section.id === id),
      );
      if (filtered.length === prev.length && filtered.every((id, idx) => id === prev[idx])) {
        return prev;
      }
      return filtered;
    });
  }, [SIDEBAR_NAV_SECTIONS]);

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

  const workspaceTitle = loading ? t("workspaceLoading") : ws?.name?.trim() || t("workspace");
  /** lg icon-only rail: hide workspace title visually, keep sr-only for a11y */
  const desktopIconRail = Boolean(railCollapsed && isDesktopLg);

  const navLinkClass = (active: boolean, disabled?: boolean, iconOnly?: boolean) => {
    const io = iconOnly === undefined ? railCollapsed : iconOnly;
    return `enterprise-sidebar-nav-link group flex min-h-11 items-center rounded-md py-2 text-[13px] font-medium tracking-[-0.01em] transition-[color,background-color,box-shadow] duration-150 ${
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

  useEffect(() => {
    const activeSection = SIDEBAR_NAV_SECTIONS.find((section) =>
      section.items.some((item) => linkActiveInSection(section, item)),
    );
    if (!activeSection) return;
    setCollapsedSectionIds((prev) => {
      if (!prev.includes(activeSection.id)) return prev;
      return prev.filter((id) => id !== activeSection.id);
    });
  }, [pathname, SIDEBAR_NAV_SECTIONS]);

  return (
    <aside
      id="enterprise-sidebar-panel"
      data-sidebar-collapsed={railCollapsed ? "true" : "false"}
      className={`enterprise-sidebar-panel fixed bottom-0 left-0 top-[var(--enterprise-topbar-offset)] z-40 flex min-h-0 w-[min(300px,88vw)] shrink-0 flex-col overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:w-[min(320px,82vw)] lg:static lg:top-auto lg:z-auto lg:h-auto lg:min-h-0 lg:max-h-none lg:translate-x-0 lg:self-stretch lg:border-b-0 lg:shadow-none lg:transition-none ${
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
        aria-label={desktopIconRail ? t("workspaceNamedAria", { name: workspaceTitle }) : undefined}
      >
        <div className={`flex shrink-0 ${desktopIconRail ? "mx-auto" : ""}`}>
          <div
            className={
              sidebarLogoSrc && !workspaceLogoFailed
                ? "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
                : "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900/35 ring-1 ring-white/[0.06]"
            }
            aria-hidden
          >
            {sidebarLogoSrc && !workspaceLogoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- external workspace / favicon URLs; `referrerPolicy` helps in installed PWA / strict clients
              <img
                src={sidebarLogoSrc}
                alt=""
                referrerPolicy={isGoogleFaviconUrl(sidebarLogoSrc) ? "no-referrer" : undefined}
                className="h-full w-full object-contain p-1.5"
                onError={() => setWorkspaceLogoFailed(true)}
              />
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
            {t("workspaceSection")}
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
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[#F8FAFC] lg:hidden"
          aria-label={t("closeNav")}
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </div>

      {/* Navigation */}
      <nav
        className={`flex min-h-0 flex-1 flex-col gap-1 px-2.5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-3 ${
          useTwoLevelNav ? "overflow-hidden" : "overflow-y-auto"
        }`}
        aria-label={t("mainNav")}
      >
        {isProjectContext && !railCollapsed ? (
          <Link
            href="/projects"
            onClick={afterNav}
            title={t("jumpToProjects")}
            className="mb-1 flex shrink-0 items-center rounded-md px-3 py-2 text-[13px] font-medium text-[#94A3B8] transition hover:bg-[var(--enterprise-sidebar-hover)] hover:text-[#F8FAFC]"
          >
            <span>{t("projects")}</span>
          </Link>
        ) : null}
        {!isProjectContext && !railCollapsed && lastProjectPath ? (
          <Link
            href={lastProjectPath}
            onClick={afterNav}
            className="mb-1 flex shrink-0 items-center rounded-md bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/14 hover:text-white"
          >
            <span>{t("projectWorkspace")}</span>
          </Link>
        ) : null}

        {useTwoLevelNav ? (
          <div className="enterprise-scrollbar enterprise-sidebar-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
            <div className="enterprise-scrollbar enterprise-sidebar-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-md bg-slate-800/35 p-1.5">
              {SIDEBAR_NAV_SECTIONS.map((section, sectionIndex) => {
                const sectionLabel =
                  section.title?.trim() || section.description?.trim() || section.railLabel;
                const isFooterStart = sectionIndex === SIDEBAR_NAV_PRIMARY.length;
                const collapsed = collapsedSectionIds.includes(section.id);
                const sectionHasActiveRoute = section.items.some((item) =>
                  linkActiveInSection(section, item),
                );
                return (
                  <div
                    key={`section-${section.id}`}
                    className={isFooterStart ? "mt-2 border-t border-white/12 pt-2" : ""}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedSectionIds((prev) =>
                          prev.includes(section.id)
                            ? prev.filter((id) => id !== section.id)
                            : [...prev, section.id],
                        )
                      }
                      aria-expanded={!collapsed}
                      aria-controls={`enterprise-sidebar-group-${section.id}`}
                      className={`mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                        sectionHasActiveRoute ? "bg-white/12" : "hover:bg-white/7"
                      }`}
                      title={sectionLabel}
                    >
                      <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-200">
                        {sectionLabel}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform ${
                          collapsed ? "" : "rotate-180"
                        }`}
                        strokeWidth={2}
                      />
                    </button>
                    <div
                      id={`enterprise-sidebar-group-${section.id}`}
                      className={collapsed ? "hidden" : "space-y-0.5"}
                    >
                      {section.items.map((item) => {
                        const active = linkActiveInSection(section, item);
                        const ItemIcon = item.icon;
                        const disabled = "disabled" in item && item.disabled;
                        const sectionHeading = section.title?.trim();
                        return (
                          <Link
                            key={`${section.id}-${item.href}`}
                            href={disabled ? "#" : item.href}
                            onClick={(e) => {
                              if (disabled) e.preventDefault();
                              else afterNav();
                            }}
                            title={
                              sectionHeading
                                ? t("sectionItemTitle", {
                                    section: sectionHeading,
                                    label: item.label,
                                  })
                                : item.label
                            }
                            className={`group flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                              active
                                ? "bg-[var(--enterprise-primary)]/90 text-white"
                                : disabled
                                  ? "cursor-not-allowed text-[var(--enterprise-sidebar-muted)]/45 opacity-55"
                                  : "text-slate-100 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <ItemIcon
                              className={`h-3.5 w-3.5 shrink-0 ${
                                active ? "text-white" : "text-slate-400 group-hover:text-white"
                              }`}
                              strokeWidth={1.75}
                            />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
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
                aria-label={section.title?.trim() || section.description || t("navigationFallback")}
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
                    const sectionHeading = section.title?.trim();
                    return (
                      <Link
                        key={`${section.id}-${item.href}`}
                        href={disabled ? "#" : item.href}
                        onClick={(e) => {
                          if (disabled) e.preventDefault();
                          else afterNav();
                        }}
                        title={
                          railCollapsed && sectionHeading
                            ? t("sectionItemTitle", {
                                section: sectionHeading,
                                label: item.label,
                              })
                            : item.label
                        }
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
                aria-label={t("workspaceSection")}
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
