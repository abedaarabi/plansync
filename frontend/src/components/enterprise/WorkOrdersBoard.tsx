"use client";

import { useMemo, useState } from "react";
import type { IssueRow } from "@/lib/api-client";
import { ISSUE_STATUS_LABEL } from "@/lib/issueStatusStyle";
import { formatWorkOrderNumber } from "@/lib/workOrderSla";
import { WORK_ORDER_BOARD_COLUMNS, groupWorkOrdersByBoardStatus } from "@/lib/workOrdersBoard";
import { OmAssigneeAvatar } from "@/components/enterprise/OmAssigneePicker";

type Props = {
  rows: IssueRow[];
  onOpen: (wo: IssueRow) => void;
  onMove: (id: string, status: string) => void;
  movingId?: string | null;
};

export function WorkOrdersBoard({ rows, onOpen, onMove, movingId }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);

  const byStatus = useMemo(() => groupWorkOrdersByBoardStatus(rows), [rows]);

  return (
    <div className="enterprise-scrollbar -mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1">
      {WORK_ORDER_BOARD_COLUMNS.map((status) => {
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
              const id = e.dataTransfer.getData("text/wo-id") || dragId;
              setDragId(null);
              if (!id) return;
              const row = rows.find((r) => r.id === id);
              if (!row || row.status === status) return;
              onMove(id, status);
            }}
          >
            <header className="flex items-center justify-between gap-2 border-b border-[var(--enterprise-border)] px-3 py-2.5">
              <h3 className="text-xs font-semibold text-[var(--enterprise-text)]">
                {ISSUE_STATUS_LABEL[status] ?? status}
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
                list.map((wo) => (
                  <li key={wo.id}>
                    <article
                      draggable={movingId !== wo.id}
                      onDragStart={(e) => {
                        setDragId(wo.id);
                        e.dataTransfer.setData("text/wo-id", wo.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragId(null)}
                      className={`rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2.5 shadow-[var(--enterprise-shadow-xs)] ${
                        movingId === wo.id ? "opacity-50" : "cursor-grab active:cursor-grabbing"
                      }`}
                    >
                      <button type="button" onClick={() => onOpen(wo)} className="w-full text-left">
                        <p className="font-mono text-[10px] font-semibold text-[var(--enterprise-text-muted)]">
                          {formatWorkOrderNumber(wo)}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-[var(--enterprise-text)]">
                          {wo.title}
                        </p>
                        {wo.asset ? (
                          <p className="mt-1 truncate text-[10px] text-[var(--enterprise-text-muted)]">
                            <span className="font-mono text-[var(--enterprise-primary)]">
                              {wo.asset.tag}
                            </span>
                            {" · "}
                            {wo.asset.name}
                          </p>
                        ) : null}
                      </button>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <OmAssigneeAvatar member={wo.assignee ?? null} sizeClass="h-6 w-6" />
                        <select
                          aria-label={`Move ${wo.title}`}
                          value={wo.status}
                          disabled={movingId === wo.id}
                          onChange={(e) => {
                            if (e.target.value !== wo.status) onMove(wo.id, e.target.value);
                          }}
                          className="max-w-[7.5rem] rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-1.5 py-1 text-[10px] font-medium text-[var(--enterprise-text)]"
                        >
                          {WORK_ORDER_BOARD_COLUMNS.map((s) => (
                            <option key={s} value={s}>
                              {ISSUE_STATUS_LABEL[s] ?? s}
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
