"use client";

import type { LucideIcon } from "lucide-react";
import { AlertCircle, ArrowUpRight, Clock3, FileText, MessageSquareQuote } from "lucide-react";
import Link from "next/link";

type Kpi = {
  label: string;
  value: number;
  href: string;
  hint: string;
  icon: LucideIcon;
  emphasize?: boolean;
};

type Props = {
  projectId: string;
  openIssues: number;
  overdueIssues: number;
  fileCount: number;
  openRfis: number;
};

export function ProjectHomeKpiStrip({
  projectId,
  openIssues,
  overdueIssues,
  fileCount,
  openRfis,
}: Props) {
  const kpis: Kpi[] = [
    {
      label: "Open issues",
      value: openIssues,
      href: `/projects/${projectId}/issues`,
      hint: overdueIssues > 0 ? `${overdueIssues} overdue` : "All on track",
      icon: AlertCircle,
      emphasize: openIssues > 0,
    },
    {
      label: "Overdue",
      value: overdueIssues,
      href: `/projects/${projectId}/issues`,
      hint: overdueIssues > 0 ? "Needs attention" : "None past due",
      icon: Clock3,
      emphasize: overdueIssues > 0,
    },
    {
      label: "Files",
      value: fileCount,
      href: `/projects/${projectId}/files`,
      hint: "Drawings & models",
      icon: FileText,
    },
    {
      label: "Open RFIs",
      value: openRfis,
      href: `/projects/${projectId}/rfi`,
      hint: "Awaiting response",
      icon: MessageSquareQuote,
      emphasize: openRfis > 0,
    },
  ];

  return (
    <nav aria-label="Project KPIs" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {kpis.map((k) => (
        <Link
          key={k.label}
          href={k.href}
          className="enterprise-card enterprise-card-hover group flex min-h-[5.5rem] gap-3 p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35"
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] ${
              k.emphasize ? "text-[var(--enterprise-error)]" : "text-[var(--enterprise-text-muted)]"
            }`}
          >
            <k.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1">
              <p className="enterprise-type-caption">{k.label}</p>
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
                strokeWidth={1.75}
                aria-hidden
              />
            </div>
            <p
              className={`mt-0.5 text-xl font-semibold tabular-nums tracking-tight ${
                k.emphasize && k.value > 0
                  ? "text-[var(--enterprise-error)]"
                  : "text-[var(--enterprise-text)]"
              }`}
            >
              {k.value}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--enterprise-text-muted)]">{k.hint}</p>
          </div>
        </Link>
      ))}
    </nav>
  );
}
