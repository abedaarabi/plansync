"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  Gauge,
  Layers,
  MapPin,
  MessageSquareQuote,
  Pencil,
  Play,
  Target,
} from "lucide-react";
import {
  fetchProjects,
  fetchProject,
  fetchIssuesForProject,
  fetchProjectRfis,
  fetchProjectPunch,
  fetchProjectDashboard,
} from "@/lib/api-client";
import { parseProjectCoords } from "@/lib/projectGeo";
import { geocodeLocationName } from "@/lib/openMeteoGeocode";
import { DashboardActivityChart } from "@/components/enterprise/DashboardActivityChart";
import { ProjectHomeOverviewCharts } from "@/components/enterprise/ProjectHomeOverviewCharts";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import type { CloudFile } from "@/types/projects";
import { isPdfFile } from "@/lib/isPdfFile";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { ProjectLogo } from "./ProjectLogo";
import { ProjectLocationMap } from "./ProjectLocationMap";
import { ProjectWeatherAtLocation } from "./ProjectWeatherAtLocation";
import { ProjectEditSlideOver } from "./ProjectEditSlideOver";
import { useTickNowMs } from "@/lib/useTickNowMs";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";

function sortedFileVersions(f: CloudFile) {
  return [...f.versions].sort((a, b) => b.version - a.version);
}

