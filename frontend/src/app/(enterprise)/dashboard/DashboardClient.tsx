"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
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
import {
  EnterpriseButton,
  enterpriseButtonClassName,
} from "@/components/enterprise/EnterpriseButton";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import { EnterpriseInput } from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { WorkspaceUsageMeter, formatGiB } from "@/components/enterprise/WorkspaceUsageMeters";
import {
  createWorkspace,
  fetchDashboard,
  fetchProjects,
  fetchWorkspaceMembers,
} from "@/lib/api-client";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { isSuperAdmin } from "@/lib/workspaceRole";
import { computeWorkspaceHealthScore } from "@/lib/dashboardHealth";
import { qk } from "@/lib/queryKeys";
import { useTranslations } from "next-intl";

// fallow-ignore-next-line complexity
export function DashboardClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const td = useTranslations("app.pages.dashboard");
  const tc = useTranslations("app.pages.common");
  const workspaceSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, "Enter a workspace name."),
      }),
    [],
  );
  type WorkspaceValues = z.infer<typeof workspaceSchema>;
  const workspaceForm = useEnterpriseForm(workspaceSchema, { name: "" });
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [createWorkspaceError, setCreateWorkspaceError] = useState<string | null>(null);
  const {
    me,
    loading: meLoading,
    isError: meFetchFailed,
    meError,
    primary,
  } = useEnterpriseWorkspace();

  const wid = primary?.workspaceId;
  const ws = primary?.workspace;

  const { data: dash, isPending: dashPending } = useQuery({
    queryKey: qk.dashboard(wid ?? ""),
    queryFn: () => fetchDashboard(wid!),
    enabled: Boolean(wid),
  });

  const membership = primary;
  const isAdmin = membership?.role === "ADMIN" || membership?.role === "SUPER_ADMIN";

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isWorkspaceProClient(primary?.workspace)),
  });

  const { data: membersData } = useQuery({
    queryKey: qk.workspaceMembers(wid ?? ""),
    queryFn: () => fetchWorkspaceMembers(wid!),
    enabled: Boolean(wid && isAdmin),
  });

  const loading = meLoading || (Boolean(wid) && dashPending);

  if (loading) {
    return (
      <EnterpriseLoadingState message={tc("loadingDashboard")} label={tc("loadingDashboardAria")} />
    );
  }

  if (meFetchFailed && meError) {
    return (
      <div className="enterprise-alert-danger p-6 text-sm">
        {meError instanceof Error ? meError.message : tc("failedToLoad")}
        <p className="enterprise-alert-danger-muted mt-2 text-xs">
          {td("devHintApi")}
          <code className="rounded bg-[var(--enterprise-semantic-danger-border)]/40 px-1">
            npm run dev:backend
          </code>{" "}
          {td("devHintFromRoot")}{" "}
          <code className="rounded bg-[var(--enterprise-semantic-danger-border)]/40 px-1">
            DATABASE_URL
          </code>{" "}
          {td("devHintDb")}
        </p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="enterprise-card px-4 py-8 text-center">
        <p className="text-sm font-semibold text-[var(--enterprise-text)]">{td("signInPrompt")}</p>
        <Link
          href="/sign-in?next=/dashboard"
          className={enterpriseButtonClassName({
            variant: "primary",
            size: "md",
            className: "mt-3",
          })}
        >
          {td("signInCta")}
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

  async function onCreateWorkspace({ name }: WorkspaceValues) {
    if (creatingWorkspace) return;
    const trimmed = name.trim();
    setCreatingWorkspace(true);
    setCreateWorkspaceError(null);
    try {
      await createWorkspace(trimmed, makeWorkspaceSlug(trimmed));
      await queryClient.invalidateQueries({ queryKey: qk.me() });
      router.push("/projects");
    } catch (err) {
      setCreateWorkspaceError(err instanceof Error ? err.message : td("couldNotCreateWorkspace"));
    } finally {
      setCreatingWorkspace(false);
    }
  }

  if (!hasWorkspace) {
    return (
      <div className="mobile-app-page enterprise-animate-in w-full min-w-0 max-w-full">
        <section className="enterprise-card max-w-lg p-4 sm:p-5">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--enterprise-text)]">
            {td("createWorkspaceTitle")}
          </h1>
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)] sm:text-sm">
            {td("createWorkspaceBody")}
          </p>
          <EnterpriseForm
            form={workspaceForm}
            onSubmit={onCreateWorkspace}
            className="mt-4 space-y-3"
          >
            <EnterpriseFormField<WorkspaceValues>
              name="name"
              label={td("workspaceNameLabel")}
              required
            >
              {({ describedBy, field, id, invalid }) => (
                <EnterpriseInput
                  {...field}
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder={td("workspaceNamePlaceholder")}
                />
              )}
            </EnterpriseFormField>
            {createWorkspaceError ? (
              <p className="enterprise-alert-danger rounded-md px-3 py-2 text-sm">
                {createWorkspaceError}
              </p>
            ) : null}
            <EnterpriseButton type="submit" size="md" loading={creatingWorkspace}>
              {creatingWorkspace ? td("creating") : td("createWorkspaceCta")}
            </EnterpriseButton>
          </EnterpriseForm>
          <p className="mt-3 text-xs text-[var(--enterprise-text-muted)]">
            {td("redirectPrefix")}
            <strong className="text-[var(--enterprise-text)]">{td("redirectEmphasis")}</strong>
            {td("redirectSuffix")}
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

  const maxProjects = membership?.maxProjects;
  const isPro = isWorkspaceProClient(ws);
  const sub = dash?.workspace?.subscriptionStatus ?? ws?.subscriptionStatus ?? null;
  const projectCountForUsage =
    membership?.projectCount !== undefined ? membership.projectCount : isPro ? projects.length : 0;
  const projectUsagePct =
    maxProjects != null && maxProjects > 0
      ? Math.min(100, (projectCountForUsage / maxProjects) * 100)
      : 0;
  const includedSeats = membersData?.includedSeats ?? 5;
  const extraSeatUsd = membersData?.extraSeatMonthlyUsd ?? 15;
  const seatPressure = membersData?.seatPressure ?? 0;
  const seatDenominator = Math.max(includedSeats, 1);
  const seatUsagePct = Math.min(100, (seatPressure / seatDenominator) * 100);
  const extraSeatCount = Math.max(0, seatPressure - includedSeats);
  const storageUsageBarPct =
    storageQuota > 0 ? Math.min(100, (storageUsed / storageQuota) * 100) : 0;

  const checklist: { id: string; label: string; done: boolean }[] = [
    { id: "1", label: td("checklistCreateAccount"), done: true },
    { id: "2", label: td("checklistCreateWorkspace"), done: hasWorkspace },
    { id: "3", label: td("checklistUploadDrawing"), done: fileCount > 0 },
    { id: "4", label: td("checklistInviteTeam"), done: memberCount > 1 },
    { id: "5", label: td("checklistTrackIssue"), done: issueTotal > 0 },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const progressPct = (doneCount / checklist.length) * 100;

  const firstProject = projects[0];

  const kpiRows = [
    {
      key: "projects",
      label: td("kpiProjects"),
      value: String(projectCount),
      hint: hasWorkspace ? td("kpiProjectsHint1") : td("kpiProjectsHint2"),
      icon: FileStack,
      tone: "text-[var(--enterprise-primary)]",
    },
    {
      key: "pdfs",
      label: td("kpiCloudPdfs"),
      value: String(fileCount),
      hint: td("kpiCloudPdfsHint"),
      icon: FileStack,
      tone: "text-blue-600",
    },
    {
      key: "issues",
      label: td("kpiOpenIssues"),
      value: String(openIssues),
      hint: td("kpiOpenIssuesHint", { closed: closedIssues, total: issueTotal }),
      icon: Flag,
      tone: openIssues === 0 ? "text-emerald-600" : "text-amber-700",
    },
    {
      key: "storage",
      label: td("kpiStorage"),
      value: `${(storageUsed / 1024 ** 3).toFixed(2)} GB`,
      hint: td("kpiStorageHint", {
        pct: storagePct,
        quota: (storageQuota / 1024 ** 3).toFixed(0),
      }),
      icon: HardDrive,
      tone: storagePct > 85 ? "text-red-600" : "text-[var(--enterprise-text)]",
    },
  ];

  const actionLinkClass =
    "flex min-h-10 items-center justify-between gap-2 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]";

  return (
    <div className="mobile-app-page enterprise-animate-in w-full min-w-0 max-w-full space-y-4">
      <header className="flex flex-col gap-3 border-b border-[var(--enterprise-border)] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
            {dash?.workspace?.name ?? td("workspaceEyebrow")}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-2xl">
            {td("welcomeBack", { name: firstName })}
          </h1>
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)] sm:text-sm">
            {td("heroSubtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sub === "active" ? (
            <span className="enterprise-badge-success rounded px-2 py-0.5 text-[11px] font-semibold">
              {td("subActive")}
            </span>
          ) : sub === "trialing" && isPro ? (
            <span className="enterprise-badge-warning rounded px-2 py-0.5 text-[11px] font-semibold">
              {td("subTrial")}
            </span>
          ) : sub === "trialing" && !isPro ? (
            <span className="enterprise-badge-neutral rounded px-2 py-0.5 text-[11px] font-semibold">
              {td("subTrialEnded")}
            </span>
          ) : (
            <span className="enterprise-badge-neutral rounded px-2 py-0.5 text-[11px] font-semibold">
              {td("subFree")}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 py-1 text-xs font-medium text-[var(--enterprise-text)]">
            <Heart className="h-3.5 w-3.5 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
            {td("healthScore")}{" "}
            <strong className="tabular-nums text-[var(--enterprise-text)]">{healthScore}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-semantic-success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--enterprise-semantic-success-text)]">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
            {momentum >= 0 ? "+" : ""}
            {momentum}%
          </span>
          {isSuperAdmin(membership?.role) ? (
            <Link
              href="/organization?tab=billing"
              className="text-xs font-medium text-[var(--enterprise-text-muted)] underline-offset-2 hover:text-[var(--enterprise-text)] hover:underline"
            >
              {td("billingAndPlan")}
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {kpiRows.map((k) => (
          <div key={k.key} className="enterprise-card flex gap-3 p-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-hover-surface)] ${k.tone}`}
            >
              <k.icon className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[var(--enterprise-text-muted)]">
                {k.label}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[var(--enterprise-text)]">
                {k.value}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--enterprise-text-muted)]">
                {k.hint}
              </p>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && hasWorkspace && wid ? (
        <section className="enterprise-card p-3.5 sm:p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--enterprise-text-muted)]">
            {td("workspaceUsage")}
          </h2>
          <div className="mt-3 max-w-md">
            <WorkspaceUsageMeter
              label={td("usageLabelStorage")}
              usedLabel={`${formatGiB(storageUsed)} / ${formatGiB(storageQuota)} GB`}
              pct={storageUsageBarPct}
              warn={storageUsageBarPct >= 85}
            />
            <WorkspaceUsageMeter
              label={td("usageLabelMembers")}
              usedLabel={
                extraSeatCount > 0
                  ? td("membersExtra", {
                      pressure: seatPressure,
                      included: includedSeats,
                      extra: extraSeatCount,
                      usd: extraSeatUsd,
                    })
                  : td("membersIncluded", {
                      pressure: seatPressure,
                      included: includedSeats,
                    })
              }
              pct={seatUsagePct}
              warn={extraSeatCount > 0 || seatUsagePct >= 90}
            />
            <WorkspaceUsageMeter
              label={td("usageLabelProjects")}
              usedLabel={
                maxProjects != null
                  ? `${projectCountForUsage} / ${maxProjects}`
                  : td("projectsUsageUnlimited", { n: projectCountForUsage })
              }
              pct={projectUsagePct}
              warn={maxProjects != null && projectCountForUsage >= maxProjects}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="enterprise-card overflow-hidden p-0 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--enterprise-border)] px-3.5 py-2.5">
            <div>
              <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
                {td("chartTitle")}
              </h2>
              <p className="text-xs text-[var(--enterprise-text-muted)]">{td("chartSubtitle")}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--enterprise-text-muted)]">
              <span>
                {td("last7Days")}{" "}
                <strong className="font-semibold text-[var(--enterprise-text)]">
                  {last7Total}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                <strong className="font-semibold text-[var(--enterprise-text)]">
                  {memberCount}
                </strong>{" "}
                {td("seatsInUse")}
              </span>
            </div>
          </div>
          <div className="p-3.5 sm:p-4">
            <DashboardActivityChart data={activitySeries} />
          </div>
        </section>

        <section className="enterprise-card flex flex-col p-3.5 sm:p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--enterprise-text-muted)]">
            {td("quickActions")}
          </h2>
          <ul className="mt-2.5 flex flex-1 flex-col gap-1.5">
            <li>
              <Link href="/projects" className={actionLinkClass}>
                <span className="flex items-center gap-2">
                  <FileStack
                    className="h-4 w-4 text-[var(--enterprise-text-muted)]"
                    strokeWidth={1.75}
                  />
                  {td("actionNewProject")}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
              </Link>
            </li>
            <li>
              <Link href="/projects" className={actionLinkClass}>
                <span className="flex items-center gap-2">
                  <Upload
                    className="h-4 w-4 text-[var(--enterprise-text-muted)]"
                    strokeWidth={1.75}
                  />
                  {td("actionUploadPdf")}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
              </Link>
            </li>
            <li>
              <Link href="/organization?tab=people" className={actionLinkClass}>
                <span className="flex items-center gap-2">
                  <UserPlus
                    className="h-4 w-4 text-[var(--enterprise-text-muted)]"
                    strokeWidth={1.75}
                  />
                  {td("actionInviteTeam")}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
              </Link>
            </li>
          </ul>
        </section>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="enterprise-card p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--enterprise-text-muted)]">
              {td("gettingStarted")}
            </h2>
            <span className="text-xs text-[var(--enterprise-text-muted)]">
              {td("progressCount", { done: doneCount, total: checklist.length })}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-[var(--enterprise-hover-surface)]">
            <div
              className="h-full bg-[var(--enterprise-primary)] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <ul className="mt-3 space-y-2">
            {checklist.map((row) => (
              <li key={row.id} className="flex items-center gap-2.5 text-sm">
                {row.done ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-semantic-success-bg)] text-[var(--enterprise-semantic-success-text)]">
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--enterprise-border)] text-[var(--enterprise-text-muted)]">
                    <Circle className="h-3 w-3" />
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

        <section className="enterprise-card p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--enterprise-text-muted)]">
              {td("yourProjects")}
            </h2>
            <Link
              href="/projects"
              className={enterpriseButtonClassName({
                variant: "ghost",
                size: "sm",
              })}
            >
              {td("goToProjects")}
            </Link>
          </div>
          {firstProject ? (
            <Link
              href="/projects"
              className="mt-2.5 flex items-center gap-3 rounded-md border border-[var(--enterprise-border)] px-3 py-2.5 transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]">
                <FileStack className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
                  {firstProject.name}
                </p>
                <p className="text-xs text-[var(--enterprise-text-muted)]">
                  {td("projectFilesIssues", {
                    files: firstProject.files.length,
                    issues: issueTotal,
                  })}
                </p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]" />
            </Link>
          ) : (
            <div className="mt-2.5 rounded-md border border-dashed border-[var(--enterprise-border)] px-4 py-6 text-center">
              <p className="text-sm font-semibold text-[var(--enterprise-text)]">
                {td("noProjectsYet")}
              </p>
              <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                {td("noProjectsBody")}
              </p>
              <Link
                href="/projects"
                className={enterpriseButtonClassName({
                  variant: "primary",
                  size: "md",
                  className: "mt-3",
                })}
              >
                {td("goToProjects")}
              </Link>
            </div>
          )}
        </section>
      </div>

      <section className="enterprise-card p-3.5 sm:max-w-md sm:p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--enterprise-text-muted)]">
          {td("shortcuts")}
        </h2>
        <ul className="mt-2 divide-y divide-[var(--enterprise-border)]">
          <li>
            <Link
              href="/projects"
              className="flex items-center justify-between py-2 text-sm text-[var(--enterprise-text)] transition hover:text-[var(--enterprise-primary)]"
            >
              <span className="flex items-center gap-2">
                <FileStack
                  className="h-4 w-4 text-[var(--enterprise-text-muted)]"
                  strokeWidth={1.75}
                />
                {td("shortcutProjectsUploads")}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
            </Link>
          </li>
          <li>
            <Link
              href="/account"
              className="flex items-center justify-between py-2 text-sm text-[var(--enterprise-text)] transition hover:text-[var(--enterprise-primary)]"
            >
              {td("shortcutAccountSettings")}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
            </Link>
          </li>
          <li>
            <Link
              href="/organization"
              className="flex items-center justify-between py-2 text-sm text-[var(--enterprise-text)] transition hover:text-[var(--enterprise-primary)]"
            >
              {td("shortcutOrganization")}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
