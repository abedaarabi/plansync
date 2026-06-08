"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Loader2,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  deleteOmInspectionRun,
  deleteOmInspectionTemplate,
  fetchOmInspectionRuns,
  fetchOmInspectionTemplates,
  omInspectionRunReportPdfUrl,
  postOmInspectionRun,
  ProRequiredError,
  type OmInspectionRunRow,
  type OmInspectionTemplateRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { OmInspectionRunSlideOver } from "@/components/enterprise/OmInspectionRunSlideOver";
import { OmInspectionTemplateSlideOver } from "@/components/enterprise/OmInspectionTemplateSlideOver";

type Props = { projectId: string };

function checklistItemCount(checklistJson: unknown): number {
  if (!Array.isArray(checklistJson)) return 0;
  return checklistJson.filter(
    (x) => x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string",
  ).length;
}

function runStatusUi(r: OmInspectionRunRow): {
  Icon: typeof CheckCircle2;
  label: string;
  className: string;
} {
  const s = r.status.toUpperCase();
  if (s === "DRAFT") {
    return {
      Icon: PencilLine,
      label: "In progress",
      className: "text-amber-600 dark:text-amber-400",
    };
  }
  if (s === "COMPLETED") {
    const results = Array.isArray(r.resultJson) ? r.resultJson : [];
    const hasFail = results.some(
      (x) => x && typeof x === "object" && (x as { outcome?: string }).outcome === "fail",
    );
    if (hasFail) {
      return {
        Icon: AlertTriangle,
        label: "Issues found",
        className: "text-amber-600 dark:text-amber-400",
      };
    }
    return {
      Icon: CheckCircle2,
      label: "Passed",
      className: "text-emerald-600 dark:text-emerald-400",
    };
  }
  return {
    Icon: ClipboardList,
    label: r.status,
    className: "text-[var(--enterprise-text-muted)]",
  };
}

