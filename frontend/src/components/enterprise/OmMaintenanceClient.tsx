"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Plus,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ASSET_METER_TYPE_LABEL,
  fetchOmMaintenanceCompletions,
  fetchOmMaintenance,
  type OmMaintenanceRow,
  postOmMaintenanceCreateWorkOrder,
  postOmGenerateWorkOrders,
  postOmMaintenanceComplete,
  ProRequiredError,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { OmMaintenanceScheduleSlideOver } from "@/components/enterprise/OmMaintenanceScheduleSlideOver";
import { OmSubPageHeader } from "@/components/enterprise/OmSubPageHeader";
import { OM_PAGE_CLASS } from "@/lib/omCompactStyles";

type Props = { projectId: string };

function healthBadge(h: "overdue" | "dueSoon" | "onTrack") {
  if (h === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Overdue
      </span>
    );
  }
  if (h === "dueSoon") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
        Due soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      On track
    </span>
  );
}

function assigneeLabel(r: OmMaintenanceRow): string {
  if (r.assignedTo?.name?.trim()) return r.assignedTo.name.trim();
  if (r.assignedTo?.email) return r.assignedTo.email;
  if (r.assignedVendorLabel?.trim()) return r.assignedVendorLabel.trim();
  return "—";
}

function meterTriggerLabel(r: OmMaintenanceRow): string | null {
  if (!r.meterType || r.meterThreshold == null) return null;
  const type =
    r.meterType in ASSET_METER_TYPE_LABEL
      ? ASSET_METER_TYPE_LABEL[r.meterType as keyof typeof ASSET_METER_TYPE_LABEL]
      : r.meterType;
  return `Meter: ${type} ≥ ${r.meterThreshold}`;
}

function formatScheduleDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function startOfTodayUtc() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDayUtc(d: Date) {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function addDaysUtc(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

async function refreshMaintenanceViews(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.omMaintenance(projectId) }),
    qc.invalidateQueries({ queryKey: qk.omMaintenanceCompletions(projectId) }),
    qc.invalidateQueries({ queryKey: qk.projectAuditRoot(projectId) }),
  ]);
}

