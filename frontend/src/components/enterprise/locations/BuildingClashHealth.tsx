"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Crosshair, PanelsTopLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearBuildingClashResults,
  clearClashTestResults,
  fetchBuildingClashSummary,
  type BuildingClashSample,
  type BuildingClashSummary,
} from "@/lib/api-client/bim-clash";
import { clashTypeLabel, formatClashDistanceDetail } from "@/lib/bim/clash/clashStatusStyle";
import { ProRequiredError } from "@/lib/api-client/errors";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { qk } from "@/lib/queryKeys";

type Props = {
  buildingId: string;
  onReviewIn3d: () => void;
  onOpenTest?: (testId: string) => void;
  onOpenClash?: (opts: { testId: string; clash: BuildingClashSample }) => void;
};

type PendingClear =
  | { kind: "building"; clashCount: number; testCount: number }
  | { kind: "test"; testId: string; testName: string; clashCount: number };

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
    <div className="rounded-md bg-[var(--enterprise-bg)] px-3 py-2.5 ring-1 ring-[var(--enterprise-border)]">
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
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--enterprise-hover-surface)] px-2 py-0.5 text-xs font-medium text-[var(--enterprise-text)]">
      <span className="tabular-nums">{count}</span>
      <span className="text-[var(--enterprise-text-muted)]">{label}</span>
    </span>
  );
}

function ClearClashesConfirmDialog({
  pending,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  pending: PendingClear | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const open = pending != null;
  const isTest = pending?.kind === "test";
  const title = isTest ? "Delete clashes for this test?" : "Delete all clash results?";
  const confirmLabel = isTest ? "Delete" : "Delete all";
  const body =
    pending?.kind === "test" ? (
      <>
        This permanently removes{" "}
        <span className="font-semibold text-[var(--enterprise-text)]">
          {pending.clashCount} clash{pending.clashCount === 1 ? "" : "es"}
        </span>{" "}
        from{" "}
        <span className="break-words font-semibold text-[var(--enterprise-text)]">
          &quot;{pending.testName}&quot;
        </span>
        . Other model pairs are unchanged. The test setup is kept so you can run it again.
      </>
    ) : pending ? (
      <>
        This permanently removes{" "}
        <span className="font-semibold text-[var(--enterprise-text)]">
          {pending.clashCount} clash{pending.clashCount === 1 ? "" : "es"}
        </span>{" "}
        from {pending.testCount} test{pending.testCount === 1 ? "" : "s"} for this building. Test
        setups are kept so you can run them again. Linked issues are not deleted.
      </>
    ) : null;

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      role="alertdialog"
      ariaLabelledBy="clear-building-clashes-title"
      ariaDescribedBy="clear-building-clashes-desc"
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      panelClassName="max-w-md"
      footer={
        <>
          <EnterpriseButton
            type="button"
            variant="danger"
            size="md"
            fullWidth
            className="max-lg:min-h-[52px]"
            loading={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? "Deleting…" : confirmLabel}
          </EnterpriseButton>
          <EnterpriseButton
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            className="max-lg:min-h-[52px]"
            disabled={isDeleting}
            onClick={onCancel}
          >
            Cancel
          </EnterpriseButton>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]">
          <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="clear-building-clashes-title"
            className="text-balance text-lg font-semibold leading-snug text-[var(--enterprise-text)]"
          >
            {title}
          </h2>
          <p
            id="clear-building-clashes-desc"
            className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)] sm:text-base"
          >
            {body}
          </p>
        </div>
      </div>
    </EnterpriseResponsiveDialog>
  );
}

