"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FolderOpen,
  Link2,
  Loader2,
  Lock,
  Package,
  Settings,
  Wrench,
} from "lucide-react";
import { useEffect, useId, useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import {
  fetchOmHandoverSummary,
  fetchProjectSession,
  patchOmHandoverBrief,
  patchProject,
  ProRequiredError,
} from "@/lib/api-client";
import {
  ProjectStageIconGlyph,
  projectStageBadgeClass,
  projectStageLabel,
} from "@/lib/projectStage";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { isSuperAdmin } from "@/lib/workspaceRole";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { HandoverWizardModal } from "./HandoverWizardModal";

type Props = { projectId: string };

function GateState({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="enterprise-card mx-auto w-full max-w-lg rounded-2xl px-5 py-8 text-center shadow-[var(--enterprise-shadow-card)] sm:px-8 sm:py-10">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)] sm:h-14 sm:w-14"
        aria-hidden
      >
        <Icon
          className="h-6 w-6 text-[var(--enterprise-primary)] sm:h-7 sm:w-7"
          strokeWidth={1.5}
        />
      </div>
      <h1 className="mt-4 text-base font-semibold tracking-tight text-[var(--enterprise-text)] sm:mt-5 sm:text-lg">
        {title}
      </h1>
      <div className="mt-3 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
        {children}
      </div>
    </div>
  );
}

