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
  fetchOmPeriodPack,
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
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { isSuperAdmin } from "@/lib/workspaceRole";
import { isWorkspaceOmBillingClient } from "@/lib/workspaceSubscription";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { OM_COMPACT_INPUT, OM_COMPACT_LABEL, OM_PAGE_CLASS } from "@/lib/omCompactStyles";
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
    <div className="enterprise-card mx-auto w-full max-w-md rounded-xl px-4 py-6 text-center shadow-[var(--enterprise-shadow-card)] sm:px-6">
      <div
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]"
        aria-hidden
      >
        <Icon className="h-5 w-5 text-[var(--enterprise-primary)]" strokeWidth={1.5} />
      </div>
      <h1 className="mt-3 text-sm font-semibold tracking-tight text-[var(--enterprise-text)]">
        {title}
      </h1>
      <div className="mt-2 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
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
      className={`enterprise-card flex flex-col justify-between gap-1.5 rounded-xl border-l-4 p-3 ${accent} ${
        href ? "enterprise-card-hover group transition duration-200 active:scale-[0.98]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-semibold leading-snug text-[var(--enterprise-text)]">
          {title}
        </h3>
        <span className="flex shrink-0 items-center gap-0.5">
          {ok ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
          )}
          {href ? (
            <ChevronRight
              className="h-4 w-4 text-[var(--enterprise-text-muted)] opacity-50 transition group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              aria-hidden
            />
          ) : null}
        </span>
      </div>
      <p className="break-words text-xs leading-snug text-[var(--enterprise-text-muted)]">
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

function projectScopedBase(projectId: string, workspaceId: string | undefined | null): string {
  return workspaceId
    ? `/workspaces/${workspaceId}/projects/${projectId}`
    : `/projects/${projectId}`;
}

const QUICK_LINKS: {
  path: string;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    path: "/om/assets",
    label: "Assets",
    hint: "Equipment & drawing pins",
    icon: Package,
  },
  {
    path: "/om/work-orders",
    label: "Work orders",
    hint: "O&M tasks",
    icon: Wrench,
  },
  {
    path: "/om/maintenance",
    label: "Maintenance",
    hint: "PPM schedules",
    icon: ClipboardList,
  },
  {
    path: "/om/inspections",
    label: "Inspections",
    hint: "Templates & runs",
    icon: ClipboardCheck,
  },
  {
    path: "/om/tenant-portal",
    label: "Occupant hub",
    hint: "Overview & building links",
    icon: Link2,
  },
  {
    path: "/files",
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
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (summary) setNotesDraft(summary.handoverNotes ?? "");
  }, [summary?.handoverNotes]);

  useEffect(() => {
    if (session?.settings.omHandover) {
      setBuildingOwnerEmailDraft(session.settings.omHandover.buildingOwnerEmail ?? "");
    }
  }, [session?.settings.omHandover?.buildingOwnerEmail]);

  const periodPackMut = useMutation({
    mutationFn: async () => {
      const from = `${periodFrom}T00:00:00.000Z`;
      const to = `${periodTo}T23:59:59.999Z`;
      const data = await fetchOmPeriodPack(projectId, from, to);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = `period-pack-${projectId.slice(0, 8)}-${periodFrom}_${periodTo}.json`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    onSuccess: () => toast.success("Period pack downloaded."),
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

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

  const omBilling = isWorkspaceOmBillingClient(primary?.workspace);
  if (!omBilling) {
    return (
      <GateState icon={AlertTriangle} title="Enterprise plan required">
        <p className="mb-4">
          Operations & Maintenance (including this handover hub) needs the{" "}
          <strong className="font-medium text-[var(--enterprise-text)]">Enterprise</strong>{" "}
          workspace plan. Upgrade under{" "}
          <strong className="font-medium text-[var(--enterprise-text)]">
            Organization → Plan & billing
          </strong>
          .
        </p>
        {superAdmin ? (
          <Link
            href="/organization?tab=billing"
            className="inline-flex w-full min-h-12 max-w-sm items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)] focus-visible:ring-offset-2 sm:w-auto"
          >
            Open Plan & billing
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        ) : (
          <p className="text-xs text-[var(--enterprise-text-muted)]">
            Ask a workspace Super Admin to upgrade the plan.
          </p>
        )}
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
  const pBase = projectScopedBase(projectId, primary?.workspace.id);
  const assetsOk = r.assets.total === 0 || r.assets.linkedToDrawing >= r.assets.total;
  const woOk = r.workOrdersOpen === 0;
  const trOk = r.tenantRequestsOpen === 0;
  const maintOk = r.maintenance.overdue === 0;
  const punchOk = r.punchOpen === 0;
  const ciOk = r.constructionIssuesOpen === 0;
  const inspectionsOk = r.inspections.templates === 0 || r.inspections.completedRuns > 0;
  const portalOk =
    r.occupantPortal.activeMagicLinks > 0 &&
    (r.assets.total === 0 || r.occupantPortal.assetsWithOccupantSecret > 0);

  const readinessChecks = [assetsOk, woOk, trOk, maintOk, inspectionsOk, punchOk, ciOk, portalOk];
  const passedCount = readinessChecks.filter(Boolean).length;
  const totalChecks = readinessChecks.length;
  const readinessPct = Math.round((passedCount / totalChecks) * 100);

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={FileCheck2}
        title="Handover & FM"
        description={`${summary.projectName} — readiness, brief, and FM handover.`}
        action={
          <>
            <EnterpriseButton
              size="sm"
              disabled={markCompleteMut.isPending || Boolean(summary.handoverCompletedAt)}
              loading={markCompleteMut.isPending}
              onClick={() => markCompleteMut.mutate(true)}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Mark complete
            </EnterpriseButton>
            <EnterpriseButton variant="secondary" size="sm" onClick={() => setWizardOpen(true)}>
              FM wizard
            </EnterpriseButton>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${projectStageBadgeClass(summary.stage)}`}
          >
            <ProjectStageIconGlyph stage={summary.stage} />
            {projectStageLabel(summary.stage)}
          </span>
          {summary.handoverCompletedAt ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              {new Date(summary.handoverCompletedAt).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--enterprise-text-muted)]">
              No handover date
            </span>
          )}
          {summary.handoverCompletedAt ? (
            <EnterpriseButton
              variant="ghost"
              size="sm"
              disabled={markCompleteMut.isPending}
              loading={markCompleteMut.isPending}
              onClick={() => markCompleteMut.mutate(false)}
            >
              Clear date
            </EnterpriseButton>
          ) : null}
          {superAdmin ? (
            <EnterpriseButton
              variant="secondary"
              size="sm"
              disabled={setStageMut.isPending || summary.stage === "HANDOVER"}
              loading={setStageMut.isPending}
              onClick={() => setStageMut.mutate()}
            >
              Set stage
            </EnterpriseButton>
          ) : null}
        </div>
      </OmSubPageHeader>

      {summary.handoverCompletedAt ? (
        <div className="enterprise-alert-success rounded-xl px-3 py-2.5 text-xs">
          Handover date recorded — keep the FM brief below updated.
        </div>
      ) : null}

      <section
        aria-labelledby="readiness-heading"
        className="rounded-xl border border-[var(--enterprise-border)]/80 bg-[var(--enterprise-bg)]/50 p-3 shadow-[var(--enterprise-shadow-xs)]"
      >
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Assets on drawings"
            ok={assetsOk}
            detail={
              r.assets.total === 0
                ? "No assets yet — add equipment when ready."
                : `${r.assets.linkedToDrawing} / ${r.assets.total} linked to a sheet`
            }
            href={`${pBase}/om/assets`}
          />
          <StatCard
            title="Open work orders"
            ok={woOk}
            detail={
              r.workOrdersOpen === 0
                ? "No open internal work orders."
                : `${r.workOrdersOpen} open (O&M)`
            }
            href={`${pBase}/om/work-orders`}
          />
          <StatCard
            title="Open tenant requests"
            ok={trOk}
            detail={
              r.tenantRequestsOpen === 0
                ? "No open occupant submissions."
                : `${r.tenantRequestsOpen} open (occupant inbox)`
            }
            href={`${pBase}/om/tenant-requests`}
          />
          <StatCard
            title="Maintenance (PPM)"
            ok={maintOk}
            detail={
              r.maintenance.schedulesTracked === 0
                ? "No active schedules yet."
                : `${r.maintenance.overdue} overdue · ${r.maintenance.dueSoon} due soon (30d)`
            }
            href={`${pBase}/om/maintenance`}
          />
          <StatCard
            title="Inspections"
            ok={inspectionsOk}
            detail={`${r.inspections.templates} template(s) · ${r.inspections.completedRuns} completed run(s)`}
            href={`${pBase}/om/inspections`}
          />
          <StatCard
            title="Punch list"
            ok={punchOk}
            detail={r.punchOpen === 0 ? "No open punch items." : `${r.punchOpen} open items`}
            href={`${pBase}/punch`}
          />
          <StatCard
            title="Construction issues"
            ok={ciOk}
            detail={
              r.constructionIssuesOpen === 0
                ? "No open construction issues."
                : `${r.constructionIssuesOpen} open (construction)`
            }
            href={`${pBase}/issues?issueKind=CONSTRUCTION`}
          />
          <StatCard
            title="Occupant program"
            ok={portalOk}
            detail={
              r.occupantPortal.activeMagicLinks === 0
                ? "No active building links — enable in project settings."
                : r.assets.total > 0 && r.occupantPortal.assetsWithOccupantSecret === 0
                  ? `${r.occupantPortal.activeMagicLinks} active link(s) — add occupant QR on assets.`
                  : `${r.occupantPortal.activeMagicLinks} active link(s) · ${r.occupantPortal.assetsWithOccupantSecret} / ${r.assets.total} assets with occupant QR`
            }
            href={`${pBase}/om/tenant-portal`}
          />
        </div>
      </section>

      <section className="enterprise-card overflow-hidden p-3 sm:p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Handover brief
        </h2>
        <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
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
          rows={6}
          className={`${OM_COMPACT_INPUT} mt-3 min-h-[7rem] resize-y`}
          placeholder="e.g. Main contractor warranty until … · BMS training booked … · O&M manuals in Files folder …"
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <EnterpriseButton
            size="sm"
            fullWidth
            className="sm:w-auto"
            disabled={saveNotesMut.isPending || notesDraft === (summary.handoverNotes ?? "")}
            loading={saveNotesMut.isPending}
            onClick={() => saveNotesMut.mutate()}
          >
            {saveNotesMut.isPending ? "Saving…" : "Save notes"}
          </EnterpriseButton>
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

        <div className="mt-4 border-t border-[var(--enterprise-border)] pt-4">
          <h3 className="text-xs font-semibold text-[var(--enterprise-text)]">
            Inspection reports
          </h3>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
            When an inspection is completed, PlanSync can email the PDF report to the building owner
            or client contact. Uses your workspace Resend configuration (
            <code className="rounded bg-[var(--enterprise-surface)] px-1">RESEND_API_KEY</code> and{" "}
            <code className="rounded bg-[var(--enterprise-surface)] px-1">RESEND_FROM</code>).
          </p>
          <label className={`${OM_COMPACT_LABEL} mt-2`}>Building owner email</label>
          <input
            type="email"
            autoComplete="email"
            value={buildingOwnerEmailDraft}
            onChange={(e) => setBuildingOwnerEmailDraft(e.target.value)}
            placeholder="owner@example.com"
            className={`${OM_COMPACT_INPUT} mt-1 max-w-md`}
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <EnterpriseButton
              variant="secondary"
              size="sm"
              fullWidth
              className="sm:w-auto"
              disabled={
                saveOwnerEmailMut.isPending ||
                buildingOwnerEmailDraft.trim() ===
                  (session?.settings.omHandover.buildingOwnerEmail ?? "").trim()
              }
              loading={saveOwnerEmailMut.isPending}
              onClick={() => saveOwnerEmailMut.mutate()}
            >
              Save email
            </EnterpriseButton>
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

        <div className="mt-4 border-t border-[var(--enterprise-border)] pt-4">
          <h3 className="text-xs font-semibold text-[var(--enterprise-text)]">
            Download period pack
          </h3>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
            JSON export of assets, completed inspections, maintenance completions, and closed work
            orders for a date range.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <div>
              <label htmlFor="period-from" className={OM_COMPACT_LABEL}>
                From
              </label>
              <input
                id="period-from"
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className={`${OM_COMPACT_INPUT} mt-1`}
              />
            </div>
            <div>
              <label htmlFor="period-to" className={OM_COMPACT_LABEL}>
                To
              </label>
              <input
                id="period-to"
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className={`${OM_COMPACT_INPUT} mt-1`}
              />
            </div>
            <EnterpriseButton
              variant="secondary"
              size="sm"
              fullWidth
              className="sm:w-auto"
              disabled={periodPackMut.isPending || !periodFrom || !periodTo}
              loading={periodPackMut.isPending}
              onClick={() => periodPackMut.mutate()}
            >
              Download period pack
            </EnterpriseButton>
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
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
          Quick links
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ path, label, hint, icon: Icon }) => (
            <li key={label} className="min-w-0">
              <Link
                href={`${pBase}${path}`}
                className="enterprise-card enterprise-card-hover group flex min-h-10 items-center gap-2.5 rounded-xl p-2.5 outline-none ring-[var(--enterprise-primary)]/40 transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enterprise-bg)] active:scale-[0.98]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-primary)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold leading-snug text-[var(--enterprise-text)]">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                    {hint}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--enterprise-primary)]"
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
