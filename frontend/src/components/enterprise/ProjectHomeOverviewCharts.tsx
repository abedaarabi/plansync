"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { IssueRow, PunchRow, RfiRow } from "@/lib/api-client";
import {
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueStatusDotSolidFill,
} from "@/lib/issueStatusStyle";

type BarSegment = { key: string; label: string; count: number; fill: string };

const PUNCH_ORDER = ["OPEN", "IN_PROGRESS", "READY_FOR_GC", "CLOSED"] as const;
const PUNCH_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  READY_FOR_GC: "Ready for GC",
  CLOSED: "Closed",
};
const PUNCH_FILL: Record<string, string> = {
  OPEN: "#dc2626",
  IN_PROGRESS: "#d97706",
  READY_FOR_GC: "#2563eb",
  CLOSED: "#64748b",
};

const RFI_ORDER = ["OPEN", "IN_REVIEW", "ANSWERED", "CLOSED"] as const;
const RFI_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_REVIEW: "In review",
  ANSWERED: "Answered",
  CLOSED: "Closed",
};
const RFI_FILL: Record<string, string> = {
  OPEN: "#2563eb",
  IN_REVIEW: "#d97706",
  ANSWERED: "#059669",
  CLOSED: "#64748b",
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
    out.push({ key: "OTHER", label: "Other", count: other, fill: "#94a3b8" });
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
  for (const key of PUNCH_ORDER) {
    const count = map.get(key) ?? 0;
    if (count === 0) continue;
    out.push({
      key,
      label: PUNCH_LABEL[key] ?? key,
      count,
      fill: PUNCH_FILL[key] ?? "#94a3b8",
    });
  }
  const punchSet = new Set<string>(PUNCH_ORDER);
  let other = 0;
  for (const [k, n] of map) {
    if (!punchSet.has(k)) other += n;
  }
  if (other > 0) {
    out.push({ key: "OTHER", label: "Other", count: other, fill: "#cbd5e1" });
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
      label: RFI_LABEL[key] ?? key,
      count,
      fill: RFI_FILL[key] ?? "#94a3b8",
    });
  }
  const rfiSet = new Set<string>(RFI_ORDER);
  let other = 0;
  for (const [k, n] of map) {
    if (!rfiSet.has(k)) other += n;
  }
  if (other > 0) {
    out.push({ key: "OTHER", label: "Other", count: other, fill: "#cbd5e1" });
  }
  return out;
}

function StackedBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((a, s) => a + s.count, 0);
  if (total === 0) {
    return (
      <div
        className="flex h-7 w-full items-center justify-center rounded-lg border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 text-[10px] text-[var(--enterprise-text-muted)]"
        aria-hidden
      >
        No data
      </div>
    );
  }
  return (
    <div
      className="w-full rounded-lg bg-[var(--enterprise-bg)] p-px ring-1 ring-[var(--enterprise-border)]/80"
      role="img"
      aria-label={`Status distribution, ${total} total`}
    >
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-md sm:h-3">
        {segments.map((s) => (
          <div
            key={s.key}
            className="min-h-full min-w-1 rounded-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-[flex-grow] duration-200 first:rounded-l-sm last:rounded-sm sm:first:rounded-md sm:last:rounded-md"
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
    <section className="enterprise-card flex h-full min-h-0 min-w-0 flex-col p-4 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
          Project overview
        </h2>
        <p className="text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
          Live counts from issues, punch list, and RFIs
        </p>
      </div>
      <div className="mt-5 flex flex-1 flex-col">
        {cards.map((c) => {
          const total = c.segments.reduce((a, s) => a + s.count, 0);
          return (
            <div
              key={c.title}
              className="min-w-0 border-b border-[var(--enterprise-border)] pb-4 last:border-b-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">{c.title}</h3>
                  {c.segments.length > 0 ? (
                    <p className="mt-0.5 text-[11px] tabular-nums text-[var(--enterprise-text-muted)]">
                      <span className="font-semibold text-[var(--enterprise-text)]">{total}</span>{" "}
                      total
                    </p>
                  ) : null}
                </div>
                <Link
                  href={c.href}
                  className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)] hover:underline"
                >
                  Open
                </Link>
              </div>
              <div className="mt-2">
                {c.segments.length > 0 ? (
                  <StackedBar segments={c.segments} />
                ) : (
                  <p className="text-[12px] leading-relaxed text-[var(--enterprise-text-muted)]">
                    {c.emptyHint}
                  </p>
                )}
              </div>
              {c.segments.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-[var(--enterprise-text-muted)] sm:text-[11px]">
                  {c.segments.map((s) => (
                    <li key={s.key} className="flex min-w-0 max-w-full items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/5"
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
