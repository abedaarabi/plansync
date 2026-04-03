"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
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
        className="flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[11px] text-[var(--enterprise-text-muted)]"
        aria-hidden
      >
        No data
      </div>
    );
  }
  const rects: ReactNode[] = [];
  let xAcc = 0;
  for (const s of segments) {
    const w = (s.count / total) * 100;
    rects.push(
      <rect
        key={s.key}
        x={xAcc}
        y={0}
        width={Math.max(w, 0.2)}
        height={8}
        fill={s.fill}
        rx={0.5}
      />,
    );
    xAcc += w;
  }
  return (
    <svg
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      className="h-9 w-full overflow-hidden rounded-md"
      role="img"
      aria-label={`Distribution, ${total} total`}
    >
      {rects}
    </svg>
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
    <section
      className="border border-[#E2E8F0] bg-white p-5 sm:p-6"
      style={{
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
          Project overview
        </h2>
        <p className="text-[11px] text-[#94A3B8]">Counts from issues, punch, and RFIs</p>
      </div>
      <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#0F172A]">{c.title}</h3>
              <Link
                href={c.href}
                className="shrink-0 text-[12px] font-semibold text-[#2563EB] hover:underline"
              >
                View
              </Link>
            </div>
            <div className="mt-3">
              {c.segments.length > 0 ? (
                <StackedBar segments={c.segments} />
              ) : (
                <p className="text-[13px] text-[#64748B]">{c.emptyHint}</p>
              )}
            </div>
            {c.segments.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-[#64748B]">
                {c.segments.map((s) => (
                  <li key={s.key} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: s.fill }}
                      aria-hidden
                    />
                    <span>
                      {s.label} <span className="tabular-nums text-[#0F172A]">({s.count})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
