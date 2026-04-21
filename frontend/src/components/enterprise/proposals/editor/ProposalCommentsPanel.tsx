"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteProposalComment,
  fetchProposalComments,
  patchProposalComment,
  postProposalComment,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

type Props = {
  projectId: string;
  proposalId: string;
  currentUserId?: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function ProposalCommentsPanel({ projectId, proposalId, currentUserId }: Props) {
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: qk.projectProposalComments(projectId, proposalId),
    queryFn: () => fetchProposalComments(projectId, proposalId),
    enabled: Boolean(projectId && proposalId),
  });

  const postMut = useMutation({
    mutationFn: (body: string) => postProposalComment(projectId, proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectProposalComments(projectId, proposalId) });
      setNewComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      patchProposalComment(projectId, proposalId, id, { resolved }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectProposalComments(projectId, proposalId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProposalComment(projectId, proposalId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectProposalComments(projectId, proposalId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allComments = data?.comments ?? [];
  const openComments = allComments.filter((c) => !c.resolvedAt);
  const resolvedComments = allComments.filter((c) => c.resolvedAt);
  const visibleComments = showResolved ? allComments : openComments;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add an internal note…"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              const text = newComment.trim();
              if (text) postMut.mutate(text);
            }
          }}
        />
        <button
          type="button"
          disabled={!newComment.trim() || postMut.isPending}
          onClick={() => {
            const text = newComment.trim();
            if (text) postMut.mutate(text);
          }}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-50"
          aria-label="Post comment"
        >
          {postMut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>

      {resolvedComments.length > 0 && (
        <button
          type="button"
          onClick={() => setShowResolved((s) => !s)}
          className="self-start text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          {showResolved
            ? "Hide resolved"
            : `Show ${resolvedComments.length} resolved comment${resolvedComments.length !== 1 ? "s" : ""}`}
        </button>
      )}

      {isPending ? (
        <p className="text-center text-sm text-slate-400">Loading…</p>
      ) : visibleComments.length === 0 ? (
        <p className="py-2 text-center text-sm text-slate-400">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {visibleComments.map((cm) => (
            <li
              key={cm.id}
              className={`rounded-lg border p-3 text-sm ${
                cm.resolvedAt
                  ? "border-slate-100 bg-slate-50/50 opacity-60"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-slate-800">{cm.author.name}</span>
                    <span className="text-xs text-slate-400">{timeAgo(cm.createdAt)}</span>
                    {cm.editedAt && <span className="text-xs text-slate-400">(edited)</span>}
                    {cm.resolvedAt && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Check className="h-3 w-3" aria-hidden />
                        Resolved
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{cm.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!cm.resolvedAt ? (
                    <button
                      type="button"
                      onClick={() => resolveMut.mutate({ id: cm.id, resolved: true })}
                      disabled={resolveMut.isPending}
                      title="Mark as resolved"
                      aria-label="Resolve comment"
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => resolveMut.mutate({ id: cm.id, resolved: false })}
                      disabled={resolveMut.isPending}
                      title="Re-open comment"
                      aria-label="Re-open comment"
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {currentUserId === cm.author.id && (
                    <button
                      type="button"
                      onClick={() => deleteMut.mutate(cm.id)}
                      disabled={deleteMut.isPending}
                      title="Delete comment"
                      aria-label="Delete comment"
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