function InspectionRunMobileCard({
  r,
  num,
  projectId,
  onOpen,
  onDelete,
  deleting,
}: {
  r: OmInspectionRunRow;
  num: number;
  projectId: string;
  onOpen: (run: OmInspectionRunRow) => void;
  onDelete: (runId: string) => void;
  deleting: boolean;
}) {
  const st = runStatusUi(r);
  const StIcon = st.Icon;
  const by = r.createdBy?.name ?? "—";
  const dateStr = new Date(r.updatedAt).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <li className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 shadow-[var(--enterprise-shadow-xs)]">
      <button
        type="button"
        onClick={() => onOpen(r)}
        className="flex w-full items-start gap-3 text-left active:opacity-90"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-xs font-semibold text-[var(--enterprise-primary)]">
              #{num}
            </span>
            <p className="text-base font-semibold leading-snug text-[var(--enterprise-text)]">
              {r.template.name}
            </p>
          </div>
          <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
            {by} · {dateStr}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${st.className}`}
        >
          <StIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
          {st.label}
        </span>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-[var(--enterprise-text-muted)]"
          aria-hidden
        />
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <EnterpriseButton size="sm" onClick={() => onOpen(r)}>
          {r.status === "DRAFT" ? "Continue" : "View"}
        </EnterpriseButton>
        {r.status !== "DRAFT" ? (
          <a
            href={omInspectionRunReportPdfUrl(projectId, r.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--enterprise-text)] transition active:scale-[0.98] hover:bg-[var(--enterprise-hover-surface)]"
          >
            <FileText className="h-4 w-4" aria-hidden />
            PDF
          </a>
        ) : null}
        <button
          type="button"
          disabled={deleting}
          title="Delete inspection"
          aria-label="Delete inspection"
          onClick={() => {
            if (
              !window.confirm(
                "Delete this inspection? PDF and data will be removed. This cannot be undone.",
              )
            )
              return;
            onDelete(r.id);
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-600 transition active:scale-[0.98] disabled:opacity-40 dark:border-red-900/50"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
      </div>
    </li>
  );
}

export function OmInspectionsClient({ projectId }: Props) {
  const qc = useQueryClient();
  const [templateSlideOpen, setTemplateSlideOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeRun, setActiveRun] = useState<OmInspectionRunRow | null>(null);
  const [runSlideOpen, setRunSlideOpen] = useState(false);

  const { data: templates = [], isPending: tp } = useQuery({
    queryKey: qk.omInspectionTemplates(projectId),
    queryFn: () => fetchOmInspectionTemplates(projectId),
  });

  const { data: runs = [], isPending: rp } = useQuery({
    queryKey: qk.omInspectionRuns(projectId),
    queryFn: () => fetchOmInspectionRuns(projectId),
  });

  const startRun = useMutation({
    mutationFn: (templateId: string) =>
      postOmInspectionRun(projectId, { templateId, resultJson: [] }),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: qk.omInspectionRuns(projectId) });
      setPickerOpen(false);
      setActiveRun(row);
      setRunSlideOpen(true);
      toast.success("Inspection started.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (templateId: string) => deleteOmInspectionTemplate(projectId, templateId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.omInspectionTemplates(projectId) });
      await qc.invalidateQueries({ queryKey: qk.omInspectionRuns(projectId) });
      toast.success("Template deleted.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const deleteRunMut = useMutation({
    mutationFn: (runId: string) => deleteOmInspectionRun(projectId, runId),
    onSuccess: async (_, runId) => {
      await qc.invalidateQueries({ queryKey: qk.omInspectionRuns(projectId) });
      if (activeRun?.id === runId) {
        setActiveRun(null);
        setRunSlideOpen(false);
      }
      toast.success("Inspection deleted.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const recentRows = useMemo(() => {
    const sorted = [...runs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return sorted.map((r, i) => ({ r, num: sorted.length - i }));
  }, [runs]);

  const draftCount = useMemo(() => runs.filter((r) => r.status === "DRAFT").length, [runs]);

  const openRun = (r: OmInspectionRunRow) => {
    setActiveRun(r);
    setRunSlideOpen(true);
  };

  const isPending = tp || rp;

  if (isPending) {
    return <EnterpriseLoadingState message="Loading inspections…" label="Loading" />;
  }

  const activeTemplate = activeRun
    ? templates.find((t) => t.id === activeRun.templateId)
    : undefined;

  const openNewInspection = () => {
    if (templates.length === 0) setTemplateSlideOpen(true);
    else setPickerOpen(true);
  };

  return (
    <div className="mobile-app-page w-full min-w-0 max-w-full space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 border-b border-[var(--enterprise-border)] pb-5 sm:pb-6">
        <div className="flex min-w-0 gap-3 sm:gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] shadow-[var(--enterprise-shadow-xs)] sm:h-14 sm:w-14"
            aria-hidden
          >
            <ClipboardCheck className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Inspections
            </h1>
            <p className="mt-1.5 hidden text-sm leading-relaxed text-[var(--enterprise-text-muted)] sm:block">
              Field checklists and sign-off — save drafts, attach photos, then complete for a PDF
              report and optional owner email.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:max-w-md">
          <div className="enterprise-card rounded-2xl p-3 text-center sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)] sm:text-[11px]">
              Templates
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--enterprise-text)] sm:text-2xl">
              {templates.length}
            </p>
          </div>
          <div className="enterprise-card rounded-2xl p-3 text-center sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)] sm:text-[11px]">
              Runs
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--enterprise-text)] sm:text-2xl">
              {runs.length}
            </p>
          </div>
          <div className="enterprise-card rounded-2xl p-3 text-center sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)] sm:text-[11px]">
              Drafts
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--enterprise-text)] sm:text-2xl">
              {draftCount}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <EnterpriseButton
            size="sm"
            disabled={startRun.isPending}
            loading={startRun.isPending}
            onClick={openNewInspection}
          >
            {!startRun.isPending ? <Plus className="h-4 w-4" strokeWidth={2.5} /> : null}
            New inspection
          </EnterpriseButton>
          <EnterpriseButton
            variant="secondary"
            size="sm"
            onClick={() => setTemplateSlideOpen(true)}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New template
          </EnterpriseButton>
        </div>
      </header>

      {/* Templates */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Your templates</h2>
        </div>
        <p className="mb-4 text-sm text-[var(--enterprise-text-muted)]">
          Reusable checklists. Each template defines levels, pass/fail items, and how often you run
          it.
        </p>

        {templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/60 px-5 py-10 text-center">
            <ClipboardList
              className="mx-auto h-10 w-10 text-[var(--enterprise-text-muted)]"
              strokeWidth={1.25}
            />
            <p className="mt-3 text-sm font-medium text-[var(--enterprise-text)]">
              No templates yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--enterprise-text-muted)]">
              Create your first template to define checklist items and cadence (e.g. monthly fire
              walk).
            </p>
            <button
              type="button"
              onClick={() => setTemplateSlideOpen(true)}
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Create template
            </button>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            {templates.map((t: OmInspectionTemplateRow) => {
              const n = checklistItemCount(t.checklistJson);
              return (
                <li
                  key={t.id}
                  className="flex min-h-[4.5rem] items-start gap-3 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 shadow-[var(--enterprise-shadow-xs)] transition active:scale-[0.98]"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)]"
                    aria-hidden
                  >
                    <FileText className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--enterprise-text)]">{t.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {t.frequency ? (
                        <span className="inline-flex rounded-full bg-[var(--enterprise-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--enterprise-text-muted)] ring-1 ring-[var(--enterprise-border)]">
                          {t.frequency}
                        </span>
                      ) : null}
                      <span className="text-xs text-[var(--enterprise-text-muted)]">
                        {n} checklist item{n === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deleteTemplateMut.isPending}
                    title="Delete template"
                    aria-label={`Delete template ${t.name}`}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete template “${t.name}”? All inspection runs that use it will be removed. This cannot be undone.`,
                        )
                      )
                        return;
                      deleteTemplateMut.mutate(t.id);
                    }}
                    className="mobile-touch-target shrink-0 rounded-xl p-2 text-[var(--enterprise-text-muted)] transition active:scale-[0.98] hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent runs */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-[var(--enterprise-primary)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Recent activity</h2>
        </div>
        <p className="mb-4 text-sm text-[var(--enterprise-text-muted)]">
          Continue a draft or open a finished run for the PDF. Status reflects pass/fail outcomes.
        </p>

        {runs.length === 0 ? (
          <p className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-10 text-center text-sm text-[var(--enterprise-text-muted)]">
            No runs yet — start with New inspection.
          </p>
        ) : (
          <>
            <ul className="space-y-3 lg:hidden" aria-label="Recent inspection runs">
              {recentRows.slice(0, 25).map(({ r, num }) => (
                <InspectionRunMobileCard
                  key={r.id}
                  r={r}
                  num={num}
                  projectId={projectId}
                  onOpen={openRun}
                  onDelete={(id) => deleteRunMut.mutate(id)}
                  deleting={deleteRunMut.isPending && deleteRunMut.variables === r.id}
                />
              ))}
            </ul>
            <div className="mobile-table-wrap hidden overflow-x-auto rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] shadow-[var(--enterprise-shadow-xs)] lg:block">
              <table className="w-full min-w-[540px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/80 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <th className="py-3 pl-4 pr-2">#</th>
                    <th className="px-3 py-3">Checklist</th>
                    <th className="px-3 py-3">Updated</th>
                    <th className="px-3 py-3">Inspector</th>
                    <th className="px-3 py-3">Outcome</th>
                    <th className="py-3 pl-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.slice(0, 25).map(({ r, num }) => {
                    const st = runStatusUi(r);
                    const by = r.createdBy?.name ?? "—";
                    const dateStr = new Date(r.updatedAt).toLocaleDateString(undefined, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                    const StIcon = st.Icon;
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-[var(--enterprise-border)] last:border-0 hover:bg-[var(--enterprise-surface)]/50"
                      >
                        <td className="py-3 pl-4 pr-2 font-mono text-xs text-[var(--enterprise-text-muted)]">
                          {num}
                        </td>
                        <td className="px-3 py-3 font-medium text-[var(--enterprise-text)]">
                          {r.template.name}
                        </td>
                        <td className="px-3 py-3 text-[var(--enterprise-text-muted)]">{dateStr}</td>
                        <td className="px-3 py-3 text-[var(--enterprise-text)]">{by}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 text-sm ${st.className}`}
                          >
                            <StIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                            {st.label}
                          </span>
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-2 sm:gap-3">
                            {r.status !== "DRAFT" && (
                              <a
                                href={omInspectionRunReportPdfUrl(projectId, r.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-primary)]"
                              >
                                <FileText className="h-3.5 w-3.5" aria-hidden />
                                View PDF
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => openRun(r)}
                              className="text-xs font-semibold text-[var(--enterprise-primary)] hover:underline"
                            >
                              {r.status === "DRAFT" ? "Continue" : "View"}
                            </button>
                            <button
                              type="button"
                              disabled={deleteRunMut.isPending && deleteRunMut.variables === r.id}
                              title="Delete inspection"
                              aria-label="Delete inspection"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    "Delete this inspection? PDF and data will be removed. This cannot be undone.",
                                  )
                                )
                                  return;
                                deleteRunMut.mutate(r.id);
                              }}
                              className="rounded-md p-1.5 text-[var(--enterprise-text-muted)] hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            >
                              {deleteRunMut.isPending && deleteRunMut.variables === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <OmInspectionTemplateSlideOver
        projectId={projectId}
        open={templateSlideOpen}
        onClose={() => setTemplateSlideOpen(false)}
      />

      {activeRun && (
        <OmInspectionRunSlideOver
          projectId={projectId}
          run={activeRun}
          template={activeTemplate}
          open={runSlideOpen}
          onClose={() => {
            setRunSlideOpen(false);
            setActiveRun(null);
          }}
        />
      )}

      <EnterpriseSlideOver
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        panelMaxWidthClass="max-w-[400px]"
        overlayZClass="z-[110]"
        ariaLabelledBy="pick-tpl-title"
        header={
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]">
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <h2
                id="pick-tpl-title"
                className="text-lg font-semibold text-[var(--enterprise-text)]"
              >
                New inspection
              </h2>
            </div>
            <p className="mt-2 text-xs text-[var(--enterprise-text-muted)]">
              Choose a template. You can save a draft and finish later.
            </p>
          </div>
        }
        bodyClassName="px-2 py-2"
        footerClassName="border-t border-[var(--enterprise-border)] px-4 py-3"
        footer={
          <EnterpriseButton
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => setPickerOpen(false)}
          >
            Cancel
          </EnterpriseButton>
        }
      >
        <ul className="max-h-[min(60vh,420px)] overflow-y-auto mobile-scroll">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={startRun.isPending}
                onClick={() => startRun.mutate(t.id)}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-base font-medium text-[var(--enterprise-text)] transition active:scale-[0.98] active:bg-[var(--enterprise-hover-surface)] disabled:opacity-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-primary)]">
                  <FileText className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{t.name}</span>
                  {t.frequency ? (
                    <span className="mt-0.5 block text-xs font-normal text-[var(--enterprise-text-muted)]">
                      {t.frequency}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </EnterpriseSlideOver>
    </div>
  );
}
