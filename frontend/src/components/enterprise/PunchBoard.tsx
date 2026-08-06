"use client";

import { useMemo, useState } from "react";
import type { PunchRow } from "@/lib/api-client";
import {
  PUNCH_STATUS_LABEL,
  PUNCH_STATUS_ORDER,
  punchStatusBadgeClass,
} from "@/lib/issueStatusStyle";

type Props = {
  rows: PunchRow[];
  onOpen: (punch: PunchRow) => void;
  onMove: (id: string, status: string) => void;
  movingId?: string | null;
};

function assigneeLabel(p: PunchRow): string {
  const names =
    p.assignees?.map((a) => a.name?.trim()).filter((x): x is string => Boolean(x)) ?? [];
  if (names.length > 0) return names.join(", ");
  return p.assignee?.name?.trim() || "Unassigned";
}

export function PunchBoard({ rows, onOpen, onMove, movingId }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    const map: Record<string, PunchRow[]> = {};
    for (const s of PUNCH_STATUS_ORDER) map[s] = [];
    for (const r of rows) {
      const key = PUNCH_STATUS_ORDER.includes(r.status as (typeof PUNCH_STATUS_ORDER)[number])
        ? r.status
        : "OPEN";
      (map[key] ??= []).push(r);
    }
    return map;
  }, [rows]);

  return (
    <div className="enterprise-scrollbar -mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1">
      {PUNCH_STATUS_ORDER.map((status) => {
        const list = byStatus[status] ?? [];
        return (
          <section
            key={status}
            className="flex w-[min(280px,78vw)] shrink-0 flex-col rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/punch-id") || dragId;
              setDragId(null);
              if (!id) return;
              const row = rows.find((r) => r.id === id);
              if (!row || row.status === status) return;
              onMove(id, status);
            }}
          >
            <header className="flex items-center justify-between gap-2 border-b border-[var(--enterprise-border)] px-3 py-2.5">
              <h3 className="text-xs font-semibold text-[var(--enterprise-text)]">
                {PUNCH_STATUS_LABEL[status] ?? status}
              </h3>
              <span className="rounded-md bg-[var(--enterprise-surface)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--enterprise-text-muted)]">
                {list.length}
              </span>
            </header>
            <ul className="enterprise-scrollbar flex max-h-[min(52vh,520px)] flex-col gap-1.5 overflow-y-auto p-2">
              {list.length === 0 ? (
                <li className="px-2 py-6 text-center text-[11px] text-[var(--enterprise-text-muted)]">
                  Drop cards here
                </li>
              ) : (
                list.map((p) => (
                  <li key={p.id}>
                    <article
                      draggable={movingId !== p.id}
                      onDragStart={(e) => {
                        setDragId(p.id);
                        e.dataTransfer.setData("text/punch-id", p.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragId(null)}
                      className={`rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2.5 shadow-[var(--enterprise-shadow-xs)] ${
                        movingId === p.id ? "opacity-50" : "cursor-grab active:cursor-grabbing"
                      }`}
                    >
                      <button type="button" onClick={() => onOpen(p)} className="w-full text-left">
                        <p className="font-mono text-[10px] font-semibold text-[var(--enterprise-primary)]">
                          #{p.punchNumber}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-[var(--enterprise-text)]">
                          {p.title}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-[var(--enterprise-text-muted)]">
                          {p.location} · {assigneeLabel(p)}
                        </p>
                      </button>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${punchStatusBadgeClass(status)}`}
                        >
                          {PUNCH_STATUS_LABEL[status]}
                        </span>
                        <select
                          aria-label={`Move ${p.title}`}
                          value={p.status}
                          disabled={movingId === p.id}
                          onChange={(e) => {
                            if (e.target.value !== p.status) onMove(p.id, e.target.value);
                          }}
                          className="max-w-[7.5rem] rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1.5 py-1 text-[10px] font-medium text-[var(--enterprise-text)]"
                        >
                          {PUNCH_STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {PUNCH_STATUS_LABEL[s] ?? s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
