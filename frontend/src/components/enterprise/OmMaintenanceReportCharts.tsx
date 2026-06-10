"use client";

import { useMemo } from "react";
import { OmSectionCard } from "@/components/enterprise/OmSectionCard";
import type { OmMaintenanceReport } from "@/lib/api-client";
import { ISSUE_PRIORITY_LABEL, ISSUE_PRIORITY_ORDER } from "@/lib/issueStatusStyle";

const PRIORITY_FILL: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#2563eb",
  HIGH: "#dc2626",
};

type Segment = { key: string; label: string; value: number; fill: string };

function formatWeekLabel(iso: string): string {
  try {
    const d = new Date(`${iso}T12:00:00Z`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-4 py-8 text-center text-xs text-[var(--enterprise-text-muted)]">
      {message}
    </div>
  );
}

function StackedBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <ChartEmpty message="No open work orders in backlog." />;
  return (
    <div>
      <div
        className="w-full rounded-lg bg-[var(--enterprise-bg)] p-px ring-1 ring-[var(--enterprise-border)]/80"
        role="img"
        aria-label={`Backlog by priority, ${total} total`}
      >
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-md sm:h-3.5">
          {segments.map((s) => (
            <div
              key={s.key}
              className="min-h-full min-w-1 rounded-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
              style={{ flexGrow: Math.max(s.value, 0.001), backgroundColor: s.fill }}
              title={`${s.label}: ${s.value}`}
            />
          ))}
        </div>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-[var(--enterprise-text-muted)] sm:text-[11px]">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/5"
              style={{ backgroundColor: s.fill }}
              aria-hidden
            />
            <span>
              {s.label}{" "}
              <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
                {s.value}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PmComplianceDonut({ onTime, late, pct }: { onTime: number; late: number; pct: number }) {
  const total = onTime + late;
  const segments: Segment[] = [
    {
      key: "on-time",
      label: "On time",
      value: onTime,
      fill: "var(--enterprise-semantic-success-text)",
    },
    {
      key: "late",
      label: "Late",
      value: late,
      fill: "var(--enterprise-semantic-warning-text)",
    },
  ];

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]"
          aria-hidden
        >
          <span className="text-xl font-bold tabular-nums text-[var(--enterprise-text)]">—</span>
        </div>
        <p className="text-xs text-[var(--enterprise-text-muted)]">
          No PM completions recorded yet.
        </p>
      </div>
    );
  }

  const r = 36;
  const cx = 50;
  const cy = 50;
  const stroke = 14;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="h-28 w-28 sm:h-32 sm:w-32"
          role="img"
          aria-label={`PM on-time ${pct}%`}
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--enterprise-border)"
            strokeWidth={stroke}
            opacity={0.35}
          />
          {segments.map((s) => {
            if (s.value <= 0) return null;
            const len = (s.value / total) * circumference;
            const el = (
              <circle
                key={s.key}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.fill}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-[var(--enterprise-text)]">
            {pct}%
          </span>
          <span className="text-[10px] font-medium text-[var(--enterprise-text-muted)]">
            on-time
          </span>
        </div>
      </div>
      <ul className="space-y-2 text-xs">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-[var(--enterprise-text-muted)]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.fill }}
                aria-hidden
              />
              {s.label}
            </span>
            <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
              {s.value}
            </span>
          </li>
        ))}
        <li className="border-t border-[var(--enterprise-border)]/80 pt-2 text-[var(--enterprise-text-muted)]">
          <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">{total}</span>{" "}
          completions
        </li>
      </ul>
    </div>
  );
}

