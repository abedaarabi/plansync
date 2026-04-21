"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  fetchProposalDocumentVersions,
  restoreProposalDocumentVersion,
  type ProposalDocumentVersionRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

type Props = {
  projectId: string;
  proposalId: string;
  onRestored?: (version: ProposalDocumentVersionRow) => void;
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

export function ProposalVersionHistoryPanel({ projectId, proposalId, onRestored }: Props) {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: qk.projectProposalDocumentVersions(projectId, proposalId),
    queryFn: () => fetchProposalDocumentVersions(projectId, proposalId),
    enabled: Boolean(projectId && proposalId),
  });

  const restoreMut = useMutation({
    mutationFn: (versionId: string) =>
      restoreProposalDocumentVersion(projectId, proposalId, versionId),
    onSuccess: (v) => {
      qc.invalidateQueries({
        queryKey: qk.projectProposalDocumentVersions(projectId, proposalId),
      });
      qc.invalidateQueries({ queryKey: qk.projectProposal(projectId, proposalId) });
      toast.success(`Restored to v${v.versionNumber}`);
      onRestored?.(v);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
        <Clock className="h-4 w-4 animate-pulse" aria-hidden />
        Loading history…
      </div>
    );
  }

  const versions = data?.versions ?? [];

  return (
    <div className="space-y-1">
      {versions.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">
          No saved versions yet. Save a version to start tracking history.
        </p>
      ) : (
        <ul className="space-y-1">
          {versions.map((v, idx) => {
            const isLatest = idx === 0;
            const isExpanded = expandedId === v.id;
            return (
              <li
                key={v.id}
                className={`rounded-lg border text-sm transition-colors ${
                  isLatest
                    ? "border-[var(--enterprise-primary)]/30 bg-blue-50/50"
                    : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-start gap-2 p-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                    {v.versionNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">
                        {isLatest ? "Latest" : `v${v.versionNumber}`}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">{timeAgo(v.createdAt)}</span>
                    </div>
                    {v.changeSummary ? (
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                        {v.changeSummary}
                      </p>
                    ) : null}
                    {v.createdBy ? (
                      <p className="mt-0.5 text-xs text-slate-400">by {v.createdBy.name}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isLatest && (
                      <button
                        type="button"
                        onClick={() => restoreMut.mutate(v.id)}
                        disabled={restoreMut.isPending}
                        title="Restore this version"
                        aria-label={`Restore version ${v.versionNumber}`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-[var(--enterprise-primary)]/40 hover:bg-blue-50 hover:text-[var(--enterprise-primary)] disabled:opacity-50"
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden />
                        Restore
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                      title={isExpanded ? "Collapse" : "Preview"}
                      aria-expanded={isExpanded}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                    <div
                      className="prose prose-sm max-w-none text-slate-700 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_p]:my-1"
                      dangerouslySetInnerHTML={{ __html: v.contentHtml }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
