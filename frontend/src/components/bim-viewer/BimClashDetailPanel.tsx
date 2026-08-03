"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquarePlus, TicketPlus, Trash2 } from "lucide-react";
import type { BimClashCommentRow, BimClashRow } from "@/lib/api-client/bim-clash";
import { createClashComment, fetchClashComments, patchClash } from "@/lib/api-client/bim-clash";
import type { BimClashStatus } from "@plansync/shared/bimClashTypes";
import { clashElementLabel } from "@/lib/bim/clash/clashLabels";
import {
  CLASH_ITEM1_COLOR,
  CLASH_ITEM2_COLOR,
  clashStatusLabel,
  clashTypeLabel,
  formatClashDistanceDetail,
} from "@/lib/bim/clash/clashStatusStyle";
import { toast } from "sonner";

const STATUSES: BimClashStatus[] = ["NEW", "ACTIVE", "RESOLVED", "IGNORED"];

export function BimClashDetailPanel(props: {
  clash: BimClashRow;
  onUpdated: (clash: BimClashRow) => void;
  onCreateIssue: (clash: BimClashRow) => void;
  onDelete?: () => void;
  onInspectItem?: (item: "a" | "b") => void;
  creatingIssue?: boolean;
}) {
  const [comments, setComments] = useState<BimClashCommentRow[]>([]);
  const [body, setBody] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingComments(true);
    void fetchClashComments(props.clash.id)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load comments");
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.clash.id]);

  async function setStatus(status: BimClashStatus) {
    if (status === props.clash.status) return;
    setSaving(true);
    try {
      const updated = await patchClash(props.clash.id, { status });
      props.onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setSaving(false);
    }
  }

  async function submitComment() {
    const text = body.trim();
    if (!text) return;
    setSaving(true);
    try {
      const created = await createClashComment(props.clash.id, text);
      setComments((prev) => [...prev, created]);
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add comment");
    } finally {
      setSaving(false);
    }
  }

  const nameA = clashElementLabel(props.clash.elementA, props.clash.guidA);
  const nameB = clashElementLabel(props.clash.elementB, props.clash.guidB);
  const typeA = (props.clash.elementA?.ifcType ?? "Element").replace(/^Ifc/, "");
  const typeB = (props.clash.elementB?.ifcType ?? "Element").replace(/^Ifc/, "");

  return (
    <div className="space-y-3 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="bim-clash-pill" data-status={props.clash.status}>
          {clashStatusLabel(props.clash.status)}
        </span>
        <span className="rounded-md bg-[var(--bim-hover)] px-1.5 py-0.5 font-medium text-[var(--bim-text)]">
          {clashTypeLabel(props.clash.clashType)}
        </span>
        <span className="tabular-nums font-medium text-[var(--bim-text)]">
          {formatClashDistanceDetail(props.clash.clashType, props.clash.distanceMm)}
        </span>
      </div>

      <div className="space-y-1">
        <p className="bim-section-title">Elements</p>
        <div className="space-y-1">
          <button
            type="button"
            className="bim-focus-ring flex w-full items-start gap-2 rounded-md bg-[var(--bim-hover)] px-2 py-2 text-left hover:brightness-110"
            onClick={() => props.onInspectItem?.("a")}
          >
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ background: CLASH_ITEM1_COLOR }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-[var(--bim-text)]">{nameA}</p>
              <p className="truncate text-[10px] text-[var(--bim-text-muted)]">
                {typeA} · View properties
              </p>
            </div>
          </button>
          <button
            type="button"
            className="bim-focus-ring flex w-full items-start gap-2 rounded-md bg-[var(--bim-hover)] px-2 py-2 text-left hover:brightness-110"
            onClick={() => props.onInspectItem?.("b")}
          >
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ background: CLASH_ITEM2_COLOR }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-[var(--bim-text)]">{nameB}</p>
              <p className="truncate text-[10px] text-[var(--bim-text-muted)]">
                {typeB} · View properties
              </p>
            </div>
          </button>
        </div>
      </div>

      <div>
        <p className="bim-section-title mb-1.5">Status</p>
        <div className="bim-segment">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className="bim-segment-btn"
              data-active={props.clash.status === s ? "true" : undefined}
              disabled={saving}
              onClick={() => void setStatus(s)}
            >
              {clashStatusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          className="bim-btn-secondary bim-focus-ring flex min-h-9 w-full items-center justify-center gap-1.5 px-2.5 text-[11px]"
          disabled={props.creatingIssue || Boolean(props.clash.issueId)}
          onClick={() => props.onCreateIssue(props.clash)}
        >
          {props.creatingIssue ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <TicketPlus className="h-3.5 w-3.5" />
          )}
          {props.clash.issueId ? "Issue linked" : "Create issue"}
        </button>
        {props.onDelete ? (
          <button
            type="button"
            className="bim-focus-ring flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-[var(--bim-danger)] hover:bg-[var(--bim-hover)]"
            onClick={props.onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete clash
          </button>
        ) : null}
      </div>

      <div>
        <p className="bim-section-title mb-1.5">Comments</p>
        {loadingComments ? (
          <p className="text-[10px] text-[var(--bim-text-muted)]">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-[10px] text-[var(--bim-text-muted)]">No comments yet</p>
        ) : (
          <ul className="max-h-40 space-y-2 overflow-y-auto">
            {comments.map((cm) => (
              <li key={cm.id} className="rounded-md bg-[var(--bim-hover)] px-2 py-1.5">
                <p className="text-[10px] font-medium text-[var(--bim-text)]">{cm.author.name}</p>
                <p className="text-[11px] text-[var(--bim-text-muted)]">{cm.body}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-1.5">
          <input
            className="bim-select min-h-9 flex-1 text-[11px]"
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitComment();
            }}
          />
          <button
            type="button"
            className="bim-btn-primary bim-focus-ring inline-flex h-9 w-9 items-center justify-center"
            aria-label="Post comment"
            disabled={saving || !body.trim()}
            onClick={() => void submitComment()}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