function WeeklyCountBars({ weeks }: { weeks: OmMaintenanceReport["completedByWeek"] }) {
  const maxCount = Math.max(...weeks.map((w) => w.count), 0);
  if (maxCount <= 0) {
    return <ChartEmpty message="No completed work orders in the last 8 weeks." />;
  }

  return (
    <div className="flex h-36 items-end justify-between gap-1.5 sm:h-40 sm:gap-2">
      {weeks.map((w) => {
        const pct = w.count > 0 ? Math.max(8, Math.round((w.count / maxCount) * 100)) : 0;
        return (
          <div key={w.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold tabular-nums text-[var(--enterprise-text)]">
              {w.count > 0 ? w.count : ""}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md bg-[var(--enterprise-primary)] transition-[height] duration-200"
                style={{ height: `${pct}%` }}
                title={`${formatWeekLabel(w.weekStart)}: ${w.count} completed`}
              />
            </div>
            <span className="max-w-full truncate text-[9px] text-[var(--enterprise-text-muted)] sm:text-[10px]">
              {formatWeekLabel(w.weekStart)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WeeklyCostBars({ weeks }: { weeks: OmMaintenanceReport["completedByWeek"] }) {
  const maxCost = Math.max(...weeks.map((w) => w.partsCost), 0);
  if (maxCost <= 0) {
    return <ChartEmpty message="No parts costs in the last 8 weeks." />;
  }

  return (
    <div className="flex h-36 items-end justify-between gap-1.5 sm:h-40 sm:gap-2">
      {weeks.map((w) => {
        const pct = Math.max(4, Math.round((w.partsCost / maxCost) * 100));
        return (
          <div key={w.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
              {w.partsCost > 0
                ? `$${w.partsCost >= 1000 ? `${(w.partsCost / 1000).toFixed(1)}k` : w.partsCost.toFixed(0)}`
                : ""}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md bg-[var(--enterprise-primary)]/85 transition-[height] duration-200"
                style={{ height: `${pct}%` }}
                title={`${formatWeekLabel(w.weekStart)}: $${w.partsCost.toFixed(2)}`}
              />
            </div>
            <span className="max-w-full truncate text-[9px] text-[var(--enterprise-text-muted)] sm:text-[10px]">
              {formatWeekLabel(w.weekStart)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AssetCostBars({ assets }: { assets: OmMaintenanceReport["topAssetsByCost"] }) {
  const top = assets.slice(0, 6);
  const max = Math.max(...top.map((a) => a.cost), 0);
  if (max <= 0) return <ChartEmpty message="No asset parts spend recorded." />;

  return (
    <div className="space-y-2.5">
      {top.map((a, idx) => {
        const pct = Math.max(6, Math.round((a.cost / max) * 100));
        return (
          <div key={a.tag} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-[var(--enterprise-text)]">
                <span className="font-mono font-semibold text-[var(--enterprise-primary)]">
                  {a.tag}
                </span>
                <span className="text-[var(--enterprise-text-muted)]"> · </span>
                {a.name}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-[var(--enterprise-text)]">
                ${a.cost.toFixed(2)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--enterprise-bg)] ring-1 ring-[var(--enterprise-border)]/60">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${pct}%`,
                  backgroundColor:
                    idx === 0
                      ? "var(--enterprise-primary)"
                      : `color-mix(in srgb, var(--enterprise-primary) ${88 - idx * 12}%, var(--enterprise-border))`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Props = { report: OmMaintenanceReport };

export function OmMaintenanceReportCharts({ report }: Props) {
  const backlogSegments = useMemo(() => {
    const map = new Map(report.backlogByPriority.map((b) => [b.priority, b.count]));
    return ISSUE_PRIORITY_ORDER.map((key) => ({
      key,
      label: ISSUE_PRIORITY_LABEL[key] ?? key,
      value: map.get(key) ?? 0,
      fill: PRIORITY_FILL[key] ?? "#94a3b8",
    })).filter((s) => s.value > 0);
  }, [report.backlogByPriority]);

  const trendTotal = report.completedByWeek.reduce((a, w) => a + w.count, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OmSectionCard
        title="Completions trend"
        description="Resolved work orders per week (last 8 weeks)."
      >
        {trendTotal === 0 ? (
          <ChartEmpty message="No completed work orders in the last 8 weeks." />
        ) : (
          <WeeklyCountBars weeks={report.completedByWeek} />
        )}
      </OmSectionCard>

      <OmSectionCard
        title="PM compliance"
        description="Preventive maintenance completed on or before due date."
      >
        <PmComplianceDonut
          onTime={report.pmCompletionsOnTime}
          late={report.pmCompletionsLate}
          pct={report.pmCompliancePct}
        />
      </OmSectionCard>

      <OmSectionCard title="Parts spend by week" description="Parts cost on resolved work orders.">
        <WeeklyCostBars weeks={report.completedByWeek} />
      </OmSectionCard>

      <OmSectionCard
        title="Top assets by cost"
        description="Highest parts spend on resolved orders."
      >
        <AssetCostBars assets={report.topAssetsByCost} />
      </OmSectionCard>

      <OmSectionCard
        title="Backlog by priority"
        description={`${report.backlog.length} open work order${report.backlog.length === 1 ? "" : "s"} in queue`}
        action={
          report.backlog.filter((b) => b.overdue).length > 0 ? (
            <span className="inline-flex items-center rounded-full border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--enterprise-semantic-danger-text)]">
              {report.backlog.filter((b) => b.overdue).length} overdue
            </span>
          ) : null
        }
      >
        <StackedBar segments={backlogSegments} />
      </OmSectionCard>

      <OmSectionCard
        title="Labor hours by week"
        description="Technician time logged on completions."
      >
        <LaborHoursBars weeks={report.completedByWeek} />
      </OmSectionCard>
    </div>
  );
}

function LaborHoursBars({ weeks }: { weeks: OmMaintenanceReport["completedByWeek"] }) {
  const maxHours = Math.max(...weeks.map((w) => w.laborHours), 0);
  if (maxHours <= 0) {
    return <ChartEmpty message="No labor hours logged in the last 8 weeks." />;
  }

  return (
    <div className="space-y-2">
      {weeks.map((w) => {
        const pct = Math.max(w.laborHours > 0 ? 4 : 0, Math.round((w.laborHours / maxHours) * 100));
        return (
          <div key={w.weekStart} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-[10px] tabular-nums text-[var(--enterprise-text-muted)] sm:w-16 sm:text-[11px]">
              {formatWeekLabel(w.weekStart)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="h-2.5 overflow-hidden rounded-full bg-[var(--enterprise-bg)] ring-1 ring-[var(--enterprise-border)]/60">
                <div
                  className="h-full rounded-full bg-[var(--enterprise-semantic-info-text)]/90"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[var(--enterprise-text)]">
              {w.laborHours > 0 ? `${w.laborHours}h` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
