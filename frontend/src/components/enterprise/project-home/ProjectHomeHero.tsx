"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CalendarDays,
  FolderOpen,
  Layers,
  MapPin,
  Pencil,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { ProjectLogo } from "@/components/enterprise/ProjectLogo";
import { formatDateLabel } from "./projectHomeUtils";

type MetaTile = {
  label: string;
  value: string;
  icon: LucideIcon;
};

type Props = {
  projectId: string;
  name: string;
  logoUrl?: string | null;
  projectNumber?: string | null;
  location?: string | null;
  stage?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  fileCount: number;
  folderCount: number;
  onEdit: () => void;
};

export function ProjectHomeHero({
  projectId,
  name,
  logoUrl,
  projectNumber,
  location,
  stage,
  startDate,
  endDate,
  fileCount,
  folderCount,
  onEdit,
}: Props) {
  const meta: MetaTile[] = [
    { label: "Stage", value: stage?.trim() || "Not set", icon: Layers },
    { label: "Start", value: formatDateLabel(startDate), icon: CalendarDays },
    { label: "End", value: formatDateLabel(endDate), icon: CalendarClock },
    {
      label: "Location",
      value: location?.trim() || "Not set",
      icon: MapPin,
    },
  ];

  return (
    <header className="enterprise-card enterprise-animate-in overflow-hidden p-0">
      <div className="border-b border-[var(--enterprise-border)] px-3.5 py-3.5 sm:px-4 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="shrink-0 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-0.5">
              <ProjectLogo name={name} logoUrl={logoUrl} size={44} />
            </div>
            <div className="min-w-0">
              <p className="enterprise-type-label">Project home</p>
              <h1 className="enterprise-type-title mt-0.5 break-words">{name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {projectNumber?.trim() ? (
                  <span className="enterprise-badge-neutral rounded px-2 py-0.5 text-xs font-semibold tabular-nums">
                    #{projectNumber.trim()}
                  </span>
                ) : null}
                {location?.trim() ? (
                  <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs text-[var(--enterprise-text-muted)]">
                    <MapPin
                      className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span className="truncate">{location.trim()}</span>
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-0.5 text-xs font-medium text-[var(--enterprise-text-muted)]">
                  <FolderOpen className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                  <span className="tabular-nums text-[var(--enterprise-text)]">{fileCount}</span>
                  files
                  <span className="text-[var(--enterprise-border)]" aria-hidden>
                    ·
                  </span>
                  <span className="tabular-nums text-[var(--enterprise-text)]">{folderCount}</span>
                  folders
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <EnterpriseButton type="button" size="sm" variant="secondary" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Edit project
            </EnterpriseButton>
            <Link
              href={`/projects/${projectId}/team`}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--enterprise-text)] transition-colors hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35"
            >
              <Users className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Team
            </Link>
            <Link
              href={`/projects/${projectId}/settings`}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--enterprise-text)] transition-colors hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35"
            >
              <Settings2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Settings
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--enterprise-border)] sm:grid-cols-4 sm:divide-y-0">
        {meta.map((m) => (
          <div key={m.label} className="flex min-w-0 items-start gap-2.5 px-3.5 py-3 sm:px-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]">
              <m.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="enterprise-type-caption">{m.label}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--enterprise-text)]">
                {m.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}
