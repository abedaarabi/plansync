"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDot, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { OmAssigneeAvatar } from "@/components/enterprise/OmAssigneePicker";
import {
  createIssueComment,
  fetchIssueComments,
  formatIssueLockHint,
  ProRequiredError,
  type IssueCommentRow,
  type IssueRow,
} from "@/lib/api-client";
import { ISSUE_STATUS_LABEL } from "@/lib/issueStatusStyle";
import { MOBILE_FIELD_TEXTAREA, MOBILE_FORM_SECTION } from "@/lib/mobileFormStyles";
import { formatOmWhen } from "@/lib/formatOmWhen";
import { qk } from "@/lib/queryKeys";

type TimelineItem =
  | { kind: "system"; key: string; label: string; at: string }
  | {
      kind: "comment";
      key: string;
      at: string;
      body: string;
      author: IssueCommentRow["author"];
    };

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function buildItems(issue: IssueRow, comments: IssueCommentRow[]): TimelineItem[] {
  const items: TimelineItem[] = [
    { kind: "system", key: "created", label: "Work order created", at: issue.createdAt },
  ];
  if (issue.statusChangedAt && issue.statusChangedAt !== issue.createdAt) {
    const statusLabel = ISSUE_STATUS_LABEL[issue.status] ?? issue.status;
    items.push({
      kind: "system",
      key: "status",
      label: `Status → ${statusLabel}`,
      at: issue.statusChangedAt,
    });
  }
  if (issue.resolvedAt) {
    items.push({
      kind: "system",
      key: "resolved",
      label: "Resolved",
      at: issue.resolvedAt,
    });
  }
  for (const c of comments) {
    items.push({
      kind: "comment",
      key: c.id,
      at: c.createdAt,
      body: c.body,
      author: c.author,
    });
  }
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

type Props = {
  issue: IssueRow;
  enabled: boolean;
};

export function WorkOrderActivityTimeline({ issue, enabled }: Props) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const issueId = issue.id;

  const { data: comments = [], isPending } = useQuery({
    queryKey: qk.issueComments(issueId),
    queryFn: () => fetchIssueComments(issueId),
    enabled: enabled && Boolean(issueId),
  });

  const postMut = useMutation({
    mutationFn: (text: string) => createIssueComment(issueId, text),
    onSuccess: (row) => {
      qc.setQueryData<IssueCommentRow[]>(qk.issueComments(issueId), (old) => [
        ...(old ?? []),
        { id: row.id, body: row.body, createdAt: row.createdAt, author: row.author },
      ]);
      setBody("");
      toast.success("Comment added.");
    },
    onError: (e: Error) => {
      toast.error(
        e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e),
      );
    },
  });

  const items = useMemo(() => buildItems(issue, comments), [issue, comments]);

  const groups = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const item of items) {
      const k = dayKey(item.at);
      const list = map.get(k) ?? [];
      list.push(item);
      map.set(k, list);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className={MOBILE_FORM_SECTION}>
      <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Activity</p>

      {isPending && comments.length === 0 ? (
        <p className="text-sm text-[var(--enterprise-text-muted)]">Loading activity…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--enterprise-text-muted)]">No activity yet.</p>
      ) : (
        <div className="relative space-y-5 pl-1">
          {groups.map(([key, dayItems]) => (
            <div key={key}>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="rounded-full bg-[var(--enterprise-primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--enterprise-primary)]">
                  {dayLabel(key)}
                </span>
                <span className="h-px flex-1 bg-[var(--enterprise-border)]" aria-hidden />
              </div>
              <ol className="relative space-y-0 border-l-2 border-[var(--enterprise-primary)]/35 ml-2.5">
                {dayItems.map((item) => (
                  <li key={item.key} className="relative pb-4 pl-5 last:pb-0">
                    <span
                      className="absolute -left-[9px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--enterprise-primary)] bg-[var(--enterprise-surface)]"
                      aria-hidden
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--enterprise-primary)]" />
                    </span>
                    {item.kind === "system" ? (
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1">
                          <CircleDot
                            className="h-3.5 w-3.5 text-[var(--enterprise-primary)]"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span className="text-sm font-semibold text-[var(--enterprise-text)]">
                            {item.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                          {formatOmWhen(item.at)}
                        </p>
                      </div>
                    ) : (
                      <div className="flex gap-2.5">
                        <OmAssigneeAvatar
                          member={item.author}
                          sizeClass="h-8 w-8"
                          textClass="text-[10px]"
                        />
                        <div className="min-w-0 flex-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/70 px-3 py-2">
                          <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                            <span className="font-semibold text-[var(--enterprise-text)]">
                              {item.author.name?.trim() || item.author.email || "Unknown"}
                            </span>
                            <span className="text-[var(--enterprise-text-muted)]">
                              {formatOmWhen(item.at)}
                            </span>
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--enterprise-text)]">
                            {item.body}
                          </p>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-[var(--enterprise-border)]/80 pt-3">
        <div className="flex items-start gap-2">
          <span
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]"
            aria-hidden
          >
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <label htmlFor={`wo-activity-comment-${issueId}`} className="sr-only">
              Add comment
            </label>
            <textarea
              id={`wo-activity-comment-${issueId}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className={MOBILE_FIELD_TEXTAREA}
              placeholder="Add a comment…"
              disabled={postMut.isPending}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                disabled={!body.trim() || postMut.isPending}
                onClick={() => {
                  const text = body.trim();
                  if (text) postMut.mutate(text);
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-[var(--enterprise-primary)] px-3 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {postMut.isPending ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
