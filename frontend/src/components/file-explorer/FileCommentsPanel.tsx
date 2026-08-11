"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MessageSquare, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteFileComment,
  fetchFileComments,
  patchFileComment,
  postFileComment,
} from "@/lib/api-client/files-comments";
import { qk } from "@/lib/queryKeys";

type Props = {
  projectId: string;
  fileId: string;
  fileVersionId?: string | null;
  currentUserId?: string;
};

function fromNow(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function FileCommentsPanel({ projectId, fileId, fileVersionId, currentUserId }: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const key = qk.projectFileComments(projectId, fileId, fileVersionId ?? null);
  const { data, isPending } = useQuery({
    queryKey: key,
    queryFn: () => fetchFileComments(projectId, fileId, fileVersionId),
    enabled: Boolean(projectId && fileId),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    // File comment badges are derived from project list/file caches.
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
    await queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
  };

  const createMutation = useMutation({
    mutationFn: (body: string) => postFileComment(projectId, fileId, body, fileVersionId),
    onSuccess: async () => {
      setDraft("");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patchMutation = useMutation({
    mutationFn: ({
      commentId,
      patch,
    }: {
      commentId: string;
      patch: { body?: string; resolved?: boolean };
    }) => patchFileComment(projectId, fileId, commentId, patch),
    onSuccess: async () => {
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteFileComment(projectId, fileId, commentId),
    onSuccess: async () => {
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const comments = showResolved
    ? (data?.comments ?? [])
    : (data?.comments ?? []).filter((item) => !item.resolvedAt);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3">
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Add comment
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a file comment..."
            className="min-h-24 flex-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]"
          />
          <button
            type="button"
            onClick={() => createMutation.mutate(draft.trim())}
            disabled={createMutation.isPending || draft.trim().length === 0}
            className="h-fit rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowResolved((value) => !value)}
        className="self-start inline-flex items-center gap-1 text-xs font-medium text-[var(--enterprise-primary)]"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        {showResolved ? "Hide resolved" : "Show resolved"}
      </button>

      <div className="enterprise-scrollbar min-h-0 max-h-[48dvh] flex-1 overflow-y-auto rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2">
        {isPending ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-[var(--enterprise-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <p className="inline-flex items-center gap-1.5 px-3 py-4 text-sm text-[var(--enterprise-text-muted)]">
            <MessageSquare className="h-4 w-4" aria-hidden />
            No comments yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--enterprise-text)]">
                    {comment.author.name || comment.author.email}
                  </p>
                  <p className="text-xs text-[var(--enterprise-text-muted)]">
                    {fromNow(comment.createdAt)}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--enterprise-text)]">
                  {comment.body}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {!comment.resolvedAt ? (
                    <button
                      type="button"
                      onClick={() =>
                        patchMutation.mutate({ commentId: comment.id, patch: { resolved: true } })
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--enterprise-border)] px-2 py-1 text-xs text-[var(--enterprise-text-muted)]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Resolve
                    </button>
                  ) : null}
                  {currentUserId && comment.author.id === currentUserId ? (
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(comment.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--enterprise-border)] px-2 py-1 text-xs text-[var(--enterprise-text-muted)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