function StatCard({
  title,
  ok,
  detail,
  href,
}: {
  title: string;
  ok: boolean;
  detail: string;
  href?: string;
}) {
  const accent = ok ? "border-l-emerald-500" : "border-l-amber-500";
  const inner = (
    <div
      className={`enterprise-card flex h-full min-h-[6.5rem] flex-col justify-between gap-2 border-l-4 p-3.5 sm:min-h-0 sm:p-5 ${accent} ${
        href ? "enterprise-card-hover group transition duration-200 active:scale-[0.99]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-[var(--enterprise-text)]">
          {title}
        </h3>
        <span className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {ok ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
          )}
          {href ? (
            <ChevronRight
              className="h-4 w-4 text-[var(--enterprise-text-muted)] opacity-50 transition group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              aria-hidden
            />
          ) : null}
        </span>
      </div>
      <p className="break-words text-sm leading-snug text-[var(--enterprise-text-muted)]">
        {detail}
      </p>
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block h-full min-h-[48px] rounded-[1.125rem] outline-none ring-[var(--enterprise-primary)]/40 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-bg)]"
        aria-label={`${title}: ${detail}. Open section.`}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

const QUICK_LINKS: {
  href: (projectId: string) => string;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    href: (id) => `/projects/${id}/om/assets`,
    label: "Assets",
    hint: "Equipment & drawing pins",
    icon: Package,
  },
  {
    href: (id) => `/projects/${id}/om/work-orders`,
    label: "Work orders",
    hint: "O&M tasks",
    icon: Wrench,
  },
  {
    href: (id) => `/projects/${id}/om/maintenance`,
    label: "Maintenance",
    hint: "PPM schedules",
    icon: ClipboardList,
  },
  {
    href: (id) => `/projects/${id}/om/inspections`,
    label: "Inspections",
    hint: "Templates & runs",
    icon: ClipboardCheck,
  },
  {
    href: (id) => `/projects/${id}/om/tenant-portal`,
    label: "Tenant portal",
    hint: "Occupant links",
    icon: Link2,
  },
  {
    href: (id) => `/projects/${id}/files`,
    label: "Files & drawings",
    hint: "O&M manuals & plans",
    icon: FolderOpen,
  },
];

export function OmHandoverClient({ projectId }: Props) {
  const qc = useQueryClient();
  const briefFieldId = useId();
  const { primary } = useEnterpriseWorkspace();
  const superAdmin = isSuperAdmin(primary?.role);

  const { data: session, isPending: sessionPending } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });

  const {
    data: summary,
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: qk.omHandover(projectId),
    queryFn: () => fetchOmHandoverSummary(projectId),
    enabled: Boolean(session && !session.isExternal && session.operationsMode),
  });

  const [notesDraft, setNotesDraft] = useState("");
  const [buildingOwnerEmailDraft, setBuildingOwnerEmailDraft] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (summary) setNotesDraft(summary.handoverNotes ?? "");
  }, [summary?.handoverNotes]);

  useEffect(() => {
    if (session?.settings.omHandover) {
      setBuildingOwnerEmailDraft(session.settings.omHandover.buildingOwnerEmail ?? "");
    }
  }, [session?.settings.omHandover?.buildingOwnerEmail]);

  const saveNotesMut = useMutation({
    mutationFn: () => patchOmHandoverBrief(projectId, { notes: notesDraft }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.projectSession(projectId) });
      await qc.invalidateQueries({ queryKey: qk.omHandover(projectId) });
      void refetch();
      toast.success("Handover notes saved.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const saveOwnerEmailMut = useMutation({
    mutationFn: () => {
      const t = buildingOwnerEmailDraft.trim();
      return patchOmHandoverBrief(projectId, {
        buildingOwnerEmail: t.length === 0 ? null : t,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.projectSession(projectId) });
      await qc.invalidateQueries({ queryKey: qk.omHandover(projectId) });
      void refetch();
      toast.success("Building owner email saved.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const markCompleteMut = useMutation({
    mutationFn: (markDone: boolean) =>
      patchOmHandoverBrief(projectId, {
        handoverCompletedAt: markDone ? new Date().toISOString() : null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.projectSession(projectId) });
      await qc.invalidateQueries({ queryKey: qk.omHandover(projectId) });
      void refetch();
      toast.success("Handover status updated.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const setStageMut = useMutation({
    mutationFn: () => patchProject(projectId, { stage: "HANDOVER" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.project(projectId) });
      if (primary?.workspace.id) {
        await qc.invalidateQueries({ queryKey: qk.projects(primary.workspace.id) });
      }
      void refetch();
      toast.success("Project stage set to Handover & FM.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  if (sessionPending) {
    return <EnterpriseLoadingState message="Loading…" label="Loading" />;
  }

  if (!session) {
    return (
      <GateState icon={AlertTriangle} title="Session unavailable">
        <p>We could not load your workspace session. Refresh the page or sign in again.</p>
      </GateState>
    );
  }

  if (session.isExternal) {
    return (
      <GateState icon={Lock} title="Team access only">
        <p>
          Handover and FM tools are for workspace members. Sign in with a team account to view this
          project.
        </p>
      </GateState>
    );
  }

  if (!session.operationsMode) {
    return (
      <GateState icon={Settings} title="Turn on Operations mode">
        <p className="mb-6">
          Enable{" "}
          <strong className="font-medium text-[var(--enterprise-text)]">Operations mode</strong> in
          project settings to use the handover hub, asset register, maintenance, and occupant
          reporting.
        </p>
        <Link
          href={`/projects/${projectId}/settings`}
          className="inline-flex w-full min-h-12 max-w-sm items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)] focus-visible:ring-offset-2 sm:w-auto"
        >
          Open project settings
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
        <p className="mt-4 text-xs text-[var(--enterprise-text-muted)]">Super Admin only.</p>
      </GateState>
    );
  }

  if (isPending || !summary) {
    if (error) {
      return (
        <div
          className="enterprise-alert-danger mx-auto w-full max-w-lg rounded-2xl px-4 py-5 text-center sm:px-6"
          role="alert"
        >
          <p className="text-sm font-medium leading-snug">
            {error instanceof Error ? error.message : "Could not load handover summary."}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-4 inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-white px-4 text-sm font-semibold text-[var(--enterprise-semantic-danger-text)] shadow-sm hover:bg-white/90 disabled:opacity-60 sm:w-auto"
          >
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Retrying…
              </>
            ) : (
              "Try again"
            )}
          </button>
        </div>
      );
    }
    return <EnterpriseLoadingState message="Loading handover summary…" label="Loading" />;
  }

  const r = summary.readiness;
  const assetsOk = r.assets.total === 0 || r.assets.linkedToDrawing >= r.assets.total;
  const woOk = r.workOrdersOpen === 0;
  const maintOk = r.maintenance.overdue === 0;
  const punchOk = r.punchOpen === 0;
  const ciOk = r.constructionIssuesOpen === 0;
  const inspectionsOk = r.inspections.templates === 0 || r.inspections.completedRuns > 0;
  const portalOk = r.occupantPortal.activeMagicLinks > 0;

  const readinessChecks = [assetsOk, woOk, maintOk, inspectionsOk, punchOk, ciOk, portalOk];
  const passedCount = readinessChecks.filter(Boolean).length;
  const totalChecks = readinessChecks.length;
  const readinessPct = Math.round((passedCount / totalChecks) * 100);

  return (
    <div className="min-w-0 space-y-6 sm:space-y-10">
      <header className="overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-gradient-to-b from-[var(--enterprise-surface)] via-[var(--enterprise-surface)] to-[var(--enterprise-bg)]/90 shadow-[var(--enterprise-shadow-card)]">
        <div className="flex flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:items-stretch lg:gap-8 lg:p-8">
          <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:gap-5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)] sm:h-14 sm:w-14"
              aria-hidden
            >
              <FileCheck2
                className="h-6 w-6 text-[var(--enterprise-primary)] sm:h-7 sm:w-7"
                strokeWidth={1.5}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-widest text-[var(--enterprise-text-muted)] sm:text-xs">
                {summary.projectName}
              </p>
              <h1 className="mt-1.5 text-[1.375rem] font-semibold leading-tight tracking-tight text-[var(--enterprise-text)] sm:text-3xl sm:leading-tight">
                Handover &amp; FM
              </h1>
              <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                One place to confirm readiness before handover: assets on drawings, open work,
                punch, maintenance, and tenant access. Add a brief below for warranties, training,
                and caveats for the FM team.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${projectStageBadgeClass(summary.stage)}`}
                >
                  <ProjectStageIconGlyph stage={summary.stage} />
                  <span className="truncate">{projectStageLabel(summary.stage)}</span>
                </span>
                {summary.handoverCompletedAt ? (
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      Handover dated{" "}
                      {new Date(summary.handoverCompletedAt).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-[var(--enterprise-text-muted)]">
                    Handover date not recorded yet
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 border-t border-[var(--enterprise-border)]/80 pt-5 sm:max-w-md lg:w-[min(100%,18.5rem)] lg:border-l lg:border-t-0 lg:pt-0 lg:pl-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
              Actions
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => markCompleteMut.mutate(true)}
                disabled={markCompleteMut.isPending || Boolean(summary.handoverCompletedAt)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
              >
                {markCompleteMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                )}
                Mark handover complete
              </button>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-medium text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-bg)] active:scale-[0.99]"
              >
                Hand over to FM wizard
              </button>
              {summary.handoverCompletedAt ? (
                <button
                  type="button"
                  onClick={() => markCompleteMut.mutate(false)}
                  disabled={markCompleteMut.isPending}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-medium text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-bg)] active:scale-[0.99] disabled:opacity-50"
                >
                  Clear handover date
                </button>
              ) : null}
              {superAdmin ? (
                <div className="rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 p-3 sm:p-3.5">
                  <button
                    type="button"
                    onClick={() => setStageMut.mutate()}
                    disabled={setStageMut.isPending || summary.stage === "HANDOVER"}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 text-sm font-medium leading-snug text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-bg)] active:scale-[0.99] disabled:opacity-50"
                  >
                    {setStageMut.isPending ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : null}
                    Set lifecycle stage to Handover &amp; FM
                  </button>
                  <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--enterprise-text-muted)]">
                    Updates the project stage for dashboards and reports. Safe to use when
                    commissioning starts.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {summary.handoverCompletedAt ? (
          <div className="border-t border-[var(--enterprise-border)]/60 px-4 py-4 sm:px-6 sm:py-5">
            <div className="enterprise-alert-success rounded-xl p-4 sm:p-5">
              <p className="text-sm font-medium leading-relaxed">
                This project has a recorded handover date. Keep the brief below updated for FM
                continuity.
              </p>
            </div>
          </div>
        ) : null}
      </header>

      <section
        aria-labelledby="readiness-heading"
        className="rounded-2xl border border-[var(--enterprise-border)]/80 bg-[var(--enterprise-bg)]/50 p-4 shadow-[var(--enterprise-shadow-xs)] sm:p-6"
      >
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h2
              id="readiness-heading"
              className="text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]"
            >
              Readiness
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
              {passedCount} of {totalChecks} checks passed — tap a card to fix gaps.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[200px] sm:max-w-[min(100%,240px)]">
            <span className="text-right text-[11px] font-medium tabular-nums text-[var(--enterprise-text-muted)] sm:text-xs">
              {readinessPct}%
            </span>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--enterprise-border)]/50 ring-1 ring-[var(--enterprise-border)]/30">
              <div
                className="h-full min-w-0 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-[width] duration-500 ease-out"
                style={{ width: `${readinessPct}%` }}
                role="progressbar"
                aria-valuenow={passedCount}
                aria-valuemin={0}
                aria-valuemax={totalChecks}
                aria-label={`Readiness ${passedCount} of ${totalChecks}`}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          <StatCard
            title="Assets on drawings"
            ok={assetsOk}
            detail={
              r.assets.total === 0
                ? "No assets yet — add equipment when ready."
                : `${r.assets.linkedToDrawing} / ${r.assets.total} linked to a sheet`
            }
            href={`/projects/${projectId}/om/assets`}
          />
          <StatCard
            title="Open work orders"
            ok={woOk}
            detail={
              r.workOrdersOpen === 0 ? "No open work orders." : `${r.workOrdersOpen} open (O&M)`
            }
            href={`/projects/${projectId}/om/work-orders`}
          />
          <StatCard
            title="Maintenance (PPM)"
            ok={maintOk}
            detail={
              r.maintenance.schedulesTracked === 0
                ? "No active schedules yet."
                : `${r.maintenance.overdue} overdue · ${r.maintenance.dueSoon} due soon (30d)`
            }
            href={`/projects/${projectId}/om/maintenance`}
          />
          <StatCard
            title="Inspections"
            ok={inspectionsOk}
            detail={`${r.inspections.templates} template(s) · ${r.inspections.completedRuns} completed run(s)`}
            href={`/projects/${projectId}/om/inspections`}
          />
          <StatCard
            title="Punch list"
            ok={punchOk}
            detail={r.punchOpen === 0 ? "No open punch items." : `${r.punchOpen} open items`}
            href={`/projects/${projectId}/punch`}
          />
          <StatCard
            title="Construction issues"
            ok={ciOk}
            detail={
              r.constructionIssuesOpen === 0
                ? "No open construction issues."
                : `${r.constructionIssuesOpen} open (construction)`
            }
            href={`/projects/${projectId}/issues`}
          />
          <StatCard
            title="Tenant portal"
            ok={portalOk}
            detail={
              r.occupantPortal.activeMagicLinks === 0
                ? "No active occupant links — add one for occupant reporting."
                : `${r.occupantPortal.activeMagicLinks} active magic link(s)`
            }
            href={`/projects/${projectId}/om/tenant-portal`}
          />
        </div>
      </section>

      <section className="enterprise-card overflow-hidden p-4 sm:p-6 lg:p-7">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Handover brief
        </h2>
        <p className="mt-2 max-w-prose text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
          Warranty contacts, training dates, as-built references, and anything the FM team must
          know. Visible to internal project members.
        </p>
        <label htmlFor={briefFieldId} className="sr-only">
          Handover brief notes
        </label>
        <textarea
          id={briefFieldId}
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          rows={8}
          className="mt-4 min-h-[11rem] w-full max-w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-3 text-base leading-relaxed text-[var(--enterprise-text)] placeholder:text-[var(--enterprise-text-muted)]/70 focus:border-[var(--enterprise-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/25 sm:min-h-44 sm:text-sm"
          placeholder="e.g. Main contractor warranty until … · BMS training booked … · O&M manuals in Files folder …"
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <button
            type="button"
            onClick={() => saveNotesMut.mutate()}
            disabled={saveNotesMut.isPending || notesDraft === (summary.handoverNotes ?? "")}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-50 sm:w-auto sm:min-w-[8.5rem]"
          >
            {saveNotesMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {saveNotesMut.isPending ? "Saving…" : "Save notes"}
          </button>
          {notesDraft !== (summary.handoverNotes ?? "") ? (
            <span className="text-center text-xs text-amber-700 sm:text-left dark:text-amber-300">
              Unsaved changes
            </span>
          ) : (
            <span className="text-center text-xs text-[var(--enterprise-text-muted)] sm:text-left">
              Saved notes sync to the team.
            </span>
          )}
        </div>

        <div className="mt-8 border-t border-[var(--enterprise-border)] pt-6">
          <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">
            Inspection reports
          </h3>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
            When an inspection is completed, PlanSync can email the PDF report to the building owner
            or client contact. Uses your workspace Resend configuration (
            <code className="rounded bg-[var(--enterprise-surface)] px-1">RESEND_API_KEY</code> and{" "}
            <code className="rounded bg-[var(--enterprise-surface)] px-1">RESEND_FROM</code>).
          </p>
          <label className="mt-3 block text-xs font-medium text-[var(--enterprise-text-muted)]">
            Building owner email
          </label>
          <input
            type="email"
            autoComplete="email"
            value={buildingOwnerEmailDraft}
            onChange={(e) => setBuildingOwnerEmailDraft(e.target.value)}
            placeholder="owner@example.com"
            className="mt-1.5 min-h-11 w-full max-w-md rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-sm text-[var(--enterprise-text)] placeholder:text-[var(--enterprise-text-muted)]/70 focus:border-[var(--enterprise-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/25"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => saveOwnerEmailMut.mutate()}
              disabled={
                saveOwnerEmailMut.isPending ||
                buildingOwnerEmailDraft.trim() ===
                  (session?.settings.omHandover.buildingOwnerEmail ?? "").trim()
              }
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-semibold text-[var(--enterprise-text)] transition active:scale-[0.99] disabled:opacity-50"
            >
              {saveOwnerEmailMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Save email
            </button>
            {session?.settings.omHandover.buildingOwnerEmail ? (
              <span className="text-xs text-[var(--enterprise-text-muted)]">
                Active: {session.settings.omHandover.buildingOwnerEmail}
              </span>
            ) : (
              <span className="text-xs text-[var(--enterprise-text-muted)]">
                No recipient — PDF only in-app.
              </span>
            )}
          </div>
        </div>
      </section>

      <HandoverWizardModal
        projectId={projectId}
        projectName={summary.projectName}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        omHandover={session.settings.omHandover}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)] sm:mb-4">
          Quick links
        </h2>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, hint, icon: Icon }) => (
            <li key={label} className="min-w-0">
              <Link
                href={href(projectId)}
                className="enterprise-card enterprise-card-hover group flex min-h-[4.5rem] items-center gap-3 p-3 outline-none ring-[var(--enterprise-primary)]/40 transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-bg)] active:scale-[0.995] sm:min-h-0 sm:p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-primary)] sm:h-11 sm:w-11">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug text-[var(--enterprise-text)]">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-[var(--enterprise-text-muted)]">
                    {hint}
                  </span>
                </span>
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-[var(--enterprise-text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--enterprise-primary)]"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
