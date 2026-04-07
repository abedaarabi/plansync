"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarRange,
  ClipboardList,
  ClipboardCheck,
  FileCheck2,
  FileStack,
  LayoutDashboard,
  LayoutGrid,
  MessageSquareQuote,
  Package,
  Search,
  UserRound,
  Users,
  House,
  MapPin,
  FileSpreadsheet,
  Ruler,
  ScrollText,
  Settings,
  Wrench,
} from "lucide-react";
import { useProjectNavHref } from "./useProjectNavHref";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { fetchProjectSession } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { isSuperAdmin } from "@/lib/workspaceRole";

type Cmd = { id: string; label: string; hint?: string; href: string; icon: typeof LayoutDashboard };

function extractProjectId(pathname: string): string | null {
  const match =
    pathname.match(/^\/projects\/([^/]+)/) ??
    pathname.match(/^\/workspaces\/[^/]+\/projects\/([^/]+)/);
  if (!match) return null;
  const segment = match[1];
  if (segment === "new") return null;
  return segment;
}

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { primary } = useEnterpriseWorkspace();
  const ws = primary?.workspace;
  const wid = ws?.id;
  const workspaceRole = primary?.role;
  const isPro = isWorkspaceProClient(ws?.subscriptionStatus);
  const { projectId: lastProjectId } = useProjectNavHref();
  const projectId = extractProjectId(pathname) ?? lastProjectId;

  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(projectId ?? ""),
    queryFn: () => fetchProjectSession(projectId!),
    enabled: Boolean(wid && projectId && isPro),
    staleTime: 30_000,
  });

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
  };
  const mod = projectSession?.settings.modules ?? defaultModules;
  const operationsMode = projectSession?.operationsMode ?? false;

  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo((): Cmd[] => {
    const out: Cmd[] = [
      {
        id: "dash",
        label: "Go to Dashboard",
        hint: "Overview & KPIs",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        id: "account",
        label: "Account",
        hint: "Profile & sign out",
        href: "/account",
        icon: UserRound,
      },
      {
        id: "projects",
        label: "Projects",
        hint: "PDFs & folders",
        href: "/projects",
        icon: FileStack,
      },
    ];

    if (wid) {
      out.push({
        id: "materials",
        label: "Materials database",
        hint: "Catalog, Excel import",
        href: `/workspaces/${wid}/materials`,
        icon: Package,
      });
    }

    if (isSuperAdmin(workspaceRole)) {
      out.push(
        {
          id: "org",
          label: "Organization",
          hint: "Branding & invites",
          href: "/organization",
          icon: Building2,
        },
        {
          id: "invite-member",
          label: "Invite member",
          hint: "Email invites & seats",
          href: "/organization?tab=invite-member",
          icon: Users,
        },
      );
    }

    if (!projectId) return out;

    const ui = projectSession?.uiMode;
    if (ui === "contractor" || ui === "sub") {
      out.push(
        {
          id: "phome",
          label: "Project home",
          hint: "Home",
          href: `/projects/${projectId}/home`,
          icon: House,
        },
        {
          id: "files",
          label: "My Drawings",
          hint: "Project files",
          href: `/projects/${projectId}/files`,
          icon: FileStack,
        },
      );
      if (mod.issues) {
        out.push({
          id: "issues",
          label: "Open My Issues",
          hint: "Issues",
          href: `/projects/${projectId}/issues`,
          icon: MapPin,
        });
      }
      if (mod.punch) {
        out.push({
          id: "punch",
          label: "Open Punch List",
          hint: "Field punch items",
          href: `/projects/${projectId}/punch`,
          icon: ClipboardCheck,
        });
      }
      return out;
    }

    const showProposals = mod.proposals && workspaceRole !== "MEMBER";
    const showAudit = workspaceRole !== "MEMBER";

    out.push(
      {
        id: "phome",
        label: "Project home",
        hint: "Home",
        href: `/projects/${projectId}/home`,
        icon: House,
      },
      {
        id: "files",
        label: "Files & Drawings",
        hint: "Project files",
        href: `/projects/${projectId}/files`,
        icon: FileStack,
      },
    );
    if (operationsMode) {
      out.push({
        id: "om-fm-dashboard",
        label: "FM dashboard",
        hint: "KPIs, maintenance & work orders",
        href: `/projects/${projectId}/om/dashboard`,
        icon: LayoutGrid,
      });
      out.push({
        id: "om-handover",
        label: "Handover",
        hint: "Readiness & FM brief",
        href: `/projects/${projectId}/om/handover`,
        icon: FileCheck2,
      });
      if (mod.omAssets) {
        out.push({
          id: "om-assets",
          label: "Assets",
          hint: "O&M equipment",
          href: `/projects/${projectId}/om/assets`,
          icon: Package,
        });
      }
      if (mod.issues) {
        out.push({
          id: "om-wo",
          label: "Work orders",
          hint: "O&M",
          href: `/projects/${projectId}/om/work-orders`,
          icon: Wrench,
        });
      }
      if (mod.omMaintenance) {
        out.push({
          id: "om-maint",
          label: "Maintenance (PPM)",
          hint: "Schedules",
          href: `/projects/${projectId}/om/maintenance`,
          icon: CalendarRange,
        });
      }
      if (mod.omInspections) {
        out.push({
          id: "om-insp",
          label: "Inspections",
          hint: "Templates & runs",
          href: `/projects/${projectId}/om/inspections`,
          icon: ClipboardList,
        });
      }
      if (mod.omTenantPortal) {
        out.push({
          id: "om-tenant",
          label: "Tenant portal",
          hint: "Occupant links",
          href: `/projects/${projectId}/om/tenant-portal`,
          icon: Building2,
        });
      }
    } else if (mod.issues) {
      out.push({
        id: "issues",
        label: "Open Issues",
        hint: "Issues",
        href: `/projects/${projectId}/issues`,
        icon: MapPin,
      });
    }
    if (mod.rfis) {
      out.push({
        id: "rfi",
        label: "Open RFIs",
        hint: "Requests for information",
        href: `/projects/${projectId}/rfi`,
        icon: MessageSquareQuote,
      });
    }
    if (mod.takeoff) {
      out.push({
        id: "takeoff",
        label: "Quantity Takeoff",
        hint: "Measurements",
        href: wid ? `/workspaces/${wid}/projects/${projectId}/takeoff` : "#",
        icon: Ruler,
      });
    }
    if (showProposals) {
      out.push({
        id: "proposals",
        label: "Proposals",
        hint: "Estimates & bids",
        href: wid
          ? `/workspaces/${wid}/projects/${projectId}/proposals`
          : `/projects/${projectId}/proposals`,
        icon: FileSpreadsheet,
      });
    }
    if (mod.punch) {
      out.push({
        id: "punch",
        label: "Open Punch List",
        hint: "Field punch items",
        href: `/projects/${projectId}/punch`,
        icon: ClipboardCheck,
      });
    }
    if (mod.fieldReports) {
      out.push({
        id: "reports",
        label: "Open Field Reports",
        hint: "Daily logs & photos",
        href: `/projects/${projectId}/reports`,
        icon: ClipboardList,
      });
    }
    out.push({
      id: "team",
      label: "Team",
      hint: "Project team",
      href: wid ? `/workspaces/${wid}/projects/${projectId}/team` : `/projects/${projectId}/team`,
      icon: Users,
    });
    if (showAudit) {
      out.push({
        id: "audit",
        label: "Audit log",
        hint: "Activity history",
        href: `/projects/${projectId}/audit`,
        icon: ScrollText,
      });
    }
    if (isSuperAdmin(workspaceRole)) {
      out.push({
        id: "proj-settings",
        label: "Project Settings",
        hint: "Currency & modules",
        href: `/projects/${projectId}/settings`,
        icon: Settings,
      });
    }

    return out;
  }, [
    wid,
    workspaceRole,
    projectId,
    projectSession?.uiMode,
    projectSession?.settings,
    mod,
    operationsMode,
  ]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(s) || (c.hint && c.hint.toLowerCase().includes(s)),
    );
  }, [q, commands]);

  const run = useCallback(
    (href: string) => {
      if (href === "#") return;
      router.push(href);
      onClose();
      setQ("");
      setIdx(0);
    },
    [router, onClose],
  );

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
    setQ("");
    setIdx(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onNav = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(filtered.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter" && filtered[idx]) {
        e.preventDefault();
        run(filtered[idx].href);
      }
    };
    window.addEventListener("keydown", onNav);
    return () => window.removeEventListener("keydown", onNav);
  }, [open, filtered, idx, run]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-[#0c1222]/55 pt-[min(16vh,140px)] backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-label="Command palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="enterprise-animate-in w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-surface)]/95 shadow-[var(--enterprise-shadow-floating)] backdrop-blur-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--enterprise-border)]/90 bg-[var(--enterprise-bg)]/40 px-4 py-3">
          <Search
            className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
            strokeWidth={1.75}
          />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            placeholder="Search commands…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--enterprise-text)] outline-none placeholder:text-[var(--enterprise-text-muted)]"
          />
          <kbd className="hidden rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--enterprise-text-muted)] sm:inline">
            ESC
          </kbd>
        </div>
        <ul className="max-h-[min(52vh,420px)] overflow-y-auto p-2 enterprise-scrollbar">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-[var(--enterprise-text-muted)]">
              No matches
            </li>
          )}
          {filtered.map((c, i) => {
            const Icon = c.icon;
            const active = i === idx;
            const dead = c.href === "#";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={dead}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => run(c.href)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    dead
                      ? "cursor-not-allowed opacity-40"
                      : active
                        ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-text)] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]"
                        : "text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.label}</span>
                    {c.hint && (
                      <span className="block text-xs text-[var(--enterprise-text-muted)]">
                        {c.hint}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-[var(--enterprise-border)]/90 bg-[var(--enterprise-bg)]/35 px-4 py-2.5 text-[10px] font-medium text-[var(--enterprise-text-muted)]">
          <span className="opacity-90">Navigate with ↑↓ · Enter to run</span>
        </div>
      </div>
    </div>
  );
}
