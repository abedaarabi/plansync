"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  Gauge,
  MessageSquareQuote,
  Target,
} from "lucide-react";
import {
  fetchProjects,
  fetchIssuesForProject,
  fetchProjectRfis,
  fetchProjectPunch,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import type { CloudFile } from "@/types/projects";
import { isPdfFile } from "@/lib/isPdfFile";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { ProjectLogo } from "./ProjectLogo";
import { useTickNowMs } from "@/lib/useTickNowMs";

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

type Props = {
  projectId: string;
};

export function ProjectDashboardClient({ projectId }: Props) {
  const router = useRouter();
  const nowMs = useTickNowMs();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = primary?.workspace.subscriptionStatus === "active";

  const { data: projects = [], isPending: projPending } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const project = projects.find((p) => p.id === projectId);

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

  const loading = ctxLoading || projPending;

  if (loading) {
    return <EnterpriseLoadingState message="Loading project…" label="Loading project overview" />;
  }

  if (!project) {
    return (
      <div
        className="border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]"
        style={{ borderRadius: "12px" }}
      >
        Project not found.{" "}
        <Link href="/projects" className="text-[#2563EB] hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const openRfis = rfis.filter((r) => r.status === "OPEN" || r.status === "open").length;
  const openIssues = issues.filter((i) => i.status !== "closed" && i.status !== "CLOSED").length;
  const highPriorityIssues = issues.filter((i) => i.priority?.toLowerCase() === "high").length;
  const overdueIssues = issues.filter((i) => {
    if (!i.dueDate) return false;
    return new Date(i.dueDate).getTime() < nowMs && i.status.toLowerCase() !== "closed";
  }).length;
  const fileCount = project.files.length;
  const folderCount = project.folders.length;
  const progress = typeof project.progressPercent === "number" ? project.progressPercent : 0;

  const stats: {
    label: string;
    value: number;
    icon: LucideIcon;
    bg: string;
    color: string;
    href: string;
  }[] = [
    {
      label: "Issues Open",
      value: openIssues,
      icon: AlertCircle,
      bg: "bg-red-50",
      color: "text-red-500",
      href: `/projects/${projectId}/issues`,
    },
    {
      label: "Overdue Issues",
      value: overdueIssues,
      icon: Clock3,
      bg: "bg-orange-50",
      color: "text-orange-500",
      href: `/projects/${projectId}/issues`,
    },
    {
      label: "Files & Drawings",
      value: fileCount,
      icon: FileText,
      bg: "bg-blue-50",
      color: "text-[#2563EB]",
      href: `/projects/${projectId}/files`,
    },
    {
      label: "Open RFIs",
      value: openRfis,
      icon: MessageSquareQuote,
      bg: "bg-amber-50",
      color: "text-amber-500",
      href: `/projects/${projectId}/rfi`,
    },
  ];

  const recentFiles = [...project.files]
    .sort((a, b) => {
      const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bDate - aDate;
    })
    .slice(0, 5);

  const recentIssues = [...punchItems]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="enterprise-animate-in space-y-8">
      <div className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-sm)] sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <ProjectLogo name={project.name} logoUrl={project.logoUrl} size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">{project.name}</h1>
            {(project.projectNumber?.trim() || project.location?.trim()) && (
              <p className="mt-1 text-[13px] text-[#64748B]">
                {[
                  project.projectNumber?.trim() && `#${project.projectNumber.trim()}`,
                  project.location?.trim(),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Stage
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--enterprise-text)]">
              {project.stage ?? "Not set"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Start date
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--enterprise-text)]">
              {formatDateLabel(project.startDate)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              End date
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--enterprise-text)]">
              {formatDateLabel(project.endDate)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Location
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--enterprise-text)]">
              {project.location?.trim() || "Not set"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group border border-[#E2E8F0] bg-white outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2563EB]/25 hover:shadow-[0_8px_24px_-8px_rgba(12,18,34,0.12)] focus-visible:ring-2 focus-visible:ring-[#2563EB]/35"
            style={{
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-[1.02] ${s.bg} ${s.color}`}
                >
                  <s.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-[28px] font-bold tabular-nums leading-none text-[#0F172A]">
                    {s.value}
                  </p>
                  <p className="mt-1.5 text-[13px] text-[#64748B]">{s.label}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className="border border-[#E2E8F0] bg-white p-6"
          style={{
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Recent Files
            </h2>
            <Link
              href={`/projects/${projectId}/files`}
              className="shrink-0 text-[12px] font-semibold text-[#2563EB] transition hover:text-[#1d4ed8] hover:underline"
            >
              View all
            </Link>
          </div>
          {recentFiles.length > 0 ? (
            <ul className="mt-4 divide-y divide-[#E2E8F0]">
              {recentFiles.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => openFile(f)}
                    aria-label={`Open ${f.name} in viewer`}
                    className="flex w-full cursor-pointer items-center gap-3 py-3 text-left transition first:pt-0 last:pb-0 hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/25"
                  >
                    {isPdfFile(f) ? (
                      <PdfFileIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
                    )}
                    <span className="flex-1 truncate text-sm font-medium text-[#0F172A]">
                      {f.name}
                    </span>
                    <span className="shrink-0 text-xs text-[#94A3B8]">
                      {f.updatedAt ? relativeTime(f.updatedAt, nowMs) : "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 flex flex-col items-center py-6 text-center">
              <FileText className="h-10 w-10 text-[#94A3B8]" strokeWidth={1.25} aria-hidden />
              <p className="mt-2 text-sm text-[#64748B]">No files uploaded yet.</p>
              <Link
                href={`/projects/${projectId}/files`}
                className="mt-4 text-sm font-semibold text-[#2563EB] hover:underline"
              >
                Go to Files &amp; Drawings
              </Link>
            </div>
          )}
        </section>

        <section
          className="border border-[#E2E8F0] bg-white p-6"
          style={{
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Recent punch items
            </h2>
            <Link
              href={`/projects/${projectId}/punch`}
              className="shrink-0 text-[12px] font-semibold text-[#2563EB] transition hover:text-[#1d4ed8] hover:underline"
            >
              View all
            </Link>
          </div>
          {recentIssues.length > 0 ? (
            <ul className="mt-4 divide-y divide-[#E2E8F0]">
              {recentIssues.map((issue) => {
                const statusColor =
                  issue.status === "OPEN"
                    ? "bg-[#EF4444]"
                    : issue.status === "IN_PROGRESS"
                      ? "bg-amber-400"
                      : "bg-[#10B981]";
                const statusLabel =
                  issue.status === "OPEN"
                    ? "Open"
                    : issue.status === "IN_PROGRESS"
                      ? "In Progress"
                      : "Resolved";
                return (
                  <li key={issue.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`} />
                    <span className="flex-1 truncate text-sm text-[#0F172A]">{issue.location}</span>
                    <span className="truncate text-xs text-[#94A3B8]">{issue.trade}</span>
                    <span
                      className="shrink-0 rounded-md bg-[#F8FAFC] px-2 py-0.5 text-xs font-medium text-[#64748B]"
                      style={{ borderRadius: "6px" }}
                    >
                      {statusLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-6 flex flex-col items-center py-6 text-center">
              <ClipboardCheck className="h-8 w-8 text-[#94A3B8]" strokeWidth={1.25} />
              <p className="mt-2 text-sm text-[#64748B]">No punch items yet.</p>
              <Link
                href={`/projects/${projectId}/punch`}
                className="mt-4 text-sm font-semibold text-[#2563EB] hover:underline"
              >
                Open punch list
              </Link>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-[#2563EB]" />
            <h3 className="text-sm font-semibold text-[#0F172A]">Progress</h3>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#0F172A]">{progress}%</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
            <div
              className="h-full rounded-full bg-[#2563EB]"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </section>
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-[#0F172A]">Issue Risk</h3>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#0F172A]">
            {highPriorityIssues}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">High-priority issues need attention.</p>
        </section>
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-[#0F172A]">Project Assets</h3>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#0F172A]">{folderCount}</p>
          <p className="mt-1 text-xs text-[#64748B]">Folders organizing project drawings/files.</p>
        </section>
      </div>
    </div>
  );
}
