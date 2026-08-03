"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Crosshair, PanelsTopLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearBuildingClashResults,
  fetchBuildingClashSummary,
  type BuildingClashSummary,
} from "@/lib/api-client/bim-clash";
import { ProRequiredError } from "@/lib/api-client/errors";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";
import { qk } from "@/lib/queryKeys";

type Props = {
  buildingId: string;
  onReviewIn3d: () => void;
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function totalClashCount(data: BuildingClashSummary): number {
  return data.tests.reduce((n, t) => n + t.clashCount, 0);
}

function KpiTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "success" | "muted";
}) {
  const valueClass =
    tone === "warn"
      ? "text-[var(--enterprise-semantic-warning-text)]"
      : tone === "success"
        ? "text-[var(--enterprise-semantic-success-text)]"
        : tone === "muted"
          ? "text-[var(--enterprise-text-muted)]"
          : "text-[var(--enterprise-text)]";
  return (
    <div className="rounded-xl bg-[var(--enterprise-bg)] px-3 py-2.5 ring-1 ring-[var(--enterprise-border)]">
      <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function TypeChip({ label, count }: { label: string; count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--enterprise-hover-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--enterprise-text)]">
      <span className="tabular-nums">{count}</span>
      <span className="text-[var(--enterprise-text-muted)]">{label}</span>
    </span>
  );
}

