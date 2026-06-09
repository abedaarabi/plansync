"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchIssuesForFileVersion,
  fetchViewerState,
  formatIssueLockHint,
  patchIssue,
  type IssueRow,
} from "@/lib/api-client";
import { findAnnotationById } from "@/lib/issueFocus";
import { setViewerCollabRevision } from "@/lib/viewerCollabRevision";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";
import type { Annotation } from "@/store/viewerStore";

function isAnnotationAttachableToIssue(
  a: Annotation,
  issue: IssueRow,
  annotations: Annotation[],
): boolean {
  if (a.type === "measurement") return false;
  if (a.fromSheetAi) return false;
  if (a.linkedOmAssetId || a.omAssetDraft) return false;
  if (a.issueDraft) return false;
  const pageIdx =
    issue.pageNumber != null
      ? issue.pageNumber - 1
      : issue.annotationId
        ? findAnnotationById(annotations, issue.annotationId)?.pageIndex
        : null;
  if (pageIdx == null || a.pageIndex !== pageIdx) return false;
  if (issue.annotationId && a.id === issue.annotationId) return false;
  if (a.linkedIssueId) return false;
  return true;
}

/**
 * Floating action chip on the canvas — one-click link selected markups to the focused issue.
 */
export function ViewerLinkMarkupChip() {
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const viewerOperationsMode = useViewerStore((s) => s.viewerOperationsMode);
  const annotations = useViewerStore((s) => s.annotations);
  const tool = useViewerStore((s) => s.tool);
  const selectedAnnotationIds = useViewerStore((s) => s.selectedAnnotationIds);
  const issuesSidebarFocusIssueId = useViewerStore((s) => s.issuesSidebarFocusIssueId);
  const viewerWorkspaceMode = useViewerStore((s) => s.viewerWorkspaceMode);
  const setSelectedAnnotationIds = useViewerStore((s) => s.setSelectedAnnotationIds);

  const qc = useQueryClient();
  const omIssueKindKey = viewerOperationsMode ? "CONSTRUCTION,WORK_ORDER,OCCUPANT" : null;
  const issuesQueryKey = qk.issuesForFileVersion(cloudFileVersionId ?? "", omIssueKindKey);

  const { data: issues = [] } = useQuery({
    queryKey: issuesQueryKey,
    queryFn: () =>
      fetchIssuesForFileVersion(cloudFileVersionId!, {
        issueKinds: viewerOperationsMode ? ["CONSTRUCTION", "WORK_ORDER", "OCCUPANT"] : undefined,
      }),
    enabled: Boolean(cloudFileVersionId),
  });

  const focusedIssue = useMemo(
    () => issues.find((i) => i.id === issuesSidebarFocusIssueId) ?? null,
    [issues, issuesSidebarFocusIssueId],
  );

  const eligibleIds = useMemo(() => {
    if (!focusedIssue || tool !== "select" || selectedAnnotationIds.length === 0) return [];
    return selectedAnnotationIds.filter((id) => {
      const a = findAnnotationById(annotations, id);
      return Boolean(a && isAnnotationAttachableToIssue(a, focusedIssue, annotations));
    });
  }, [focusedIssue, tool, selectedAnnotationIds, annotations]);

  const linkMut = useMutation({
    mutationFn: async () => {
      if (!focusedIssue || eligibleIds.length === 0) return;
      const existing = focusedIssue.attachedMarkupAnnotationIds ?? [];
      const merged = [...new Set([...existing, ...eligibleIds])];
      return patchIssue(focusedIssue.id, { attachedMarkupAnnotationIds: merged });
    },
    onSuccess: (row) => {
      if (!row) return;
      qc.setQueryData(issuesQueryKey, (old: IssueRow[] | undefined) => {
        if (!old) return old;
        return old.map((i) => (i.id === row.id ? row : i));
      });
      void qc.invalidateQueries({ queryKey: ["issues", "project"], exact: false });
      if (cloudFileVersionId) {
        void fetchViewerState(cloudFileVersionId).then(({ revision }) =>
          setViewerCollabRevision(revision),
        );
      }
      setSelectedAnnotationIds([]);
      toast.success(
        eligibleIds.length === 1
          ? "Markup linked to issue"
          : `${eligibleIds.length} markups linked to issue`,
      );
    },
    onError: (e: Error) => toast.error(formatIssueLockHint(e)),
  });

  const onLink = useCallback(() => {
    if (eligibleIds.length === 0) return;
    linkMut.mutate();
  }, [eligibleIds.length, linkMut]);

  if (viewerWorkspaceMode !== "issues" || eligibleIds.length === 0 || !focusedIssue) {
    return null;
  }

  return (
    <div className="no-print pointer-events-none absolute inset-x-0 bottom-20 z-30 flex justify-center px-3 sm:bottom-6">
      <button
        type="button"
        disabled={linkMut.isPending}
        onClick={onLink}
        className="viewer-focus-ring pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-emerald-500/45 bg-emerald-950/92 px-4 py-2.5 text-[12px] font-semibold text-emerald-50 shadow-xl ring-1 ring-emerald-500/25 backdrop-blur-md transition hover:bg-emerald-900/90 active:scale-[0.98] disabled:opacity-60"
      >
        {linkMut.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
        ) : (
          <Link2 className="h-4 w-4" strokeWidth={2} aria-hidden />
        )}
        Attach {eligibleIds.length} markup{eligibleIds.length === 1 ? "" : "s"} to &ldquo;
        {focusedIssue.title.length > 28
          ? `${focusedIssue.title.slice(0, 28)}…`
          : focusedIssue.title}
        &rdquo;
      </button>
    </div>
  );
}
