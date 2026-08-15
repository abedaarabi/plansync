"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { IssueRow, PunchRow, RfiRow } from "@/lib/api-client";
import {
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueStatusDotSolidFill,
  PUNCH_STATUS_LABEL,
  PUNCH_STATUS_ORDER,
  RFI_STATUS_LABEL,
} from "@/lib/issueStatusStyle";

type BarSegment = { key: string; label: string; count: number; fill: string };

const NEUTRAL_FILL = "var(--enterprise-chart-5)";

const PUNCH_FILL: Record<string, string> = {
  OPEN: "var(--enterprise-error)",
  IN_PROGRESS: "var(--enterprise-warning)",
  READY_FOR_GC: "var(--enterprise-chart-1)",
  CLOSED: NEUTRAL_FILL,
};

const RFI_ORDER = ["OPEN", "IN_REVIEW", "ANSWERED", "CLOSED"] as const;
const RFI_FILL: Record<string, string> = {
  OPEN: "var(--enterprise-chart-1)",
  IN_REVIEW: "var(--enterprise-warning)",
  ANSWERED: "var(--enterprise-success)",
  CLOSED: NEUTRAL_FILL,
};

const ISSUE_ORDER_SET = new Set<string>(ISSUE_STATUS_ORDER);

function issueSegments(issues: IssueRow[]): BarSegment[] {
  const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "_");
  const map = new Map<string, number>();
  for (const r of issues) {
    const k = norm(r.status);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const out: BarSegment[] = [];
  for (const key of ISSUE_STATUS_ORDER) {
    const count = map.get(key) ?? 0;
    if (count === 0) continue;
    out.push({
      key,
      label: ISSUE_STATUS_LABEL[key] ?? key,
      count,
      fill: issueStatusDotSolidFill(key),
    });
  }
  let other = 0;
  for (const [k, n] of map) {
    if (!ISSUE_ORDER_SET.has(k)) other += n;
  }
  if (other > 0) {
    out.push({ key: "OTHER", label: "Other", count: other, fill: NEUTRAL_FILL });
  }
  return out;
}

function punchSegments(rows: PunchRow[]): BarSegment[] {
  const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "_");
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = norm(r.status);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const out: BarSegment[] = [];
  for (const key of PUNCH_STATUS_ORDER) {
    const count = map.get(key) ?? 0;
    if (count === 0) continue;
    out.push({
      key,
      label: PUNCH_STATUS_LABEL[key] ?? key,
      count,
      fill: PUNCH_FILL[key] ?? NEUTRAL_FILL,
    });
  }
  const punchSet = new Set<string>(PUNCH_STATUS_ORDER);
  let other = 0;
  for (const [k, n] of map) {
    if (!punchSet.has(k)) other += n;
  }
  if (other > 0) {
    out.push({ key: "OTHER", label: "Other", count: other, fill: NEUTRAL_FILL });
  }
  return out;
}

function rfiSegments(rows: RfiRow[]): BarSegment[] {
  const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "_");
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = norm(r.status);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const out: BarSegment[] = [];
  for (const key of RFI_ORDER) {
    const count = map.get(key) ?? 0;
    if (count === 0) continue;
    out.push({
      key,
      label: RFI_STATUS_LABEL[key] ?? key,
      count,
      fill: RFI_FILL[key] ?? NEUTRAL_FILL,
    });
  }
  const rfiSet = new Set<string>(RFI_ORDER);
  let other = 0;
  for (const [k, n] of map) {
    if (!rfiSet.has(k)) other += n;
  }
  if (other > 0) {
    out.push({ key: "OTHER", label: "Other", count: other, fill: NEUTRAL_FILL });
  }
  return out;
}

function StackedBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((a, s) => a + s.count, 0);
  if (total === 0) {
    return (
      <div
        className="flex h-7 w-full items-center justify-center rounded-md border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 text-xs text-[var(--enterprise-text-muted)]"
        aria-hidden
      >
        No data
      </div>
    );
  }
  return (
    <div
      className="w-full rounded-md bg-[var(--enterprise-bg)] p-px ring-1 ring-[var(--enterprise-border)]/80"
      role="img"
      aria-label={`Status distribution, ${total} total`}
    >
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-[5px] sm:h-3">
        {segments.map((s) => (
          <div
            key={s.key}
            className="min-h-full min-w-1 rounded-sm first:rounded-l-sm last:rounded-sm"
            style={{
              flexGrow: Math.max(s.count, 0.001),
              backgroundColor: s.fill,
            }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
    </div>
  );
}

type Props = {
  projectId: string;
  issues: IssueRow[];
  punchItems: PunchRow[];
  rfis: RfiRow[];
};

export function ProjectHomeOverviewCharts({ projectId, issues, punchItems, rfis }: Props) {
  const issueSeg = useMemo(() => issueSegments(issues), [issues]);
  const punchSeg = useMemo(() => punchSegments(punchItems), [punchItems]);
  const rfiSeg = useMemo(() => rfiSegments(rfis), [rfis]);

  const cards: {
    title: string;
    href: string;
    segments: BarSegment[];
    emptyHint: string;
  }[] = [
    {
      title: "Issues by status",
      href: `/projects/${projectId}/issues`,
      segments: issueSeg,
      emptyHint: "No issues on this project yet.",
    },
    {
      title: "Punch by status",
      href: `/projects/${projectId}/punch`,
      segments: punchSeg,
      emptyHint: "No punch items yet.",
    },
    {
      title: "RFIs by status",
      href: `/projects/${projectId}/rfi`,
      segments: rfiSeg,
      emptyHint: "No RFIs yet.",
    },
  ];

  return (
    <section className="enterprise-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-0">
      <div className="flex flex-col gap-0.5 border-b border-[var(--enterprise-border)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Project overview</h2>
          <p className="enterprise-type-caption mt-0.5">
            Live counts from issues, punch list, and RFIs
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-0 p-3.5 sm:p-4">
        {cards.map((c) => {
          const total = c.segments.reduce((a, s) => a + s.count, 0);
          return (
            <div
              key={c.title}
              className="min-w-0 border-b border-[var(--enterprise-border)] py-3.5 first:pt-0 last:border-b-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">{c.title}</h3>
                  {c.segments.length > 0 ? (
                    <p className="mt-0.5 text-xs tabular-nums text-[var(--enterprise-text-muted)]">
                      <span className="font-semibold text-[var(--enterprise-text)]">{total}</span>{" "}
                      total
                    </p>
                  ) : null}
                </div>
                <Link
                  href={c.href}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)] hover:underline"
                >
                  Open
                </Link>
              </div>
              <div className="mt-2.5">
                {c.segments.length > 0 ? (
                  <StackedBar segments={c.segments} />
                ) : (
                  <p className="text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                    {c.emptyHint}
                  </p>
                )}
              </div>
              {c.segments.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-[var(--enterprise-text-muted)]">
                  {c.segments.map((s) => (
                    <li key={s.key} className="flex min-w-0 max-w-full items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm ring-1 ring-black/5"
                        style={{ backgroundColor: s.fill }}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">
                        {s.label}{" "}
                        <span className="tabular-nums font-semibold text-[var(--enterprise-text)]">
                          {s.count}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