function ClearClashesConfirmDialog({
  open,
  clashCount,
  testCount,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  clashCount: number;
  testCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      role="alertdialog"
      ariaLabelledBy="clear-building-clashes-title"
      ariaDescribedBy="clear-building-clashes-desc"
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      footer={
        <>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className={`${MOBILE_DIALOG_BTN_PRIMARY} bg-red-600 text-white hover:bg-red-700 disabled:pointer-events-none`}
          >
            {isDeleting ? "Deleting…" : "Delete all clashes"}
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]`}
          >
            Cancel
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600">
          <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="clear-building-clashes-title"
            className="text-balance text-lg font-semibold text-[var(--enterprise-text)]"
          >
            Delete all clash results?
          </h2>
          <p
            id="clear-building-clashes-desc"
            className="mt-2 text-base leading-relaxed text-[var(--enterprise-text-muted)]"
          >
            This permanently removes{" "}
            <span className="font-medium text-[var(--enterprise-text)]">
              {clashCount} clash{clashCount === 1 ? "" : "es"}
            </span>{" "}
            from {testCount} test{testCount === 1 ? "" : "s"} for this building. Test setups are
            kept so you can run them again. Linked issues are not deleted.
          </p>
        </div>
      </div>
    </EnterpriseResponsiveDialog>
  );
}

// fallow-ignore-next-line complexity
export function BuildingClashHealth({ buildingId, onReviewIn3d }: Props) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: qk.buildingClashSummary(buildingId),
    queryFn: () => fetchBuildingClashSummary(buildingId),
    staleTime: 30_000,
    retry: (count, err) => (err instanceof ProRequiredError ? false : count < 2),
  });

  const clearMut = useMutation({
    mutationFn: () => clearBuildingClashResults(buildingId),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: qk.buildingClashSummary(buildingId) });
      setConfirmOpen(false);
      toast.success(
        res.deletedCount === 0
          ? "No clash results to delete"
          : `Deleted ${res.deletedCount} clash${res.deletedCount === 1 ? "" : "es"}`,
      );
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete clashes."),
  });

  if (error instanceof ProRequiredError) {
    return (
      <section className="enterprise-card space-y-3 rounded-xl p-4 sm:p-5">
        <HeaderIcon />
        <div>
          <h2 className="text-base font-semibold text-[var(--enterprise-text)]">Clash health</h2>
          <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
            Clash detection is available on Pro. Upgrade to run tests and track open clashes here.
          </p>
        </div>
      </section>
    );
  }

  if (isPending && !data) {
    return (
      <section className="enterprise-card space-y-4 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="enterprise-skeleton h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <div className="enterprise-skeleton h-5 w-32 rounded" />
            <div className="enterprise-skeleton h-3.5 w-48 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="enterprise-skeleton h-16 rounded-xl" />
          <div className="enterprise-skeleton h-16 rounded-xl" />
          <div className="enterprise-skeleton h-16 rounded-xl" />
          <div className="enterprise-skeleton h-16 rounded-xl" />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="enterprise-card space-y-3 rounded-xl p-4 sm:p-5">
        <HeaderIcon />
        <div>
          <h2 className="text-base font-semibold text-[var(--enterprise-text)]">Clash health</h2>
          <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
            Could not load clash summary. Try again later.
          </p>
        </div>
      </section>
    );
  }

  const hasTests = data.tests.length > 0;
  const clashTotal = totalClashCount(data);
  const isClear = hasTests && data.openCount === 0;

  return (
    <section className="enterprise-card space-y-4 rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <HeaderIcon tone={data.openCount > 0 ? "warn" : isClear ? "success" : "neutral"} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
                Clash health
              </h2>
              {data.openCount > 0 ? (
                <span className="enterprise-badge-warning inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold">
                  {data.openCount} open
                </span>
              ) : isClear ? (
                <span className="enterprise-badge-success inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold">
                  Clear
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              {hasTests
                ? data.lastRunAt
                  ? `Last run ${relativeTime(data.lastRunAt)} · ${clashTotal} stored result${clashTotal === 1 ? "" : "s"}`
                  : `${clashTotal} stored result${clashTotal === 1 ? "" : "s"} from clash tests`
                : "Run a clash test in 3D — results stay here so you can track them without re-running."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {clashTotal > 0 ? (
            <button
              type="button"
              className="mobile-touch-target inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--enterprise-semantic-danger-text)] transition hover:bg-[var(--enterprise-semantic-danger-bg)]"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete all
            </button>
          ) : null}
          <button
            type="button"
            className="enterprise-btn-primary mobile-touch-target inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold"
            onClick={onReviewIn3d}
          >
            <PanelsTopLeft className="h-3.5 w-3.5" aria-hidden />
            {hasTests ? "Review in 3D" : "Open & run test"}
          </button>
        </div>
      </div>

      {data.stale ? (
        <div className="enterprise-alert-warning flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Models changed since the last clash run. Open 3D and re-run tests to refresh results.
          </p>
        </div>
      ) : null}

      {hasTests ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiTile
              label="Open"
              value={data.openCount}
              tone={data.openCount > 0 ? "warn" : "success"}
            />
            <KpiTile label="Resolved" value={data.resolvedCount} />
            <KpiTile label="Ignored" value={data.ignoredCount} tone="muted" />
            <KpiTile
              label="Hard clashes"
              value={data.byType.HARD}
              tone={data.byType.HARD > 0 ? "warn" : "muted"}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <TypeChip label="hard" count={data.byType.HARD} />
            <TypeChip label="clearance" count={data.byType.CLEARANCE} />
            <TypeChip label="duplicate" count={data.byType.DUPLICATE} />
          </div>

          <ul className="overflow-hidden rounded-xl ring-1 ring-[var(--enterprise-border)]">
            {data.tests.map((t, i) => {
              const delta = t.lastRunStats?.newCount ?? 0;
              return (
                <li
                  key={t.id}
                  className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 ${
                    i > 0 ? "border-t border-[var(--enterprise-border)]" : ""
                  } bg-[var(--enterprise-surface)]`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--enterprise-text)]">
                      {t.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                      {t.clashCount} clash{t.clashCount === 1 ? "" : "es"}
                      {t.lastRunAt ? ` · ${relativeTime(t.lastRunAt)}` : ""}
                      {delta > 0 ? (
                        <span className="text-[var(--enterprise-semantic-warning-text)]">
                          {` · +${delta} new`}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      t.openCount > 0 ? "enterprise-badge-warning" : "enterprise-badge-success"
                    }`}
                  >
                    {t.openCount > 0 ? `${t.openCount} open` : "Clear"}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--enterprise-bg)] px-4 py-8 text-center ring-1 ring-[var(--enterprise-border)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)]">
            <Crosshair className="h-6 w-6 text-[var(--enterprise-primary)]" aria-hidden />
          </div>
          <div className="max-w-sm space-y-1">
            <p className="text-sm font-semibold text-[var(--enterprise-text)]">
              No clash results yet
            </p>
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              Select your models, open the federated view, and run a clash test. Results appear here
              automatically.
            </p>
          </div>
          <button
            type="button"
            className="enterprise-btn-secondary mobile-touch-target inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
            onClick={onReviewIn3d}
          >
            <PanelsTopLeft className="h-3.5 w-3.5" aria-hidden />
            Open viewer
          </button>
        </div>
      )}

      <ClearClashesConfirmDialog
        open={confirmOpen}
        clashCount={clashTotal}
        testCount={data.tests.length}
        isDeleting={clearMut.isPending}
        onConfirm={() => clearMut.mutate()}
        onCancel={() => {
          if (!clearMut.isPending) setConfirmOpen(false);
        }}
      />
    </section>
  );
}

function HeaderIcon({ tone = "neutral" }: { tone?: "warn" | "success" | "neutral" }) {
  const wrap =
    tone === "warn"
      ? "bg-[var(--enterprise-semantic-warning-bg)] text-[var(--enterprise-semantic-warning-text)]"
      : tone === "success"
        ? "bg-[var(--enterprise-semantic-success-bg)] text-[var(--enterprise-semantic-success-text)]"
        : "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]";
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${wrap}`}
      aria-hidden
    >
      <Crosshair className="h-5 w-5" />
    </div>
  );
}
