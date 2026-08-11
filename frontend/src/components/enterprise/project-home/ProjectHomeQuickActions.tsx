"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CalendarDays,
  ClipboardCheck,
  FileStack,
  FolderOpen,
  MessageSquareQuote,
  Users,
} from "lucide-react";
import Link from "next/link";

type Action = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

type Props = {
  projectId: string;
};

export function ProjectHomeQuickActions({ projectId }: Props) {
  const actions: Action[] = [
    {
      label: "Files & drawings",
      href: `/projects/${projectId}/files`,
      icon: FolderOpen,
      description: "Open PDFs and models",
    },
    {
      label: "Issues",
      href: `/projects/${projectId}/issues`,
      icon: AlertCircle,
      description: "Track field problems",
    },
    {
      label: "RFIs",
      href: `/projects/${projectId}/rfi`,
      icon: MessageSquareQuote,
      description: "Questions & answers",
    },
    {
      label: "Punch list",
      href: `/projects/${projectId}/punch`,
      icon: ClipboardCheck,
      description: "Closeout items",
    },
    {
      label: "Schedule",
      href: `/projects/${projectId}/schedule`,
      icon: CalendarDays,
      description: "Milestones & dates",
    },
    {
      label: "Reports",
      href: `/projects/${projectId}/reports`,
      icon: FileStack,
      description: "Exports & summaries",
    },
    {
      label: "Team",
      href: `/projects/${projectId}/team`,
      icon: Users,
      description: "Members & access",
    },
  ];

  return (
    <section className="enterprise-card p-3.5 sm:p-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="enterprise-type-label">Quick actions</h2>
          <p className="enterprise-type-caption mt-1">Jump into everyday project work</p>
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {actions.map((a) => (
          <li key={a.href} className="min-w-0">
            <Link
              href={a.href}
              className="flex h-full min-h-10 flex-col gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 transition hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
                <a.icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--enterprise-text)]">
                  {a.label}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[var(--enterprise-text-muted)]">
                  {a.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