export function OmMaintenanceClient({ projectId }: Props) {
  const qc = useQueryClient();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<OmMaintenanceRow | null>(null);
  const [formSession, setFormSession] = useState(0);
  const {
    data: rows = [],
    isPending,
    error,
  } = useQuery({
    queryKey: qk.omMaintenance(projectId),
    queryFn: () => fetchOmMaintenance(projectId),
  });
  const { data: completions = [], isPending: completionsPending } = useQuery({
    queryKey: qk.omMaintenanceCompletions(projectId),
    queryFn: () => fetchOmMaintenanceCompletions(projectId, { limit: 20 }),
  });

  const openCreate = () => {
    setEditing(null);
    setFormSession((n) => n + 1);
    setSlideOpen(true);
  };

  const openEdit = (row: OmMaintenanceRow) => {
    setEditing(row);
    setFormSession((n) => n + 1);
    setSlideOpen(true);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
  };

  const completeMut = useMutation({
    mutationFn: (scheduleId: string) => postOmMaintenanceComplete(projectId, scheduleId, {}),
    onSuccess: async () => {
      await refreshMaintenanceViews(qc, projectId);
      toast.success("Maintenance completed — next due date updated.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const genMut = useMutation({
    mutationFn: () => postOmGenerateWorkOrders(projectId),
    onSuccess: async (data) => {
      await refreshMaintenanceViews(qc, projectId);
      await qc.invalidateQueries({
        queryKey: qk.issuesForProject(projectId, undefined, "WORK_ORDER"),
      });
      toast.success(
        data.createdIds.length
          ? data.existingIds.length
            ? `Created ${data.createdIds.length} work order(s), skipped ${data.existingIds.length} existing.`
            : `Created ${data.createdIds.length} work order(s).`
          : "No schedules were due for work orders.",
      );
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });
  const createWorkOrderMut = useMutation({
    mutationFn: (scheduleId: string) => postOmMaintenanceCreateWorkOrder(projectId, scheduleId),
    onSuccess: async (res) => {
      await qc.invalidateQueries({
        queryKey: qk.issuesForProject(projectId, undefined, "WORK_ORDER"),
      });
      await refreshMaintenanceViews(qc, projectId);
      toast.success(
        res.created ? "Work order created." : "Work order already exists for this due item.",
      );
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const { dueNowRows, upcomingRows } = useMemo(() => {
    const start = startOfTodayUtc();
    const dueCutoff = endOfDayUtc(addDaysUtc(start, 7));
    const active = rows.filter((r) => r.isActive && r.nextDueAt);
    const dueNowRows = active.filter((r) => new Date(r.nextDueAt!) <= dueCutoff);
    const upcomingRows = active.filter((r) => new Date(r.nextDueAt!) > dueCutoff);
    return { dueNowRows, upcomingRows };
  }, [rows]);

  if (isPending) {
    return <EnterpriseLoadingState message="Loading maintenance…" label="Loading" />;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">
        {error instanceof Error ? error.message : "Could not load schedules."}
      </p>
    );
  }

  return (
    <div className={OM_PAGE_CLASS}>
      <OmSubPageHeader
        icon={CalendarRange}
        title="Maintenance (PPM)"
        description="Recurring schedules, due work orders, and completion history."
        action={
          <EnterpriseButton size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New schedule
          </EnterpriseButton>
        }
      />

      {rows.length === 0 ? (
        <div className="enterprise-card flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-[var(--enterprise-text-muted)]">
          <p>
            No maintenance schedules yet. Add a preventive schedule for an asset to get started.
          </p>
          <EnterpriseButton size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New schedule
          </EnterpriseButton>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <section className="enterprise-card p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Due now</h2>
              <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                Overdue, due today, and due in the next 7 days.
              </p>
            </div>
            <button
              type="button"
              onClick={() => genMut.mutate()}
              disabled={genMut.isPending || dueNowRows.length === 0}
              className="inline-flex min-h-8 items-center rounded-lg border border-[var(--enterprise-border)] px-2.5 text-xs font-semibold text-[var(--enterprise-text)] disabled:opacity-50"
            >
              Create work orders for due items
            </button>
          </div>
          {dueNowRows.length === 0 ? (
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              No schedules due in the next 7 days.
            </p>
          ) : (
            <div className="mobile-table-wrap overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--enterprise-border)] text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2">Schedule</th>
                    <th className="px-3 py-2">Next due</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Assigned to</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dueNowRows.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--enterprise-border)]/80">
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{r.asset.tag}</td>
                      <td className="px-3 py-2 text-[var(--enterprise-text)]">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="text-left font-medium hover:underline"
                        >
                          {r.title || r.frequency}
                        </button>
                        {meterTriggerLabel(r) ? (
                          <p className="mt-0.5 text-[11px] text-violet-700 dark:text-violet-300">
                            {meterTriggerLabel(r)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-[var(--enterprise-text-muted)]">
                        {formatScheduleDate(r.nextDueAt)}
                      </td>
                      <td className="px-3 py-2">{healthBadge(r.health)}</td>
                      <td className="px-3 py-2 text-[var(--enterprise-text-muted)]">
                        {assigneeLabel(r)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => createWorkOrderMut.mutate(r.id)}
                            disabled={createWorkOrderMut.isPending}
                            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--enterprise-border)] px-2.5 text-xs font-semibold text-[var(--enterprise-text)] disabled:opacity-50"
                          >
                            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                            Create work order
                          </button>
                          <button
                            type="button"
                            onClick={() => completeMut.mutate(r.id)}
                            disabled={completeMut.isPending}
                            className="inline-flex min-h-8 items-center rounded-lg border border-[var(--enterprise-border)] px-2.5 text-xs font-semibold text-[var(--enterprise-text)] disabled:opacity-50"
                          >
                            Complete directly
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--enterprise-border)] px-2.5 text-xs font-semibold text-[var(--enterprise-text)]"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {upcomingRows.length > 0 ? (
        <section className="enterprise-card p-3 sm:p-4">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
            Upcoming schedules
          </h2>
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
            Active recurring schedules beyond the next 7 days.
          </p>
          <div className="mobile-table-wrap mt-3 overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--enterprise-border)] text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                  <th className="sticky left-0 z-[1] bg-[var(--enterprise-surface)] px-3 py-2">
                    Asset
                  </th>
                  <th className="px-3 py-2">Schedule</th>
                  <th className="px-3 py-2">Next due</th>
                  <th className="px-3 py-2">Last completed</th>
                  <th className="px-3 py-2">Assigned to</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {upcomingRows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--enterprise-border)]/80">
                    <td className="sticky left-0 z-[1] bg-[var(--enterprise-surface)] px-3 py-2 font-mono text-xs font-semibold">
                      {r.asset.tag}
                    </td>
                    <td className="px-3 py-2 text-[var(--enterprise-text)]">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-left font-medium hover:underline"
                      >
                        {r.title || r.frequency}
                      </button>
                      {meterTriggerLabel(r) ? (
                        <p className="mt-0.5 text-[11px] text-violet-700 dark:text-violet-300">
                          {meterTriggerLabel(r)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--enterprise-text-muted)]">
                      {formatScheduleDate(r.nextDueAt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--enterprise-text-muted)]">
                      {formatScheduleDate(r.lastCompletedAt)}
                    </td>
                    <td className="px-3 py-2 text-[var(--enterprise-text-muted)]">
                      {assigneeLabel(r)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--enterprise-border)] px-2.5 text-xs font-semibold text-[var(--enterprise-text)]"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="enterprise-card p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
              Completed history
            </h2>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              Recorded maintenance completions with actor and linked work orders.
            </p>
          </div>
          <Link
            href={`/projects/${encodeURIComponent(projectId)}/audit`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
          >
            <ScrollText className="h-3.5 w-3.5" aria-hidden />
            Audit log
          </Link>
        </div>
        {completionsPending ? (
          <p className="mt-4 text-sm text-[var(--enterprise-text-muted)]">
            Loading completion history…
          </p>
        ) : completions.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--enterprise-text-muted)]">
            No maintenance completion history yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--enterprise-border)]/80">
            {completions.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--enterprise-text)]">
                    <span className="font-mono text-xs">{c.asset.tag}</span>
                    <span className="text-[var(--enterprise-text-muted)]"> · </span>
                    {c.schedule.title || c.schedule.frequency}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                    Completed by {c.completedBy?.name || c.completedBy?.email || "Unknown"} · Next
                    due {formatScheduleDate(c.nextDueAt)}
                    {c.workOrder ? ` · WO: ${c.workOrder.title}` : ""}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-xs font-semibold text-[var(--enterprise-text-muted)]">
                  {formatScheduleDate(c.completedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rows.some((r) => !r.isActive) ? (
        <section className="enterprise-card p-3 sm:p-4">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
            Inactive schedules
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {rows
              .filter((r) => !r.isActive)
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="text-[var(--enterprise-text-muted)]">
                    <span className="font-mono text-xs">{r.asset.tag}</span> ·{" "}
                    {r.title || r.frequency}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="inline-flex min-h-9 items-center rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)]"
                  >
                    Edit
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <OmMaintenanceScheduleSlideOver
        projectId={projectId}
        open={slideOpen}
        schedule={editing}
        formSession={formSession}
        onClose={closeSlide}
      />
    </div>
  );
}
