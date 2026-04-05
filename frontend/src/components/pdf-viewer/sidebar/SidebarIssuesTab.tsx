"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Crosshair, FolderOpen, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteIssue,
  fetchIssuesForFileVersion,
  formatIssueLockHint,
  patchIssue,
  type IssueRow,
} from "@/lib/api-client";
import { DeleteIssueConfirmDialog } from "@/components/pdf-viewer/DeleteIssueConfirmDialog";
import { IssueFormSlider } from "@/components/pdf-viewer/IssueFormSlider";
import { ViewerUserThumb } from "@/components/pdf-viewer/ViewerUserThumb";
import { findAnnotationById, normRectFromAnnotationPoints } from "@/lib/issueFocus";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
  issueStatusBadgeClass,
  issueStatusMarkerStrokeHex,
} from "@/lib/issueStatusStyle";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";

type IssueCardProps = {
  issue: IssueRow;
  isPatching: boolean;
  isPlacingThis: boolean;
  /** Sheet → server link in progress for this issue */
  isPinLinking?: boolean;
  /** Selected by clicking its pin on the sheet — scroll target + emphasis. */
  isHighlighted?: boolean;
  onStatusChange: (issueId: string, status: string) => void;
  onFocusClick: (issue: IssueRow) => void;
  onPlacePinClick: (issue: IssueRow) => void;
  onEditClick: (issue: IssueRow) => void;
  onDeleteClick: (issue: IssueRow) => void;
  isDeleting: boolean;
};

