"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Circle,
  FileStack,
  Flag,
  HardDrive,
  Heart,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { DashboardActivityChart } from "@/components/enterprise/DashboardActivityChart";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { WorkspaceUsageMeter, formatGiB } from "@/components/enterprise/WorkspaceUsageMeters";
import {
  createWorkspace,
  fetchDashboard,
  fetchMe,
  fetchProjects,
  fetchWorkspaceMembers,
} from "@/lib/api-client";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { computeWorkspaceHealthScore } from "@/lib/dashboardHealth";
import { qk } from "@/lib/queryKeys";

export function DashboardClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [workspaceName, setWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [createWorkspaceError, setCreateWorkspaceError] = useState<string | null>(null);
  const {
    data: me,
    isPending: meLoading,
    error: meError,
    isError: meFetchFailed,
  } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
  });

  const wid = me?.workspaces[0]?.workspaceId;
  const ws = me?.workspaces[0]?.workspace;

  const { data: dash, isPending: dashPending } = useQuery({
    queryKey: qk.dashboard(wid ?? ""),
    queryFn: () => fetchDashboard(wid!),
    enabled: Boolean(wid),
  });

  const membership = me?.workspaces?.[0];
  const isAdmin = membership?.role === "ADMIN" || membership?.role === "SUPER_ADMIN";

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(
      wid && isWorkspaceProClient(me?.workspaces?.[0]?.workspace.subscriptionStatus),
    ),
  });

  const { data: membersData } = useQuery({
    queryKey: qk.workspaceMembers(wid ?? ""),
    queryFn: () => fetchWorkspaceMembers(wid!),
    enabled: Boolean(wid && isAdmin),
  });

  const loading = meLoading || (Boolean(wid) && dashPending);

  if (loading) {
    return (
      <EnterpriseLoadingState message="Loading dashboard…" label="Loading workspace dashboard" />
    );
  }

  if (meFetchFailed && meError) {
    return (
      <div className="enterprise-alert-danger p-6 text-sm">
        {meError instanceof Error ? meError.message : "Failed to load"}
        <p className="enterprise-alert-danger-muted mt-2 text-xs">
          Ensure the API is running (
          <code className="rounded bg-[var(--enterprise-semantic-danger-border)]/40 px-1">
            npm run dev:backend
          </code>{" "}
          from the repo root) and{" "}
          <code className="rounded bg-[var(--enterprise-semantic-danger-border)]/40 px-1">
            DATABASE_URL
          </code>{" "}
          is set.
        </p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="enterprise-card p-8 text-center">
        <p className="text-[var(--enterprise-text)]">
          Sign in to view your cloud workspace dashboard.
        </p>
        <Link
          href="/sign-in?next=/dashboard"
          className="mt-4 inline-flex rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const hasWorkspace = (me.workspaces?.length ?? 0) > 0;

  function makeWorkspaceSlug(raw: string): string {
    const base = raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const fallback = `workspace-${Math.random().toString(36).slice(2, 8)}`;
    return (base || fallback).slice(0, 48);
  }

  async function onCreateWorkspace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = workspaceName.trim();
    if (!name || creatingWorkspace) return;
    setCreatingWorkspace(true);
    setCreateWorkspaceError(null);
    try {
      await createWorkspace(name, makeWorkspaceSlug(name));
      await queryClient.invalidateQueries({ queryKey: qk.me() });
      router.push("/projects");
    } catch (err) {
      setCreateWorkspaceError(err instanceof Error ? err.message : "Could not create workspace.");
    } finally {
      setCreatingWorkspace(false);
    }
  }

  if (!hasWorkspace) {
    return (
      <div className="enterprise-animate-in space-y-6">
        <section className="enterprise-card max-w-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--enterprise-text)]">
            Create your workspace
          </h1>
          <p className="mt-2 text-[14px] text-[var(--enterprise-text-muted)]">
            New accounts need a workspace first. After this step, you can add your first project.
          </p>
          <form onSubmit={onCreateWorkspace} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="workspace-name"
                className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]"
              >
                Workspace name
              </label>
              <input
                id="workspace-name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
                placeholder="Acme Construction"
                required
              />
            </div>
            {createWorkspaceError ? (
              <p className="enterprise-alert-danger px-3 py-2 text-sm">{createWorkspaceError}</p>
            ) : null}
            <button
              type="submit"
              disabled={creatingWorkspace}
              className="inline-flex rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--enterprise-primary-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingWorkspace ? "Creating..." : "Create workspace"}
            </button>
          </form>
          <p className="mt-4 text-xs text-[var(--enterprise-text-muted)]">
            You will be redirected to <strong>Projects</strong> to add your first project.
          </p>
        </section>
      </div>
    );
  }

  const firstName = me.user.name?.split(/\s+/)[0] ?? me.user.email?.split("@")[0] ?? "there";
  const issueTotal = dash?.issuesByStatus?.reduce((a, x) => a + (x._count ?? 0), 0) ?? 0;
  const openIssues =
    dash?.issuesByStatus
      ?.filter((x) => x.status === "OPEN" || x.status === "IN_PROGRESS")
      .reduce((a, x) => a + x._count, 0) ?? 0;
  const closedIssues =
    dash?.issuesByStatus
      ?.filter((x) => x.status === "CLOSED" || x.status === "RESOLVED")
      .reduce((a, x) => a + x._count, 0) ?? 0;

  const projectCount = dash?.projectCount ?? 0;
  const fileCount = dash?.fileCount ?? projects.reduce((acc, p) => acc + p.files.length, 0);
  const memberCount = dash?.memberCount ?? 1;
  const storageUsed = dash?.workspace ? Number(dash.workspace.storageUsedBytes) : 0;
  const storageQuota = dash?.workspace ? Number(dash.workspace.storageQuotaBytes) : 1;
  const storagePct =
    storageQuota > 0 ? Math.min(100, Math.round((storageUsed / storageQuota) * 100)) : 0;

  const healthScore = computeWorkspaceHealthScore(dash);
  const activitySeries = dash?.activityLast14Days ?? [];
  const last7Total = activitySeries.slice(-7).reduce((a, x) => a + x.count, 0);
  const prev7Total = activitySeries.slice(-14, -7).reduce((a, x) => a + x.count, 0);
  const momentum =
    prev7Total > 0
      ? Math.round(((last7Total - prev7Total) / prev7Total) * 100)
      : last7Total > 0
        ? 100
        : 0;

  const sub = dash?.workspace?.subscriptionStatus ?? ws?.subscriptionStatus ?? null;
  const maxProjects = membership?.maxProjects ?? 5;
  const isPro = isWorkspaceProClient(sub);
  const projectCountForUsage =
    membership?.projectCount !== undefined ? membership.projectCount : isPro ? projects.length : 0;
  const projectUsagePct =
    maxProjects > 0 ? Math.min(100, (projectCountForUsage / maxProjects) * 100) : 0;
  const maxSeats = membersData?.maxSeats ?? 5;
  const seatPressure = membersData?.seatPressure ?? 0;
  const seatUsagePct = maxSeats > 0 ? Math.min(100, (seatPressure / maxSeats) * 100) : 0;
  const storageUsageBarPct =
    storageQuota > 0 ? Math.min(100, (storageUsed / storageQuota) * 100) : 0;

  const checklist: { id: string; label: string; done: boolean }[] = [
    { id: "1", label: "Create account", done: true },
    { id: "2", label: "Create workspace", done: hasWorkspace },
    { id: "3", label: "Upload first drawing", done: fileCount > 0 },
    { id: "4", label: "Invite a team member", done: memberCount > 1 },
    { id: "5", label: "Track your first issue", done: issueTotal > 0 },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const progressPct = (doneCount / checklist.length) * 100;

  const firstProject = projects[0];

  return (
    <div className="enterprise-animate-in space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-gradient-to-br from-[var(--enterprise-surface)] via-white to-blue-50/40 p-6 shadow-[var(--enterprise-shadow-card)] sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--enterprise-primary)]/8 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--enterprise-text-muted)]">
              Workspace
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--enterprise-text)] sm:text-[28px]">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--enterprise-subtitle)]">
              {dash?.workspace?.name ? (
                <>
                  <span className="font-medium text-[var(--enterprise-text)]">
                    {dash.workspace.name}
                  </span>
                  {" · "}
                </>
              ) : null}
              Track uploads, issues, and team momentum in one place.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {sub === "active" ? (
                <span className="enterprise-badge-success px-3 py-1 text-[12px] font-semibold">
                  Pro active
                </span>
              ) : sub === "trialing" ? (
                <span className="enterprise-badge-warning px-3 py-1 text-[12px] font-semibold">
                  Trial
                </span>
              ) : (
                <span className="enterprise-badge-neutral px-3 py-1 text-[12px] font-semibold">
                  Free
                </span>
              )}
              <Link
                href="/organization"
                className="inline-flex items-center rounded-full border border-[var(--enterprise-border)] bg-white/80 px-3 py-1 text-[12px] font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35"
              >
                Billing & plan
              </Link>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row lg:flex-col">
            <div className="enterprise-card flex min-w-[200px] items-center gap-4 px-5 py-4">
              <div
                className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-blue-600/5 ring-1 ring-blue-500/20"
                aria-hidden
              >
                <Heart className="h-7 w-7 text-[var(--enterprise-primary)]" strokeWidth={1.75} />
                <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold tabular-nums text-[var(--enterprise-text)] shadow-sm ring-1 ring-[var(--enterprise-border)]">
                  {healthScore}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                  Health score
                </p>
                <p className="mt-0.5 text-sm text-[var(--enterprise-text-muted)]">
                  From issues, storage &amp; activity trend
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-[13px] text-emerald-900">
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} />
              <span>
                <strong className="font-semibold">
                  {momentum >= 0 ? "+" : ""}
                  {momentum}%
                </strong>
                <span className="text-emerald-800/90"> vs prior week</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Projects",
            value: String(projectCount),
            hint: hasWorkspace ? "Active in workspace" : "Create via API or UI",
            icon: FileStack,
            tone: "text-[var(--enterprise-primary)]",
          },
          {
            label: "Cloud PDFs",
            value: String(fileCount),
            hint: "Files in cloud storage",
            icon: FileStack,
            tone: "text-blue-600",
          },
          {
            label: "Open issues",
            value: String(openIssues),
            hint: `${closedIssues} resolved · ${issueTotal} total`,
            icon: Flag,
            tone: openIssues === 0 ? "text-emerald-600" : "text-amber-700",
          },
          {
            label: "Storage",
            value: `${(storageUsed / 1024 ** 3).toFixed(2)} GB`,
            hint: `${storagePct}% of ${(storageQuota / 1024 ** 3).toFixed(0)} GB`,
            icon: HardDrive,
            tone: storagePct > 85 ? "text-red-600" : "text-[var(--enterprise-text)]",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="enterprise-card enterprise-card-hover flex gap-4 p-5 transition duration-200 hover:-translate-y-0.5"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-bg)] ${k.tone}`}
            >
              <k.icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--enterprise-text-muted)]">
                {k.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--enterprise-text)]">
                {k.value}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                {k.hint}
              </p>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && hasWorkspace && wid ? (
        <section className="enterprise-card p-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Workspace usage
          </h2>
          <p className="mt-1 text-[13px] text-[var(--enterprise-text-muted)]">
            Storage, seats, and project limits for your plan.
          </p>
          <div className="mt-4 max-w-md">
            <WorkspaceUsageMeter
              label="Storage"
              usedLabel={`${formatGiB(storageUsed)} / ${formatGiB(storageQuota)} GB`}
              pct={storageUsageBarPct}
              warn={storageUsageBarPct >= 85}
            />
            <WorkspaceUsageMeter
              label="Members"
              usedLabel={`${seatPressure} / ${maxSeats}`}
              pct={seatUsagePct}
              warn={seatUsagePct >= 90}
            />
            <WorkspaceUsageMeter
              label="Projects"
              usedLabel={`${projectCountForUsage} / ${maxProjects}`}
              pct={projectUsagePct}
              warn={projectCountForUsage >= maxProjects}
            />
          </div>
        </section>
      ) : null}

      {/* Chart + team snapshot */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="enterprise-card xl:col-span-2 overflow-hidden p-0">
          <div className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-6 py-4">
            <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
              Project health &amp; momentum
            </h2>
            <p className="mt-1 text-[13px] text-[var(--enterprise-text-muted)]">
              Daily workspace events (uploads, issues, invites) with a 7-day rolling average —
              higher sustained activity usually means healthier delivery cadence.
            </p>
          </div>
          <div className="p-6 pt-4">
            <DashboardActivityChart data={activitySeries} />
            <div className="mt-4 flex flex-wrap gap-6 border-t border-[var(--enterprise-border)]/80 pt-4 text-[13px] text-[var(--enterprise-text-muted)]">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                Last 7 days:{" "}
                <strong className="font-semibold text-[var(--enterprise-text)]">
                  {last7Total}
                </strong>{" "}
                events
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--enterprise-primary)]" strokeWidth={1.75} />
                <strong className="font-semibold text-[var(--enterprise-text)]">
                  {memberCount}
                </strong>{" "}
                seats in use
              </span>
            </div>
          </div>
        </section>

        <section className="enterprise-card flex flex-col p-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Quick actions
          </h2>
          <ul className="mt-4 flex flex-1 flex-col gap-2">
            <li>
              <Link
                href="/projects"
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)]"
              >
                <span className="flex items-center gap-2">
                  <FileStack
                    className="h-4 w-4 text-[var(--enterprise-primary)]"
                    strokeWidth={1.75}
                  />
                  New project
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-50" />
              </Link>
            </li>
            <li>
              <Link
                href="/projects"
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)]"
              >
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-[var(--enterprise-primary)]" strokeWidth={1.75} />
                  Upload PDF
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-50" />
              </Link>
            </li>
            <li>
              <Link
                href="/organization?tab=people"
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-hover-surface)]"
              >
                <span className="flex items-center gap-2">
                  <UserPlus
                    className="h-4 w-4 text-[var(--enterprise-primary)]"
                    strokeWidth={1.75}
                  />
                  Invite team
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-50" />
              </Link>
            </li>
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="enterprise-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Getting started
            </h2>
            <span className="text-[13px] font-medium text-[var(--enterprise-text-muted)]">
              {doneCount} of {checklist.length}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[var(--enterprise-primary)] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <ul className="mt-5 space-y-3">
            {checklist.map((row) => (
              <li key={row.id} className="flex items-center gap-3 text-sm">
                {row.done ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--enterprise-semantic-success-bg)] text-[var(--enterprise-semantic-success-text)]">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-300">
                    <Circle className="h-4 w-4" />
                  </span>
                )}
                <span
                  className={
                    row.done
                      ? "text-[var(--enterprise-text-muted)] line-through"
                      : "font-medium text-[var(--enterprise-text)]"
                  }
                >
                  {row.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Your projects
          </h2>
          {firstProject ? (
            <Link
              href="/projects"
              className="enterprise-card enterprise-card-hover mt-3 block p-5 transition hover:border-[var(--enterprise-primary)]/35"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
                  <FileStack className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--enterprise-text)]">{firstProject.name}</p>
                  <p className="mt-0.5 text-[13px] text-[var(--enterprise-text-muted)]">
                    {firstProject.files.length} files · {issueTotal} issues
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]" />
              </div>
            </Link>
          ) : (
            <div className="enterprise-card mt-3 border-2 border-dashed border-[var(--enterprise-border-muted)] px-6 py-10 text-center">
              <FileStack
                className="mx-auto h-10 w-10 text-[var(--enterprise-primary)] opacity-80"
                strokeWidth={1.25}
              />
              <p className="mt-3 font-semibold text-[var(--enterprise-text)]">No projects yet</p>
              <p className="mt-1 text-[14px] text-[var(--enterprise-text-muted)]">
                Create a project to organize drawings and uploads.
              </p>
              <Link
                href="/projects"
                className="mt-5 inline-flex rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--enterprise-primary-deep)]"
              >
                Go to Projects
              </Link>
            </div>
          )}
        </section>
      </div>

      <section className="enterprise-card p-6 sm:max-w-md">
        <h2 className="text-[13px] font-semibold text-[var(--enterprise-text)]">Shortcuts</h2>
        <ul className="mt-4 space-y-2">
          <li>
            <Link
              href="/projects"
              className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2.5 text-sm text-[var(--enterprise-text-muted)] transition hover:border-[var(--enterprise-border)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
            >
              <span className="flex items-center gap-2">
                <FileStack
                  className="h-4 w-4 text-[var(--enterprise-primary)]"
                  strokeWidth={1.75}
                />
                Projects &amp; uploads
              </span>
              <ArrowUpRight className="h-4 w-4 opacity-50" />
            </Link>
          </li>
          <li>
            <Link
              href="/account"
              className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2.5 text-sm text-[var(--enterprise-text-muted)] transition hover:border-[var(--enterprise-border)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
            >
              Account settings
              <ArrowUpRight className="h-4 w-4 opacity-50" />
            </Link>
          </li>
          <li>
            <Link
              href="/organization"
              className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2.5 text-sm text-[var(--enterprise-text-muted)] transition hover:border-[var(--enterprise-border)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
            >
              Organization
              <ArrowUpRight className="h-4 w-4 opacity-50" />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
