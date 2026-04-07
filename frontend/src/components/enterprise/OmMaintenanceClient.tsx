"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchOmMaintenance,
  postOmGenerateWorkOrders,
  postOmMaintenanceComplete,
  ProRequiredError,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";

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

export function OmMaintenanceClient({ projectId }: Props) {
  const qc = useQueryClient();
  const {
    data: rows = [],
    isPending,
    error,
  } = useQuery({
    queryKey: qk.omMaintenance(projectId),
    queryFn: () => fetchOmMaintenance(projectId),
  });

  const completeMut = useMutation({
    mutationFn: (scheduleId: string) => postOmMaintenanceComplete(projectId, scheduleId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.omMaintenance(projectId) });
      toast.success("Maintenance completed — next due date updated.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const genMut = useMutation({
    mutationFn: () => postOmGenerateWorkOrders(projectId),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: qk.omMaintenance(projectId) });
      await qc.invalidateQueries({
        queryKey: qk.issuesForProject(projectId, undefined, "WORK_ORDER"),
      });
      toast.success(
        data.createdIds.length
          ? `Created ${data.createdIds.length} work order(s).`
          : "No schedules were due for work orders.",
      );
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

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
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--enterprise-border)] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)] sm:h-14 sm:w-14"
            aria-hidden
          >
            <CalendarRange className="h-7 w-7 text-[var(--enterprise-primary)]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
              Maintenance (PPM)
            </h1>
            <p className="mt-1.5 text-sm text-[var(--enterprise-text-muted)]">
              Preventive schedules by asset. Status uses today vs next due (due within 30 days = due
              soon).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => genMut.mutate()}
          disabled={genMut.isPending}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 text-sm font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-50"
        >
          Generate work orders (due)
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="enterprise-card px-4 py-12 text-center text-sm text-[var(--enterprise-text-muted)]">
          No maintenance schedules yet. Create schedules via the API or future UI from each asset.
        </div>
      ) : (
        <div className="space-y-3 lg:hidden">
          {rows.map((r) => (
            <div key={r.id} className="enterprise-card flex flex-col gap-2 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-[var(--enterprise-text)]">
                  {r.asset.tag}
                </span>
                {healthBadge(r.health)}
              </div>
              <p className="text-[var(--enterprise-text)]">{r.title || r.frequency}</p>
              <p className="text-xs text-[var(--enterprise-text-muted)]">
                Next: {r.nextDueAt ? new Date(r.nextDueAt).toLocaleDateString() : "—"}
              </p>
              <button
                type="button"
                onClick={() => completeMut.mutate(r.id)}
                disabled={completeMut.isPending}
                className="mt-1 inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)]"
              >
                Mark completed
              </button>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 ? (
        <div className="enterprise-card hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--enterprise-border)] text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                <th className="sticky left-0 z-[1] bg-[var(--enterprise-surface)] px-4 py-3">
                  Asset
                </th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Next due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--enterprise-border)]/80">
                  <td className="sticky left-0 z-[1] bg-[var(--enterprise-surface)] px-4 py-3 font-mono text-xs font-semibold">
                    {r.asset.tag}
                  </td>
                  <td className="px-4 py-3 text-[var(--enterprise-text)]">
                    {r.title || r.frequency}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--enterprise-text-muted)]">
                    {r.nextDueAt ? new Date(r.nextDueAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">{healthBadge(r.health)}</td>
                  <td className="px-4 py-3 text-[var(--enterprise-text-muted)]">
                    {r.assignedVendorLabel ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => completeMut.mutate(r.id)}
                      disabled={completeMut.isPending}
                      className="inline-flex min-h-10 items-center rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)]"
                    >
                      Complete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
