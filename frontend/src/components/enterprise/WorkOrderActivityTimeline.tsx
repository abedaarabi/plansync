"use client";

import { useState } from "react";
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
import {
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import { formatOmWhen } from "@/lib/formatOmWhen";
import { qk } from "@/lib/queryKeys";

type StatusEvent = { key: string; label: string; at: string };

function statusEvents(issue: IssueRow): StatusEvent[] {
  const events: StatusEvent[] = [{ key: "created", label: "Created", at: issue.createdAt }];
  if (issue.statusChangedAt && issue.statusChangedAt !== issue.createdAt) {
    const statusLabel = ISSUE_STATUS_LABEL[issue.status] ?? issue.status;
    events.push({
      key: "status",
      label: `Status → ${statusLabel}`,
      at: issue.statusChangedAt,
    });
  }
  if (issue.resolvedAt) {
    events.push({ key: "resolved", label: "Resolved", at: issue.resolvedAt });
  }
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
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

  const events = statusEvents(issue);

  return (
    <div className={MOBILE_FORM_SECTION}>
      <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Activity</p>

      <ol className="space-y-2.5">
        {events.map((ev) => (
          <li key={ev.key} className="flex gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text-muted)]"
              aria-hidden
            >
              <CircleDot className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold text-[var(--enterprise-text)]">{ev.label}</p>
              <p className="text-[11px] text-[var(--enterprise-text-muted)]">
                {formatOmWhen(ev.at)}
              </p>
            </div>
          </li>
        ))}

        {isPending ? (
          <li className="text-sm text-[var(--enterprise-text-muted)]">Loading comments…</li>
        ) : comments.length === 0 ? (
          <li className="flex gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--enterprise-border)] text-[var(--enterprise-text-muted)]"
              aria-hidden
            >
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <p className="pt-1.5 text-sm text-[var(--enterprise-text-muted)]">
              No comments yet. Add a note below.
            </p>
          </li>
        ) : (
          comments.map((c) => {
            const authorName = c.author.name?.trim() || c.author.email || "Unknown";
            return (
              <li key={c.id} className="flex gap-2.5">
                <OmAssigneeAvatar member={c.author} sizeClass="h-8 w-8" textClass="text-[10px]" />
                <div className="min-w-0 flex-1 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/60 px-3 py-2">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-semibold text-[var(--enterprise-text)]">
                      {authorName}
                    </span>
                    <span className="text-[var(--enterprise-text-muted)]">
                      {formatOmWhen(c.createdAt)}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--enterprise-text)]">
                    {c.body}
                  </p>
                </div>
              </li>
            );
          })
        )}
      </ol>

      <div className="mt-3 border-t border-[var(--enterprise-border)]/80 pt-3">
        <label htmlFor={`wo-activity-comment-${issueId}`} className={MOBILE_FIELD_LABEL}>
          Add comment
        </label>
        <textarea
          id={`wo-activity-comment-${issueId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className={MOBILE_FIELD_TEXTAREA}
          placeholder="Update the team…"
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
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-3 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {postMut.isPending ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
