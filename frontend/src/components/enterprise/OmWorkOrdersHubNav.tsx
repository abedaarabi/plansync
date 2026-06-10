"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Building2, Package, Wrench } from "lucide-react";
import { projectScopedBaseFromPathname, projectScopedHref } from "@/lib/projectScopedPath";

type Tab = { segment: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { segment: "/om/work-orders", label: "Work orders", icon: Wrench },
  { segment: "/om/vendors", label: "Vendors", icon: Building2 },
  { segment: "/om/parts-inventory", label: "Parts", icon: Package },
  { segment: "/om/reports", label: "Reports", icon: BarChart3 },
];

type Props = { projectId: string };

export function OmWorkOrdersHubNav({ projectId }: Props) {
  const pathname = usePathname();
  const base = projectScopedBaseFromPathname(pathname) ?? projectScopedHref(projectId, "");

  return (
    <nav
      aria-label="Maintenance hub"
      role="tablist"
      className="grid w-full grid-cols-2 gap-1 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/90 p-1 sm:grid-cols-4"
    >
      {TABS.map((tab) => {
        const href = `${base}${tab.segment}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.segment}
            href={href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            data-active={active ? "true" : undefined}
            className={
              active
                ? "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 active:scale-[0.98] sm:min-h-10 sm:px-3 [&_svg]:text-white"
                : "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-[var(--enterprise-text-muted)] transition-all duration-150 hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] active:scale-[0.98] sm:min-h-10 sm:px-3 [&_svg]:opacity-70"
            }
            style={active ? { backgroundColor: "var(--enterprise-primary)" } : undefined}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={active ? 2 : 1.75} aria-hidden />
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
