"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import {
  createIssueComment,
  fetchIssueComments,
  type IssueCommentRow,
  type IssueRow,
} from "@/lib/api-client/core-issues-takeoff";
import { issueDisplayCode } from "@/lib/bim/bimIssueMarkerUtils";

// fallow-ignore-next-line complexity
export function BimIssueCommentDialog(props: {
  open: boolean;
  issue: IssueRow | null;
  onClose: () => void;
  onCommentAdded?: (issueId: string, commentCount: number) => void;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<IssueCommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const issue = props.issue;

  useEffect(() => {
    if (!props.open || !issue) {
      setComments([]);
      return;
    }
    let cancelled = false;
    setLoadingComments(true);
    void fetchIssueComments(issue.id)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.open, issue]);

  const submit = () => {
    if (!issue) return;
    const text = body.trim();
    if (!text) {
      toast.error("Enter a comment.");
      return;
    }
    setSubmitting(true);
    void createIssueComment(issue.id, text)
      .then((row) => {
        toast.success("Comment added.");
        setBody("");
        setComments((prev) => [
          ...prev,
          { id: row.id, body: row.body, createdAt: row.createdAt, author: row.author },
        ]);
        props.onCommentAdded?.(issue.id, row.commentCount);
        props.onClose();
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not add comment."))
      .finally(() => setSubmitting(false));
  };

  return (
    <EnterpriseResponsiveDialog
      open={props.open}
      onClose={() => {
        if (submitting) return;
        setBody("");
        props.onClose();
      }}
      variant="viewer-dark"
      ariaLabelledBy="bim-issue-comment-title"
      panelClassName="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            disabled={submitting}
            className="bim-btn-secondary px-3 py-1.5 text-[12px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !body.trim()}
            className="bim-btn-primary px-3 py-1.5 text-[12px]"
          >
            {submitting ? "Saving…" : "Add comment"}
          </button>
        </div>
      }
    >
      <h2 id="bim-issue-comment-title" className="text-sm font-semibold text-white">
        Add comment
      </h2>
      {issue ? (
        <p className="mt-1 text-[11px] text-slate-400">
          {issueDisplayCode(issue)} · {issue.title}
        </p>
      ) : null}
      {loadingComments ? (
        <p className="mt-3 text-[11px] text-slate-500">Loading comments…</p>
      ) : comments.length > 0 ? (
        <ul className="mt-3 max-h-32 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/50 p-2">
          {comments.map((comment) => (
            <li key={comment.id} className="text-[11px] leading-relaxed text-slate-300">
              <span className="font-medium text-slate-200">{comment.author.name ?? "Unknown"}</span>
              <span className="text-slate-500"> · {comment.body}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Write a comment…"
        className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-[13px] text-white outline-none focus:border-[var(--bim-accent)]"
      />
    </EnterpriseResponsiveDialog>
  );
}