// fallow-ignore-next-line complexity
export function BuildingClashHealth({ buildingId, onReviewIn3d, onOpenTest, onOpenClash }: Props) {
  const qc = useQueryClient();
  const [pendingClear, setPendingClear] = useState<PendingClear | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: qk.buildingClashSummary(buildingId),
    queryFn: () => fetchBuildingClashSummary(buildingId),
    staleTime: 30_000,
    retry: (count, err) => (err instanceof ProRequiredError ? false : count < 2),
  });

  const clearMut = useMutation({
    mutationFn: async (pending: PendingClear) => {
      if (pending.kind === "building") return clearBuildingClashResults(buildingId);
      return clearClashTestResults(pending.testId);
    },
    onSuccess: (res, pending) => {
      void qc.invalidateQueries({ queryKey: qk.buildingClashSummary(buildingId) });
      setPendingClear(null);
      if (expandedTestId && pending.kind === "test" && pending.testId === expandedTestId) {
        setExpandedTestId(null);
      }
      toast.success(
        res.deletedCount === 0
          ? "No clash results to delete"
          : pending.kind === "test"
            ? `Deleted ${res.deletedCount} clash${res.deletedCount === 1 ? "" : "es"} from ${pending.testName}`
            : `Deleted ${res.deletedCount} clash${res.deletedCount === 1 ? "" : "es"}`,
      );
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete clashes."),
  });

  if (error instanceof ProRequiredError) {
    return (
      <section className="enterprise-card space-y-3 rounded-md p-4 sm:p-5">
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
      <section className="enterprise-card space-y-4 rounded-md p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="enterprise-skeleton h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <div className="enterprise-skeleton h-5 w-32 rounded" />
            <div className="enterprise-skeleton h-3.5 w-48 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="enterprise-skeleton h-16 rounded-md" />
          <div className="enterprise-skeleton h-16 rounded-md" />
          <div className="enterprise-skeleton h-16 rounded-md" />
          <div className="enterprise-skeleton h-16 rounded-md" />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="enterprise-card space-y-3 rounded-md p-4 sm:p-5">
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
    <section className="enterprise-card space-y-4 rounded-md p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <HeaderIcon tone={data.openCount > 0 ? "warn" : isClear ? "success" : "neutral"} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
                Clash health
              </h2>
              {data.openCount > 0 ? (
                <span className="enterprise-badge-warning inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold">
                  {data.openCount} open
                </span>
              ) : isClear ? (
                <span className="enterprise-badge-success inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold">
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
              onClick={() =>
                setPendingClear({
                  kind: "building",
                  clashCount: clashTotal,
                  testCount: data.tests.length,
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete all
            </button>
          ) : null}
          <EnterpriseButton
            type="button"
            size="sm"
            className="mobile-touch-target"
            onClick={onReviewIn3d}
          >
            <PanelsTopLeft className="h-3.5 w-3.5" aria-hidden />
            {hasTests ? "Review in 3D" : "Open & run test"}
          </EnterpriseButton>
        </div>
      </div>

      {data.stale ? (
        <div className="enterprise-alert-warning flex items-start gap-2 rounded-md px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Models were updated after the last clash run. Stored results may be for previous IFC
            versions — open 3D and re-run tests to refresh.
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

          <ul className="overflow-hidden rounded-md ring-1 ring-[var(--enterprise-border)]">
            {data.tests.map((t, i) => {
              const delta = t.lastRunStats?.newCount ?? 0;
              const samples = t.sampleClashes ?? [];
              const expanded = expandedTestId === t.id;
              return (
                <li
                  key={t.id}
                  className={`${
                    i > 0 ? "border-t border-[var(--enterprise-border)]" : ""
                  } bg-[var(--enterprise-surface)]`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setExpandedTestId(expanded ? null : t.id)}
                    >
                      <p className="truncate text-sm font-medium text-[var(--enterprise-text)]">
                        {t.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                        {t.clashCount} clash{t.clashCount === 1 ? "" : "es"}
                        {t.lastRunAt ? ` · ${relativeTime(t.lastRunAt)}` : ""}
                        {delta > 0 ? (
                          <span className="text-[var(--enterprise-semantic-warning-text)]">
                            {` · +${delta} new`}
                          </span>
                        ) : null}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          t.openCount > 0 ? "enterprise-badge-warning" : "enterprise-badge-success"
                        }`}
                      >
                        {t.openCount > 0 ? `${t.openCount} open` : "Clear"}
                      </span>
                      {t.clashCount > 0 ? (
                        <button
                          type="button"
                          className="mobile-touch-target inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--enterprise-semantic-danger-text)] transition hover:bg-[var(--enterprise-semantic-danger-bg)]"
                          aria-label={`Delete clashes for ${t.name}`}
                          title="Delete clashes for this model pair"
                          onClick={() =>
                            setPendingClear({
                              kind: "test",
                              testId: t.id,
                              testName: t.name,
                              clashCount: t.clashCount,
                            })
                          }
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                          Delete
                        </button>
                      ) : null}
                      {onOpenTest ? (
                        <EnterpriseButton
                          type="button"
                          variant="soft"
                          size="sm"
                          className="mobile-touch-target px-2.5 text-xs"
                          onClick={() => onOpenTest(t.id)}
                        >
                          <PanelsTopLeft className="h-3 w-3" aria-hidden />
                          Open
                        </EnterpriseButton>
                      ) : null}
                    </div>
                  </div>
                  {expanded && samples.length > 0 ? (
                    <ul className="space-y-1 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2">
                      {samples.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition hover:bg-[var(--enterprise-hover-surface)]"
                            onClick={() => onOpenClash?.({ testId: t.id, clash: c })}
                            disabled={!onOpenClash}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-[var(--enterprise-text)]">
                                {(c.nameA ?? c.guidA.slice(0, 8)) +
                                  " × " +
                                  (c.nameB ?? c.guidB.slice(0, 8))}
                              </span>
                              <span className="text-xs text-[var(--enterprise-text-muted)]">
                                {clashTypeLabel(c.clashType)} ·{" "}
                                {formatClashDistanceDetail(c.clashType, c.distanceMm)}
                              </span>
                            </span>
                            <Crosshair
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                              aria-hidden
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {expanded && samples.length === 0 && t.openCount === 0 ? (
                    <p className="border-t border-[var(--enterprise-border)] px-3.5 py-2 text-xs text-[var(--enterprise-text-muted)]">
                      No open clashes in this test.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-md bg-[var(--enterprise-bg)] px-4 py-8 text-center ring-1 ring-[var(--enterprise-border)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--enterprise-primary-soft)]">
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
          <EnterpriseButton
            type="button"
            variant="soft"
            size="sm"
            className="mobile-touch-target"
            onClick={onReviewIn3d}
          >
            <PanelsTopLeft className="h-3.5 w-3.5" aria-hidden />
            Open viewer
          </EnterpriseButton>
        </div>
      )}

      <ClearClashesConfirmDialog
        pending={pendingClear}
        isDeleting={clearMut.isPending}
        onConfirm={() => {
          if (pendingClear) clearMut.mutate(pendingClear);
        }}
        onCancel={() => {
          if (!clearMut.isPending) setPendingClear(null);
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
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${wrap}`}
      aria-hidden
    >
      <Crosshair className="h-5 w-5" />
    </div>
  );
}