function relativeTime(iso: string, nowMs: number): string {
  const diff = nowMs - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateLabel(iso?: string | null): string {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Sort key: prefer last viewer open, then upload/update, then created. */
function fileRecencySortKey(f: CloudFile): number {
  const iso = f.lastOpenedAt ?? f.updatedAt ?? f.createdAt;
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function fileActivityLabel(f: CloudFile, nowMs: number): string | null {
  const iso = f.lastOpenedAt ?? f.updatedAt;
  if (!iso) return null;
  return relativeTime(iso, nowMs);
}

type Props = {
  projectId: string;
};

export function ProjectDashboardClient({ projectId }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const nowMs = useTickNowMs();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace);

  const { data: projects = [], isPending: projPending } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const project = projects.find((p) => p.id === projectId);

  /** Authoritative row for coords (list payload can lag after edits). */
  const { data: projectMeta, isPending: projectMetaPending } = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProject(projectId),
    enabled: Boolean(projectId && isPro),
  });

  const savedCoords = useMemo(
    () => parseProjectCoords(projectMeta) ?? parseProjectCoords(project),
    [projectMeta, project],
  );

  const locationText = (projectMeta?.location ?? project?.location)?.trim() ?? "";

  const { data: geocoded, isPending: geocodePending } = useQuery({
    queryKey: ["geocodeOpenMeteo", locationText],
    queryFn: () => geocodeLocationName(locationText),
    enabled:
      Boolean(projectId && isPro && locationText.length > 0 && !savedCoords) && !projectMetaPending,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const mapCoords = savedCoords ?? (geocoded ? { lat: geocoded.lat, lng: geocoded.lng } : null);
  const isApproximateLocation = !savedCoords && Boolean(geocoded);

  function openFile(f: CloudFile) {
    const sv = sortedFileVersions(f);
    const v = sv[0];
    const q = new URLSearchParams({ fileId: f.id, name: f.name });
    q.set("projectId", projectId);
    if (v) {
      q.set("version", String(v.version));
      q.set("fileVersionId", v.id);
    }
    router.push(`/viewer?${q.toString()}`);
  }

  const { data: rfis = [] } = useQuery({
    queryKey: qk.projectRfis(projectId),
    queryFn: () => fetchProjectRfis(projectId),
    enabled: Boolean(projectId && isPro),
  });

  const { data: punchItems = [] } = useQuery({
    queryKey: qk.projectPunch(projectId),
    queryFn: () => fetchProjectPunch(projectId),
    enabled: Boolean(projectId && isPro),
  });
  const { data: issues = [] } = useQuery({
    queryKey: qk.issuesForProject(projectId),
    queryFn: () => fetchIssuesForProject(projectId),
    enabled: Boolean(projectId && isPro),
  });

  const { data: projectDash, isPending: projectDashPending } = useQuery({
    queryKey: qk.projectDashboard(projectId),
    queryFn: () => fetchProjectDashboard(projectId),
    enabled: Boolean(projectId && isPro),
  });

  const loading = ctxLoading || projPending;

  if (loading) {
    return <EnterpriseLoadingState message="Loading project…" label="Loading project overview" />;
  }

  if (!project) {
    return (
      <div className="enterprise-card p-8 text-center text-sm text-[var(--enterprise-text-muted)]">
        Project not found.{" "}
        <Link
          href="/projects"
          className="font-semibold text-[var(--enterprise-primary)] hover:underline"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  const openRfis = rfis.filter((r) => {
    const s = r.status.toUpperCase();
    return s === "OPEN" || s === "IN_REVIEW";
  }).length;
  const openIssues = issues.filter((i) => i.status !== "closed" && i.status !== "CLOSED").length;
  const highPriorityIssues = issues.filter((i) => i.priority?.toLowerCase() === "high").length;
  const overdueIssues = issues.filter((i) => {
    if (!i.dueDate) return false;
    return new Date(i.dueDate).getTime() < nowMs && i.status.toLowerCase() !== "closed";
  }).length;
  const fileCount = project.files.length;
  const folderCount = project.folders.length;
  const progress = typeof project.progressPercent === "number" ? project.progressPercent : 0;

  const quickStats: {
    label: string;
    value: number;
    href: string;
    icon: LucideIcon;
    iconWrap: string;
    iconColor: string;
  }[] = [
    {
      label: "Issues open",
      value: openIssues,
      href: `/projects/${projectId}/issues`,
      icon: AlertCircle,
      iconWrap: "bg-red-500/12 ring-1 ring-red-500/15",
      iconColor: "text-red-600 dark:text-red-400",
    },
    {
      label: "Overdue",
      value: overdueIssues,
      href: `/projects/${projectId}/issues`,
      icon: Clock3,
      iconWrap: "bg-orange-500/12 ring-1 ring-orange-500/15",
      iconColor: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "Files",
      value: fileCount,
      href: `/projects/${projectId}/files`,
      icon: FileText,
      iconWrap: "bg-[var(--enterprise-primary)]/10 ring-1 ring-[var(--enterprise-primary)]/15",
      iconColor: "text-[var(--enterprise-primary)]",
    },
    {
      label: "Open RFIs",
      value: openRfis,
      href: `/projects/${projectId}/rfi`,
      icon: MessageSquareQuote,
      iconWrap: "bg-amber-500/12 ring-1 ring-amber-500/20",
      iconColor: "text-amber-700 dark:text-amber-400",
    },
  ];

  const recentFiles = [...project.files]
    .sort((a, b) => fileRecencySortKey(b) - fileRecencySortKey(a))
    .slice(0, 5);

  const continueFile =
    recentFiles[0]?.lastOpenedAt != null && recentFiles[0].lastOpenedAt !== ""
      ? recentFiles[0]
      : null;

  const recentIssues = [...punchItems]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="enterprise-animate-in space-y-8">
      <div className="enterprise-card relative overflow-hidden bg-gradient-to-br from-[var(--enterprise-surface)] via-[var(--enterprise-surface)] to-[var(--enterprise-bg)]/80 p-5 sm:p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--enterprise-primary)]/[0.06]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="relative shrink-0">
            <div
              className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-[var(--enterprise-primary)]/20 via-transparent to-violet-500/15 opacity-80"
              aria-hidden
            />
            <div className="relative rounded-xl bg-[var(--enterprise-surface)] p-0.5 shadow-sm ring-1 ring-[var(--enterprise-border)]/80">
              <ProjectLogo name={project.name} logoUrl={project.logoUrl} size={48} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--enterprise-text)]">
              {project.name}
            </h1>
            {(project.projectNumber?.trim() || project.location?.trim()) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--enterprise-text-muted)]">
                {project.projectNumber?.trim() ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--enterprise-bg)] px-2 py-0.5 font-medium text-[var(--enterprise-text)] ring-1 ring-[var(--enterprise-border)]/80">
                    #{project.projectNumber.trim()}
                  </span>
                ) : null}
                {project.location?.trim() ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin
                      className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span className="truncate">{project.location.trim()}</span>
                  </span>
                ) : null}
              </p>
            )}
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex gap-3 rounded-xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-bg)]/35 p-3.5 ring-1 ring-inset ring-white/40 dark:ring-white/[0.04]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 ring-1 ring-violet-500/15 dark:text-violet-400">
              <Layers className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                Stage
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--enterprise-text)]">
                {project.stage ?? "Not set"}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-bg)]/35 p-3.5 ring-1 ring-inset ring-white/40 dark:ring-white/[0.04]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/12 text-blue-600 ring-1 ring-blue-500/15 dark:text-blue-400">
              <CalendarDays className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                Start date
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--enterprise-text)]">
                {formatDateLabel(project.startDate)}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-bg)]/35 p-3.5 ring-1 ring-inset ring-white/40 dark:ring-white/[0.04]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/15 dark:text-emerald-400">
              <CalendarClock className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                End date
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--enterprise-text)]">
                {formatDateLabel(project.endDate)}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-bg)]/35 p-3.5 ring-1 ring-inset ring-white/40 dark:ring-white/[0.04]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-sky-600 ring-1 ring-sky-500/15 dark:text-sky-400">
              <MapPin className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                Location
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--enterprise-text)]">
                {project.location?.trim() || "Not set"}
              </p>
            </div>
          </div>
        </div>

        <nav
          aria-label="Project summary"
          className="relative mt-5 flex flex-wrap gap-2 border-t border-[var(--enterprise-border)]/80 pt-5"
        >
          {quickStats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="group inline-flex min-w-[7.5rem] flex-1 items-center gap-2.5 rounded-xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-surface)]/90 px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--enterprise-primary)]/28 hover:shadow-[var(--enterprise-shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35 sm:min-w-0 sm:flex-none"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.iconWrap}`}
              >
                <s.icon className={`h-4 w-4 ${s.iconColor}`} strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-lg font-bold tabular-nums leading-none text-[var(--enterprise-text)] group-hover:text-[var(--enterprise-primary)]">
                  {s.value}
                </span>
                <span className="mt-1 block text-[11px] font-medium leading-tight text-[var(--enterprise-text-muted)]">
                  {s.label}
                </span>
              </span>
            </Link>
          ))}
        </nav>
      </div>

      <section className="enterprise-card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
              Site map &amp; weather
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-[var(--enterprise-text-muted)]">
              OpenStreetMap pin and current conditions (Open-Meteo). Set the pin in{" "}
              <span className="font-medium text-[var(--enterprise-text)]">Edit project</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--enterprise-primary)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)]"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Edit location
          </button>
        </div>
        {mapCoords ? (
          <div className="mt-4 space-y-3">
            {isApproximateLocation ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[12px] leading-snug text-amber-950/90 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100/90">
                Approximate position from your location text. Open{" "}
                <span className="font-medium">Edit location</span> and click the map to save an
                exact pin.
              </p>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="min-h-[220px] lg:col-span-3">
                <ProjectLocationMap
                  height={260}
                  latitude={mapCoords.lat}
                  longitude={mapCoords.lng}
                  zoom={14}
                />
              </div>
              <div className="flex flex-col justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 p-4 lg:col-span-2">
                <ProjectWeatherAtLocation latitude={mapCoords.lat} longitude={mapCoords.lng} />
              </div>
            </div>
          </div>
        ) : (locationText && !savedCoords && projectMetaPending) || geocodePending ? (
          <div className="mt-4 flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-10 text-center">
            <p className="text-sm text-[var(--enterprise-text-muted)]">Loading map and weather…</p>
          </div>
        ) : locationText && !savedCoords && !geocodePending ? (
          <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-10 text-center">
            <MapPin
              className="h-10 w-10 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="max-w-sm text-sm text-[var(--enterprise-text-muted)]">
              We couldn&apos;t place that address on the map. Set a pin on the map in Edit project,
              or try a clearer city or address.
            </p>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Edit location
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-10 text-center">
            <MapPin
              className="h-10 w-10 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="max-w-sm text-sm text-[var(--enterprise-text-muted)]">
              Add a location name or click the map in Edit project to set a site pin — then the map
              and weather appear here.
            </p>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Set location
            </button>
          </div>
        )}
      </section>

      <ProjectEditSlideOver
        open={editOpen}
        project={project}
        workspaceId={wid}
        onClose={() => setEditOpen(false)}
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-6">
        <ProjectHomeOverviewCharts
          projectId={projectId}
          issues={issues}
          punchItems={punchItems}
          rfis={rfis}
        />

        <section className="enterprise-card flex h-full min-h-0 flex-col p-5 sm:p-6">
          <div className="shrink-0 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
              Project activity
            </h2>
            <p className="text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
              Audit events for this project · hover or tap the chart for each day
            </p>
          </div>
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            {projectDashPending && !projectDash ? (
              <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 text-sm text-[var(--enterprise-text-muted)]">
                Loading activity…
              </div>
            ) : (
              <DashboardActivityChart
                compact
                fillHeight
                className="min-h-0"
                data={projectDash?.activityLast14Days ?? []}
                ariaLabel="14-day project activity chart"
                caption="Only events recorded for this project (not the whole workspace)."
              />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="enterprise-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
                Recently opened
              </h2>
              <p className="mt-1 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                Last open time is shared for the project (any teammate)
              </p>
            </div>
            <Link
              href={`/projects/${projectId}/files`}
              className="shrink-0 text-[12px] font-semibold text-[var(--enterprise-primary)] transition hover:text-[var(--enterprise-primary-deep)] hover:underline"
            >
              View all
            </Link>
          </div>
          {continueFile ? (
            <button
              type="button"
              onClick={() => openFile(continueFile)}
              className="mt-4 flex w-full items-center gap-3 rounded-xl border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] px-4 py-3 text-left transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/35"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] shadow-sm">
                <Play className="h-5 w-5" fill="currentColor" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-semantic-info-text)]">
                  Continue viewing
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--enterprise-text)]">
                  {continueFile.name}
                </span>
              </span>
              <span className="shrink-0 text-xs text-[var(--enterprise-text-muted)]">
                {continueFile.lastOpenedAt ? relativeTime(continueFile.lastOpenedAt, nowMs) : ""}
              </span>
            </button>
          ) : null}
          {recentFiles.length > 0 ? (
            <ul
              className={`divide-y divide-[var(--enterprise-border)] ${continueFile ? "mt-3" : "mt-4"}`}
            >
              {recentFiles.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => openFile(f)}
                    aria-label={`Open ${f.name} in viewer`}
                    className="flex w-full cursor-pointer items-center gap-3 py-3 text-left transition first:pt-0 last:pb-0 hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/25"
                  >
                    {isPdfFile(f) ? (
                      <PdfFileIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <FileText
                        className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                        aria-hidden
                      />
                    )}
                    <span className="flex-1 truncate text-sm font-medium text-[var(--enterprise-text)]">
                      {f.name}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--enterprise-sidebar-muted)]">
                      {fileActivityLabel(f, nowMs) ?? "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 flex flex-col items-center py-6 text-center">
              <FileText
                className="h-10 w-10 text-[var(--enterprise-sidebar-muted)]"
                strokeWidth={1.25}
                aria-hidden
              />
              <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
                No files uploaded yet.
              </p>
              <Link
                href={`/projects/${projectId}/files`}
                className="mt-4 text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
              >
                Go to Files &amp; Drawings
              </Link>
            </div>
          )}
        </section>

        <section className="enterprise-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
                Recent punch items
              </h2>
              <p className="mt-1 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                Latest updates on the punch list
              </p>
            </div>
            <Link
              href={`/projects/${projectId}/punch`}
              className="shrink-0 text-[12px] font-semibold text-[var(--enterprise-primary)] transition hover:text-[var(--enterprise-primary-deep)] hover:underline"
            >
              View all
            </Link>
          </div>
          {recentIssues.length > 0 ? (
            <ul className="mt-4 divide-y divide-[var(--enterprise-border)]">
              {recentIssues.map((issue) => {
                const statusColor =
                  issue.status === "OPEN"
                    ? "bg-[var(--enterprise-error)]"
                    : issue.status === "IN_PROGRESS"
                      ? "bg-amber-400"
                      : "bg-[var(--enterprise-success)]";
                const statusLabel =
                  issue.status === "OPEN"
                    ? "Open"
                    : issue.status === "IN_PROGRESS"
                      ? "In Progress"
                      : "Resolved";
                return (
                  <li key={issue.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`} />
                    <span className="flex-1 truncate text-sm text-[var(--enterprise-text)]">
                      {issue.location}
                    </span>
                    <span className="truncate text-xs text-[var(--enterprise-sidebar-muted)]">
                      {issue.trade}
                    </span>
                    <span className="shrink-0 rounded-md bg-[var(--enterprise-bg)] px-2 py-0.5 text-xs font-medium text-[var(--enterprise-text-muted)]">
                      {statusLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-6 flex flex-col items-center py-6 text-center">
              <ClipboardCheck
                className="h-8 w-8 text-[var(--enterprise-sidebar-muted)]"
                strokeWidth={1.25}
              />
              <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
                No punch items yet.
              </p>
              <Link
                href={`/projects/${projectId}/punch`}
                className="mt-4 text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
              >
                Open punch list
              </Link>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <section className="enterprise-card p-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-[var(--enterprise-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Progress</h3>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[var(--enterprise-text)]">
            {progress}%
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--enterprise-border)]">
            <div
              className="h-full rounded-full bg-[var(--enterprise-primary)]"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </section>
        <section className="enterprise-card p-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[var(--enterprise-error)]" />
            <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Issue risk</h3>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[var(--enterprise-text)]">
            {highPriorityIssues}
          </p>
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
            High-priority issues need attention.
          </p>
        </section>
        <section className="enterprise-card p-5">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Project assets</h3>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[var(--enterprise-text)]">
            {folderCount}
          </p>
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
            Folders organizing project drawings and files.
          </p>
        </section>
      </div>
    </div>
  );
}
