"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  ClipboardList,
  FileStack,
  House,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageSquareQuote,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { fetchProjectSession } from "@/lib/api-client";
import { extractProjectIdFromPath } from "@/lib/projectScopedPath";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

export type MobileNavTab = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  exact?: boolean;
  /** Opens overflow menu instead of navigating */
  isMore?: boolean;
};

function isNavActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGlobalActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/projects") {
    return (
      pathname === "/projects" ||
      pathname.startsWith("/projects/") ||
      pathname.includes("/projects/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

// fallow-ignore-next-line complexity
export function useEnterpriseMobileNav(): {
  tabs: MobileNavTab[];
  isProjectContext: boolean;
  isTabActive: (tab: MobileNavTab) => boolean;
} {
  const pathname = usePathname();
  const t = useTranslations("app.shell");
  const { primary } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace);
  const projectId = extractProjectIdFromPath(pathname);
  const isProjectContext = Boolean(projectId);

  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(projectId ?? ""),
    queryFn: () => fetchProjectSession(projectId!),
    enabled: Boolean(wid && projectId && isPro && isProjectContext),
    staleTime: 30_000,
  });

  const mod = projectSession?.settings.modules ?? {
    issues: true,
    rfis: true,
    punch: true,
    fieldReports: true,
  };
  const ui = projectSession?.uiMode;
  const operationsMode = projectSession?.operationsMode ?? false;

  const tabs = useMemo((): MobileNavTab[] => {
    if (!isProjectContext || !projectId) {
      const global: MobileNavTab[] = [
        { id: "dashboard", href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
        { id: "projects", href: "/projects", label: t("projects"), icon: FileStack },
      ];
      global.push({
        id: "more",
        href: "#more",
        label: "More",
        icon: Menu,
        isMore: true,
      });
      return global.slice(0, 5);
    }

    if (ui === "contractor" || ui === "sub") {
      const items: MobileNavTab[] = [
        { id: "home", href: `/projects/${projectId}/home`, label: t("home"), icon: House },
        {
          id: "files",
          href: `/projects/${projectId}/files`,
          label: t("myDrawings"),
          icon: FileStack,
        },
      ];
      if (mod.issues) {
        items.push({
          id: "issues",
          href: `/projects/${projectId}/issues`,
          label: t("myIssues"),
          icon: MapPin,
        });
      }
      if (mod.punch) {
        items.push({
          id: "punch",
          href: `/projects/${projectId}/punch`,
          label: t("punchList"),
          icon: ClipboardCheck,
        });
      }
      if (items.length >= 5) {
        return [
          ...items.slice(0, 4),
          { id: "more", href: "#more", label: "More", icon: Menu, isMore: true },
        ];
      }
      items.push({ id: "more", href: "#more", label: "More", icon: Menu, isMore: true });
      return items;
    }

    const items: MobileNavTab[] = [
      { id: "home", href: `/projects/${projectId}/home`, label: t("home"), icon: House },
      {
        id: "files",
        href: `/projects/${projectId}/files`,
        label: t("filesDrawings"),
        icon: FileStack,
      },
    ];

    if (!operationsMode && mod.issues) {
      items.push({
        id: "issues",
        href: `/projects/${projectId}/issues`,
        label: t("issues"),
        icon: MapPin,
      });
    }

    if (mod.punch && items.length < 4) {
      items.push({
        id: "punch",
        href: `/projects/${projectId}/punch`,
        label: t("punchList"),
        icon: ClipboardCheck,
      });
    } else if (mod.rfis && items.length < 4) {
      items.push({
        id: "rfi",
        href: `/projects/${projectId}/rfi`,
        label: t("rfis"),
        icon: MessageSquareQuote,
      });
    } else if (mod.fieldReports && items.length < 4) {
      items.push({
        id: "reports",
        href: `/projects/${projectId}/reports`,
        label: t("fieldReports"),
        icon: ClipboardList,
      });
    }

    if (items.length >= 5) {
      return [
        ...items.slice(0, 4),
        { id: "more", href: "#more", label: "More", icon: Menu, isMore: true },
      ];
    }
    items.push({ id: "more", href: "#more", label: "More", icon: Menu, isMore: true });
    return items;
  }, [isProjectContext, projectId, ui, mod, operationsMode, t]);

  const isTabActive = (tab: MobileNavTab) => {
    if (tab.isMore) return false;
    if (!isProjectContext) return isGlobalActive(pathname, tab.href);
    return isNavActive(pathname, tab.href, tab.exact);
  };

  return { tabs, isProjectContext, isTabActive };
}