const SidebarIssueCard = memo(function SidebarIssueCard({
  issue,
  isPatching,
  isPlacingThis,
  isPinLinking,
  isHighlighted,
  onStatusChange,
  onFocusClick,
  onPlacePinClick,
  onEditClick,
  onDeleteClick,
  isDeleting,
}: IssueCardProps) {
  const due = issueDateToInputValue(issue.dueDate ?? undefined);
  const pri = issue.priority ?? "MEDIUM";
  return (
    <li id={`sidebar-issue-${issue.id}`}>
      <div
        className={`space-y-2 rounded-lg border p-2 transition-[box-shadow,background-color] duration-200 ${
          isHighlighted
            ? "border-sky-500/55 bg-[#1E293B] ring-2 ring-sky-500/40"
            : "border-[#334155] bg-[#1E293B]/60"
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold leading-snug text-[#F8FAFC]">{issue.title}</p>
            <p className="mt-0.5 truncate text-[9px] tabular-nums text-[#64748b]">
              {issue.sheetName ?? issue.file.name}
              <span className="text-[#475569]"> · </span>v
              {issue.sheetVersion ?? issue.fileVersion.version}
              {issue.pageNumber != null ? (
                <>
                  <span className="text-[#475569]"> · </span>p.{issue.pageNumber}
                </>
              ) : null}
            </p>
            {issue.location ? (
              <p className="mt-0.5 truncate text-[9px] text-[#64748B]">{issue.location}</p>
            ) : null}
            {issue.assignee ? (
              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <ViewerUserThumb
                  name={issue.assignee.name}
                  email={issue.assignee.email}
                  image={issue.assignee.image}
                  className="h-5 w-5 text-[8px]"
                />
                <p className="min-w-0 flex-1 truncate text-[9px] text-[#94A3B8]">
                  {issue.assignee.name || issue.assignee.email}
                </p>
              </div>
            ) : null}
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="rounded bg-[#0F172A] px-1.5 py-px text-[8px] font-medium uppercase tracking-wide text-[#94A3B8]">
                {ISSUE_PRIORITY_LABEL[pri] ?? pri}
              </span>
              {due ? (
                <span className="rounded bg-[#0F172A] px-1.5 py-px text-[8px] font-medium text-amber-200/90">
                  Due {due}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-0.5">
            <button
              type="button"
              title="Edit details"
              onClick={() => onEditClick(issue)}
              className="viewer-focus-ring flex h-8 w-8 items-center justify-center rounded-md border border-[#334155] bg-[#0F172A] text-[#E2E8F0] hover:bg-[#1E293B]"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              title="Delete issue"
              disabled={isDeleting}
              onClick={() => onDeleteClick(issue)}
              className="viewer-focus-ring flex h-8 w-8 items-center justify-center rounded-md border border-red-500/35 bg-red-950/40 text-red-100 hover:bg-red-950/60 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              title={
                issue.annotationId ? "Zoom to linked markup" : "Place a pin on the sheet first"
              }
              disabled={!issue.annotationId}
              onClick={() => onFocusClick(issue)}
              className="viewer-focus-ring flex h-8 w-8 items-center justify-center rounded-md border border-[#334155] bg-[#0F172A] text-[#E2E8F0] hover:bg-[#1E293B] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Crosshair className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              title={
                isPinLinking
                  ? "Saving pin link…"
                  : issue.annotationId
                    ? "Move status pin on the sheet"
                    : "Place status pin on the sheet"
              }
              disabled={isPinLinking}
              onClick={() => onPlacePinClick(issue)}
              className={`viewer-focus-ring flex h-8 w-8 items-center justify-center rounded-md border text-[#E2E8F0] hover:bg-[#1E293B] ${
                isPlacingThis
                  ? "border-amber-500/60 bg-amber-950/50 text-amber-100"
                  : "border-[#334155] bg-[#0F172A]"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
        <label className="block">
          <span className="sr-only">Issue status</span>
          <select
            value={issue.status}
            onChange={(e) => onStatusChange(issue.id, e.target.value)}
            disabled={isPatching}
            className={`viewer-focus-ring w-full rounded-md border-0 px-2 py-1.5 text-[10px] font-semibold disabled:opacity-50 ${issueStatusBadgeClass(issue.status)}`}
          >
            {ISSUE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {ISSUE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {isPlacingThis ? (
          <p className="text-[9px] font-medium text-amber-200/90">
            Click the drawing to drop the pin.
          </p>
        ) : null}
      </div>
    </li>
  );
});

export function SidebarIssuesTab() {
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const annotations = useViewerStore((s) => s.annotations);
  const requestSearchFocus = useViewerStore((s) => s.requestSearchFocus);
  const setPendingProSidebarTab = useViewerStore((s) => s.setPendingProSidebarTab);
  const issuePlacement = useViewerStore((s) => s.issuePlacement);
  const setIssuePlacement = useViewerStore((s) => s.setIssuePlacement);
  const newIssuePlacementActive = useViewerStore((s) => s.newIssuePlacementActive);
  const setNewIssuePlacementActive = useViewerStore((s) => s.setNewIssuePlacementActive);
  const issueCreateDraft = useViewerStore((s) => s.issueCreateDraft);
  const setAnnotations = useViewerStore((s) => s.setAnnotations);
  const issuesSidebarFocusIssueId = useViewerStore((s) => s.issuesSidebarFocusIssueId);
  const issuePinLinkInFlightIssueId = useViewerStore((s) => s.issuePinLinkInFlightIssueId);

  const qc = useQueryClient();
  const [editingIssue, setEditingIssue] = useState<IssueRow | null>(null);
  const [patchingIssueId, setPatchingIssueId] = useState<string | null>(null);
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const [deleteConfirmIssue, setDeleteConfirmIssue] = useState<IssueRow | null>(null);

  const issuesQueryKey = qk.issuesForFileVersion(cloudFileVersionId ?? "");

  const { data: issues = [], isPending: issuesPending } = useQuery({
    queryKey: issuesQueryKey,
    queryFn: () => fetchIssuesForFileVersion(cloudFileVersionId!),
    enabled: Boolean(cloudFileVersionId),
  });

  useEffect(() => {
    if (!issuesSidebarFocusIssueId || issuesPending) return;
    const id = issuesSidebarFocusIssueId;
    const t = window.setTimeout(() => {
      document.getElementById(`sidebar-issue-${id}`)?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, [issuesSidebarFocusIssueId, issuesPending, issues.length]);

  /** Sync server issue metadata onto linked annotations (status colors, titles) without undo noise. */
  useEffect(() => {
    if (!issues.length) return;
    const st = useViewerStore.getState();
    let next = st.annotations;
    let changed = false;
    for (const issue of issues) {
      if (!issue.annotationId) continue;
      const idx = next.findIndex((a) => a.id === issue.annotationId);
      if (idx < 0) continue;
      const ann = next[idx];
      if (ann.type === "measurement") continue;
      const hex = issueStatusMarkerStrokeHex(issue.status);
      const needs =
        ann.linkedIssueId !== issue.id ||
        ann.issueStatus !== issue.status ||
        (ann.linkedIssueTitle ?? "") !== issue.title ||
        ann.color !== hex;
      if (!needs) continue;
      changed = true;
      next = [...next];
      next[idx] = {
        ...ann,
        linkedIssueId: issue.id,
        issueStatus: issue.status,
        linkedIssueTitle: issue.title,
        color: hex,
      };
    }
    if (changed) {
      setAnnotations(next, { skipHistory: true });
    }
  }, [issues, setAnnotations, annotations]);

  const patchMut = useMutation({
    mutationFn: (vars: { id: string; body: Parameters<typeof patchIssue>[1] }) =>
      patchIssue(vars.id, vars.body),
    onMutate: (vars) => {
      setPatchingIssueId(vars.id);
    },
    onSuccess: (row, vars) => {
      qc.setQueryData(issuesQueryKey, (old: IssueRow[] | undefined) => {
        if (!old) return old;
        return old.map((i) => (i.id === row.id ? row : i));
      });
      void qc.invalidateQueries({ queryKey: ["issues", "project"], exact: false });
      const st = useViewerStore.getState();
      const ann = st.annotations.find((a) => a.linkedIssueId === vars.id);
      if (ann) {
        st.updateAnnotation(ann.id, {
          issueStatus: row.status,
          linkedIssueTitle: row.title,
          color: issueStatusMarkerStrokeHex(row.status),
        });
      }
    },
    onError: (e: Error) => toast.error(formatIssueLockHint(e)),
    onSettled: () => {
      setPatchingIssueId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteIssue(id),
    onMutate: (id) => setDeletingIssueId(id),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: issuesQueryKey });
      void qc.invalidateQueries({ queryKey: ["issues", "project"], exact: false });
      const st = useViewerStore.getState();
      const ann = st.annotations.find((a) => a.linkedIssueId === id);
      if (ann) st.removeAnnotation(ann.id);
      toast.success("Issue deleted");
    },
    onError: (e: Error) => toast.error(formatIssueLockHint(e)),
    onSettled: () => setDeletingIssueId(null),
  });

  const onIssueStatusChange = useCallback(
    (issueId: string, status: string) => {
      patchMut.mutate({ id: issueId, body: { status } });
    },
    [patchMut],
  );

  const focusIssue = useCallback(
    (issue: IssueRow) => {
      if (!issue.annotationId) {
        toast.message("No markup linked yet. Use the pin control to place one on the sheet.");
        return;
      }
      const ann = findAnnotationById(useViewerStore.getState().annotations, issue.annotationId);
      if (!ann) {
        toast.error("Linked markup is not on this sheet.");
        return;
      }
      if (!ann.linkedIssueId) {
        toast.message(
          "This issue uses a classic markup link. Use “Place pin” to add a status-colored pin, or keep using this shape as-is.",
          { duration: 6000 },
        );
      }
      const rect = normRectFromAnnotationPoints(ann.points);
      requestSearchFocus({
        pageNumber: ann.pageIndex + 1,
        rectNorm: rect,
        selectAnnotationId: ann.id,
      });
      setPendingProSidebarTab("issues");
    },
    [requestSearchFocus, setPendingProSidebarTab],
  );

  const onPlacePinClick = useCallback(
    (issue: IssueRow) => {
      setNewIssuePlacementActive(false);
      const livePin = useViewerStore
        .getState()
        .annotations.find((a) => a.linkedIssueId === issue.id);
      setIssuePlacement({
        issueId: issue.id,
        status: issue.status,
        title: issue.title,
        replaceAnnotationId: livePin?.id ?? issue.annotationId ?? null,
      });
    },
    [setIssuePlacement, setNewIssuePlacementActive],
  );

  const onDeleteClick = useCallback((issue: IssueRow) => {
    setDeleteConfirmIssue(issue);
  }, []);

  const startNewIssuePlacement = useCallback(() => {
    setIssuePlacement(null);
    setNewIssuePlacementActive(true);
    setPendingProSidebarTab("issues");
  }, [setIssuePlacement, setNewIssuePlacementActive, setPendingProSidebarTab]);

  const closeEditDialog = useCallback(() => setEditingIssue(null), []);

  if (!cloudFileVersionId || !viewerProjectId) {
    return (
      <div className="flex flex-col items-center gap-3 px-2 py-4 text-center">
        <FolderOpen className="h-10 w-10 text-[#475569]" strokeWidth={1.25} aria-hidden />
        <p className="text-[11px] leading-relaxed text-[#94A3B8]">
          Issues are tied to a{" "}
          <span className="font-medium text-[#CBD5E1]">project file revision</span>. Open this PDF
          from <span className="font-medium text-[#CBD5E1]">Files</span> inside a project (not a
          standalone upload) so the viewer receives project and sheet context.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {editingIssue ? (
        <IssueFormSlider variant="edit" open issue={editingIssue} onClose={closeEditDialog} />
      ) : null}

      <div className="flex shrink-0 items-center justify-between gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          Sheet issues
        </span>
        <button
          type="button"
          onClick={startNewIssuePlacement}
          className="viewer-focus-ring flex items-center gap-1 rounded-md border border-[#334155] bg-[#1E293B] px-2 py-1 text-[10px] font-medium text-[#E2E8F0] hover:bg-[#334155]"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          New issue
        </button>
      </div>

      {newIssuePlacementActive ? (
        <div className="shrink-0 rounded-md border border-sky-500/40 bg-sky-950/50 px-2 py-1.5 text-[10px] leading-snug text-sky-100">
          <span className="font-semibold">Place the pin:</span> click on the drawing. A form will
          open to add title, dates, and assignee.{" "}
          <button
            type="button"
            onClick={() => setNewIssuePlacementActive(false)}
            className="font-medium text-sky-200 underline decoration-sky-400/60 underline-offset-2 hover:text-white"
          >
            Cancel
          </button>
          <span className="text-[#94A3B8]"> · Esc</span>
        </div>
      ) : null}

      {issueCreateDraft ? (
        <div className="shrink-0 rounded-md border border-sky-500/35 bg-sky-950/45 px-2 py-1.5 text-[10px] leading-snug text-sky-100">
          <span className="font-semibold">New issue (draft):</span> use the form on the canvas to
          add title and details. Click the pin again if you closed it.{" "}
          <span className="text-[#94A3B8]">Issue pins are removed from the Issues tab only.</span>
        </div>
      ) : null}

      {issuePlacement ? (
        <div className="shrink-0 rounded-md border border-amber-500/40 bg-amber-950/55 px-2 py-1.5 text-[10px] leading-snug text-amber-100">
          <span className="font-semibold">Placing pin:</span> {issuePlacement.title}. A banner also
          appears above the drawing.{" "}
          <button
            type="button"
            onClick={() => setIssuePlacement(null)}
            className="font-medium text-amber-200 underline decoration-amber-400/60 underline-offset-2 hover:text-white"
          >
            Cancel
          </button>
          <span className="text-[#94A3B8]"> · Esc</span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
        {issuesPending ? (
          <p className="py-6 text-center text-[11px] text-[#64748B]">Loading…</p>
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 px-2 text-center">
            <AlertCircle className="h-8 w-8 text-[#475569]" strokeWidth={1.5} />
            <p className="text-[11px] leading-snug text-[#94A3B8]">
              No issues on this sheet yet. Use{" "}
              <span className="font-medium text-[#CBD5E1]">New issue</span>, click the plan to drop
              a pin, then fill in the details.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {issues.map((issue) => (
              <SidebarIssueCard
                key={issue.id}
                issue={issue}
                isPatching={patchingIssueId === issue.id}
                isPlacingThis={issuePlacement?.issueId === issue.id}
                isPinLinking={issuePinLinkInFlightIssueId === issue.id}
                isHighlighted={issuesSidebarFocusIssueId === issue.id}
                onStatusChange={onIssueStatusChange}
                onFocusClick={focusIssue}
                onPlacePinClick={onPlacePinClick}
                onEditClick={setEditingIssue}
                onDeleteClick={onDeleteClick}
                isDeleting={deletingIssueId === issue.id}
              />
            ))}
          </ul>
        )}
      </div>

      <DeleteIssueConfirmDialog
        open={deleteConfirmIssue != null}
        issueTitle={deleteConfirmIssue?.title ?? ""}
        onCancel={() => setDeleteConfirmIssue(null)}
        onConfirm={() => {
          if (!deleteConfirmIssue) return;
          const id = deleteConfirmIssue.id;
          setDeleteConfirmIssue(null);
          deleteMut.mutate(id);
        }}
        isDeleting={deleteConfirmIssue != null && deletingIssueId === deleteConfirmIssue.id}
      />
    </div>
  );
}
