"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  Crosshair,
  FolderOpen,
  Link2,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteIssue,
  fetchIssuesForFileVersion,
  fetchViewerState,
  formatIssueLockHint,
  patchIssue,
  type IssueRow,
} from "@/lib/api-client";
import { setViewerCollabRevision } from "@/lib/viewerCollabRevision";
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
  issueAssigneeShortLabel,
} from "@/lib/issueStatusStyle";
import { qk } from "@/lib/queryKeys";
import { annotationIsIssuePin } from "@/lib/annotationIssues";
import { useViewerStore } from "@/store/viewerStore";
import type { Annotation } from "@/store/viewerStore";

function issuePageIndex0(issue: IssueRow, annotations: Annotation[]): number | null {
  if (issue.pageNumber != null && Number.isFinite(issue.pageNumber)) {
    return Math.max(0, issue.pageNumber - 1);
  }
  if (issue.annotationId) {
    const p = findAnnotationById(annotations, issue.annotationId);
    if (p) return p.pageIndex;
  }
  for (const aid of issue.attachedMarkupAnnotationIds ?? []) {
    const a = findAnnotationById(annotations, aid);
    if (a) return a.pageIndex;
  }
  const pin = annotations.find((a) => a.linkedIssueId === issue.id && !a.linkedIssueAttachment);
  if (pin) return pin.pageIndex;
  return null;
}

function issueHasAttachments(issue: IssueRow): boolean {
  return (
    (issue.referencePhotos?.length ?? 0) > 0 ||
    (issue.attachedMarkupAnnotationIds?.length ?? 0) > 0 ||
    (issue.linkedRfis?.length ?? 0) > 0
  );
}

function isAnnotationAttachableToIssue(
  a: Annotation,
  issue: IssueRow,
  annotations: Annotation[],
): boolean {
  if (a.type === "measurement") return false;
  if (a.fromSheetAi) return false;
  if (a.linkedOmAssetId || a.omAssetDraft) return false;
  if (a.issueDraft) return false;
  const pageIdx = issuePageIndex0(issue, annotations);
  if (pageIdx === null || a.pageIndex !== pageIdx) return false;
  if (issue.annotationId && a.id === issue.annotationId) return false;
  if (a.linkedIssueId) {
    if (a.linkedIssueId === issue.id && a.linkedIssueAttachment) return false;
    return false;
  }
  return true;
}

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
  onSetLinkTarget: (issue: IssueRow) => void;
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
  onSetLinkTarget,
  isDeleting,
}: IssueCardProps) {
  const due = issueDateToInputValue(issue.dueDate ?? undefined);
  const pri = issue.priority ?? "MEDIUM";
  const attachments = issueHasAttachments(issue);
  const sheetLabel = (issue.sheetName ?? issue.file.name).trim() || "Sheet";
  const rev = issue.sheetVersion ?? issue.fileVersion.version;

  const actionBtn =
    "viewer-focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-slate-200 transition hover:bg-slate-700/80 active:scale-[0.98]";

  return (
    <li id={`sidebar-issue-${issue.id}`}>
      <article
        className={`overflow-hidden rounded-xl border transition-[box-shadow,background-color,border-color] duration-200 ${
          isHighlighted
            ? "border-sky-500/45 bg-slate-800/95 shadow-[0_0_0_1px_rgba(56,189,248,0.2),0_12px_28px_-8px_rgba(0,0,0,0.45)]"
            : "border-slate-600/45 bg-slate-800/35 hover:border-slate-500/55 hover:bg-slate-800/55"
        }`}
      >
        <div
          className={`border-b border-slate-700/40 px-3.5 py-2.5 ${isHighlighted ? "bg-sky-950/15" : "bg-slate-900/25"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {issue.issueKind === "WORK_ORDER" ? (
                <span className="shrink-0 rounded-md border border-slate-500/50 bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-slate-400">
                  WO
                </span>
              ) : null}
              {attachments ? (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-amber-500/25 bg-amber-950/35 px-1.5 py-0.5 text-[9px] font-medium text-amber-100/90"
                  title="Has reference photos, linked markups, or RFIs"
                >
                  <Paperclip className="h-2.5 w-2.5 opacity-90" strokeWidth={2.5} aria-hidden />
                  Attach
                </span>
              ) : null}
            </div>
            <label className="min-w-0 shrink">
              <span className="sr-only">Issue status</span>
              <select
                value={issue.status}
                onChange={(e) => onStatusChange(issue.id, e.target.value)}
                disabled={isPatching}
                className={`viewer-focus-ring max-w-44 cursor-pointer rounded-lg border-0 px-2.5 py-1.5 text-[10px] font-semibold shadow-sm disabled:opacity-50 sm:max-w-52 ${issueStatusBadgeClass(issue.status)}`}
              >
                {ISSUE_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {ISSUE_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-2.5 px-3.5 pb-3 pt-3">
          <h3 className="text-[13px] font-semibold leading-snug tracking-tight text-slate-50 wrap-anywhere">
            {issue.title}
          </h3>

          <div className="flex flex-wrap gap-1.5 text-[10px]">
            <span className="inline-flex max-w-full items-center rounded-md bg-slate-950/70 px-2 py-1 font-medium text-slate-300 ring-1 ring-slate-700/50">
              <span className="truncate">{sheetLabel}</span>
            </span>
            <span className="inline-flex items-center rounded-md bg-slate-950/70 px-2 py-1 tabular-nums font-medium text-slate-400 ring-1 ring-slate-700/50">
              Rev {rev}
            </span>
            {issue.pageNumber != null ? (
              <span className="inline-flex items-center rounded-md bg-slate-950/70 px-2 py-1 tabular-nums font-medium text-slate-400 ring-1 ring-slate-700/50">
                Page {issue.pageNumber}
              </span>
            ) : null}
          </div>

          {issue.location ? (
            <p className="truncate text-[10px] leading-snug text-slate-500">{issue.location}</p>
          ) : null}

          {issue.assignee ? (
            <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-950/40 py-1.5 pl-1.5 pr-2 ring-1 ring-slate-700/40">
              <ViewerUserThumb
                name={issue.assignee.name}
                email={issue.assignee.email}
                image={issue.assignee.image}
                className="h-7 w-7 text-[9px]"
              />
              <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-300">
                {issue.assignee.name || issue.assignee.email}
              </p>
            </div>
          ) : (
            <p className="text-[10px] italic text-slate-600">Unassigned</p>
          )}

          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-slate-950/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-slate-700/50">
              {ISSUE_PRIORITY_LABEL[pri] ?? pri}
            </span>
            {due ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/35 bg-amber-950/70 px-2 py-1 text-[11px] font-semibold tabular-nums text-amber-50 shadow-sm ring-1 ring-amber-600/25"
                title={`Due ${due}`}
              >
                <Calendar
                  className="h-3.5 w-3.5 shrink-0 text-amber-200"
                  strokeWidth={2}
                  aria-hidden
                />
                Due {due}
              </span>
            ) : null}
          </div>

          <div
            className="flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-700/35 pt-3"
            role="toolbar"
            aria-label="Issue actions"
          >
            <button
              type="button"
              title="Edit details"
              onClick={() => onEditClick(issue)}
              className={`${actionBtn} border-slate-600/60 bg-slate-900/80`}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              title="Use this issue when linking selected markups (Select tool)"
              onClick={() => onSetLinkTarget(issue)}
              className={`${actionBtn} ${
                isHighlighted
                  ? "border-emerald-500/50 bg-emerald-950/50 text-emerald-50"
                  : "border-slate-600/60 bg-slate-900/80"
              }`}
            >
              <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              title="Delete issue"
              disabled={isDeleting}
              onClick={() => onDeleteClick(issue)}
              className={`${actionBtn} border-red-500/30 bg-red-950/35 text-red-100 hover:bg-red-950/55 disabled:opacity-40`}
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
              className={`${actionBtn} border-slate-600/60 bg-slate-900/80 disabled:cursor-not-allowed disabled:opacity-35`}
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
              className={`${actionBtn} ${
                isPlacingThis
                  ? "border-amber-500/55 bg-amber-950/45 text-amber-50"
                  : "border-slate-600/60 bg-slate-900/80"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>

          {isPlacingThis ? (
            <p className="rounded-md bg-amber-950/30 px-2 py-1.5 text-center text-[10px] font-medium text-amber-100/95 ring-1 ring-amber-700/25">
              Click the drawing to drop the pin.
            </p>
          ) : null}
        </div>
      </article>
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
  const setIssuesSidebarFocusIssueId = useViewerStore((s) => s.setIssuesSidebarFocusIssueId);
  const issuePinLinkInFlightIssueId = useViewerStore((s) => s.issuePinLinkInFlightIssueId);
  const tool = useViewerStore((s) => s.tool);
  const selectedAnnotationIds = useViewerStore((s) => s.selectedAnnotationIds);
  const setSelectedAnnotationIds = useViewerStore((s) => s.setSelectedAnnotationIds);

  const qc = useQueryClient();
  const [editingIssue, setEditingIssue] = useState<IssueRow | null>(null);
  const [patchingIssueId, setPatchingIssueId] = useState<string | null>(null);
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const [deleteConfirmIssue, setDeleteConfirmIssue] = useState<IssueRow | null>(null);

  const viewerOperationsMode = useViewerStore((s) => s.viewerOperationsMode);
  const issuesQueryKey = qk.issuesForFileVersion(
    cloudFileVersionId ?? "",
    viewerOperationsMode ? "WORK_ORDER" : null,
  );

  const { data: issues = [], isPending: issuesPending } = useQuery({
    queryKey: issuesQueryKey,
    queryFn: () =>
      fetchIssuesForFileVersion(cloudFileVersionId!, {
        issueKind: viewerOperationsMode ? "WORK_ORDER" : undefined,
      }),
    enabled: Boolean(cloudFileVersionId),
  });

  const focusedIssue = useMemo(
    () => issues.find((i) => i.id === issuesSidebarFocusIssueId) ?? null,
    [issues, issuesSidebarFocusIssueId],
  );

  const eligibleLinkIds = useMemo(() => {
    if (!focusedIssue || tool !== "select" || selectedAnnotationIds.length === 0) return [];
    return selectedAnnotationIds.filter((id) => {
      const a = findAnnotationById(annotations, id);
      return Boolean(a && isAnnotationAttachableToIssue(a, focusedIssue, annotations));
    });
  }, [focusedIssue, tool, selectedAnnotationIds, annotations]);

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

  /** Sync server issue metadata onto the pin and any attached markups (without undo noise). */
  useEffect(() => {
    if (!issues.length) return;
    const chron = [...issues].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const displayNumById = new Map(chron.map((row, i) => [row.id, i + 1]));
    const st = useViewerStore.getState();
    let next = st.annotations;
    let changed = false;

    const stripIssueFields = (ann: (typeof next)[number]) => ({
      ...ann,
      linkedIssueId: undefined,
      linkedIssueAttachment: undefined,
      linkedIssueKind: undefined,
      issueStatus: undefined,
      linkedIssueTitle: undefined,
      linkedIssuePriority: undefined,
      linkedIssueAssigneeInitials: undefined,
      linkedIssueDisplayNum: undefined,
      linkedIssueHasAttachments: undefined,
    });

    for (const issue of issues) {
      const attached = issue.attachedMarkupAnnotationIds ?? [];
      const linkedIds = [issue.annotationId, ...attached].filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      );
      const linkedSet = new Set(linkedIds);
      if (linkedIds.length === 0) continue;

      const hex = issueStatusMarkerStrokeHex(issue.status);
      const kind: "WORK_ORDER" | "CONSTRUCTION" =
        issue.issueKind === "WORK_ORDER" ? "WORK_ORDER" : "CONSTRUCTION";
      const pri = issue.priority ?? "MEDIUM";
      const assigneeShort = issueAssigneeShortLabel(issue.assignee?.name, issue.assignee?.email);
      const dnum = displayNumById.get(issue.id);
      const hasAttachments =
        (issue.referencePhotos?.length ?? 0) > 0 ||
        (issue.attachedMarkupAnnotationIds?.length ?? 0) > 0 ||
        (issue.linkedRfis?.length ?? 0) > 0;

      for (let i = 0; i < next.length; i++) {
        const ann = next[i];
        if (ann.linkedIssueId !== issue.id || ann.issueDraft) continue;
        if (linkedSet.has(ann.id)) continue;
        /** Cached `issue.annotationId` can lag after “Place pin” / reposition; do not strip the new pin. */
        const serverPrimaryId = issue.annotationId;
        const serverPrimaryMissing =
          typeof serverPrimaryId === "string" &&
          serverPrimaryId.length > 0 &&
          !next.some((a) => a.id === serverPrimaryId);
        if (serverPrimaryMissing && annotationIsIssuePin(ann)) continue;
        changed = true;
        next = [...next];
        next[i] = stripIssueFields(ann);
      }

      for (const annId of linkedIds) {
        const idx = next.findIndex((a) => a.id === annId);
        if (idx < 0) continue;
        const ann = next[idx];
        if (ann.type === "measurement") continue;
        const isPin = issue.annotationId === annId;
        const needs = isPin
          ? ann.linkedIssueId !== issue.id ||
            ann.linkedIssueKind !== kind ||
            ann.issueStatus !== issue.status ||
            (ann.linkedIssueTitle ?? "") !== issue.title ||
            ann.color !== hex ||
            (ann.linkedIssuePriority ?? "") !== pri ||
            (ann.linkedIssueAssigneeInitials ?? "") !== assigneeShort ||
            ann.linkedIssueDisplayNum !== dnum ||
            ann.linkedIssueAttachment === true ||
            Boolean(ann.linkedIssueHasAttachments) !== hasAttachments
          : ann.linkedIssueId !== issue.id ||
            ann.linkedIssueKind !== kind ||
            ann.issueStatus !== issue.status ||
            (ann.linkedIssueTitle ?? "") !== issue.title ||
            (ann.linkedIssuePriority ?? "") !== pri ||
            ann.linkedIssueAttachment !== true ||
            ann.linkedIssueAssigneeInitials != null ||
            ann.linkedIssueDisplayNum != null;
        if (!needs) continue;
        changed = true;
        next = [...next];
        next[idx] = isPin
          ? {
              ...ann,
              linkedIssueId: issue.id,
              linkedIssueKind: kind,
              issueStatus: issue.status,
              linkedIssueTitle: issue.title,
              color: hex,
              linkedIssuePriority: pri,
              linkedIssueAssigneeInitials: assigneeShort,
              linkedIssueDisplayNum: dnum,
              linkedIssueAttachment: false,
              linkedIssueHasAttachments: hasAttachments,
            }
          : {
              ...ann,
              linkedIssueId: issue.id,
              linkedIssueKind: kind,
              issueStatus: issue.status,
              linkedIssueTitle: issue.title,
              linkedIssuePriority: pri,
              linkedIssueAttachment: true,
              linkedIssueAssigneeInitials: undefined,
              linkedIssueDisplayNum: undefined,
            };
      }
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
      const linked = st.annotations.filter((a) => a.linkedIssueId === vars.id);
      const pri = row.priority ?? "MEDIUM";
      const assigneeShort = issueAssigneeShortLabel(row.assignee?.name, row.assignee?.email);
      const hex = issueStatusMarkerStrokeHex(row.status);
      const k = row.issueKind === "WORK_ORDER" ? "WORK_ORDER" : "CONSTRUCTION";
      for (const ann of linked) {
        if (ann.linkedIssueAttachment) {
          st.updateAnnotation(ann.id, {
            issueStatus: row.status,
            linkedIssueTitle: row.title,
            linkedIssueKind: k,
            linkedIssuePriority: pri,
          });
        } else {
          st.updateAnnotation(ann.id, {
            issueStatus: row.status,
            linkedIssueTitle: row.title,
            color: hex,
            linkedIssueKind: k,
            linkedIssuePriority: pri,
            linkedIssueAssigneeInitials: assigneeShort,
          });
        }
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
      const rows = qc.getQueryData<IssueRow[]>(issuesQueryKey);
      const deletedFv = rows?.find((i) => i.id === id)?.fileVersionId;
      void qc.invalidateQueries({ queryKey: issuesQueryKey });
      void qc.invalidateQueries({ queryKey: ["issues", "project"], exact: false });
      const st = useViewerStore.getState();
      const linked = st.annotations.filter((a) => a.linkedIssueId === id);
      for (const ann of linked) {
        st.removeAnnotation(ann.id);
      }
      const cloudFv = st.cloudFileVersionId;
      if (deletedFv && cloudFv === deletedFv) {
        void fetchViewerState(deletedFv)
          .then(({ revision }) => setViewerCollabRevision(revision))
          .catch(() => {});
      }
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

  const onSetLinkTarget = useCallback(
    (issue: IssueRow) => {
      setIssuesSidebarFocusIssueId(issue.id);
    },
    [setIssuesSidebarFocusIssueId],
  );

  const linkSelectionToFocusedIssue = useCallback(async () => {
    if (!focusedIssue) return;
    const st = useViewerStore.getState();
    const eligible = st.selectedAnnotationIds.filter((id) => {
      const a = findAnnotationById(st.annotations, id);
      return Boolean(a && isAnnotationAttachableToIssue(a, focusedIssue, st.annotations));
    });
    if (eligible.length === 0) {
      toast.message(
        "No attachable markups in the selection (same page as the issue, not the pin, not already linked elsewhere).",
      );
      return;
    }
    const prev = focusedIssue.attachedMarkupAnnotationIds ?? [];
    const next = [...new Set([...prev, ...eligible])].slice(0, 30);
    try {
      await patchMut.mutateAsync({
        id: focusedIssue.id,
        body: { attachedMarkupAnnotationIds: next },
      });
      useViewerStore.getState().setSelectedAnnotationIds([]);
      toast.success(
        eligible.length === 1
          ? "Linked 1 markup to the issue."
          : `Linked ${eligible.length} markups to the issue.`,
      );
    } catch {
      /* patchMut onError */
    }
  }, [focusedIssue, patchMut]);

  const focusIssue = useCallback(
    (issue: IssueRow) => {
      const annIds = [issue.annotationId, ...(issue.attachedMarkupAnnotationIds ?? [])].filter(
        (x): x is string => Boolean(x),
      );
      if (annIds.length === 0) {
        toast.message("No markup linked yet. Use the pin control to place one on the sheet.");
        return;
      }
      const st0 = useViewerStore.getState();
      let ann = issue.annotationId
        ? findAnnotationById(st0.annotations, issue.annotationId)
        : undefined;
      if (!ann) {
        for (const aid of issue.attachedMarkupAnnotationIds ?? []) {
          ann = findAnnotationById(st0.annotations, aid);
          if (ann) break;
        }
      }
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
        issueKind: issue.issueKind === "WORK_ORDER" ? "WORK_ORDER" : "CONSTRUCTION",
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
          {viewerOperationsMode ? "Work orders (this sheet)" : "Sheet issues"}
        </span>
        <button
          type="button"
          onClick={startNewIssuePlacement}
          className="viewer-focus-ring flex items-center gap-1 rounded-md border border-[#334155] bg-[#1E293B] px-2 py-1 text-[10px] font-medium text-[#E2E8F0] hover:bg-[#334155]"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          {viewerOperationsMode ? "New work order" : "New issue"}
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

      {tool === "select" && selectedAnnotationIds.length > 0 ? (
        <div className="shrink-0 rounded-md border border-emerald-500/35 bg-emerald-950/35 px-2 py-1.5 text-[10px] leading-snug text-emerald-50">
          {focusedIssue ? (
            <>
              <span className="font-semibold text-emerald-100/95">
                {selectedAnnotationIds.length} selected
                {eligibleLinkIds.length !== selectedAnnotationIds.length
                  ? ` · ${eligibleLinkIds.length} can link`
                  : ""}
              </span>
              {eligibleLinkIds.length > 0 ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    disabled={patchingIssueId === focusedIssue.id}
                    title={focusedIssue.title}
                    onClick={() => void linkSelectionToFocusedIssue()}
                    className="font-semibold text-emerald-200 underline decoration-emerald-400/60 underline-offset-2 hover:text-white disabled:opacity-40"
                  >
                    Add to current issue
                  </button>
                </>
              ) : (
                <span className="block pt-0.5 text-[9px] text-emerald-200/80">
                  Nothing in this selection can attach to the highlighted issue (same page only).
                  Choose another issue with{" "}
                  <Link2 className="mx-0.5 inline h-3 w-3 align-text-bottom" strokeWidth={2} /> on
                  its row.
                </span>
              )}
            </>
          ) : (
            <span className="text-emerald-100/90">
              <span className="font-semibold">Link markups:</span> click the{" "}
              <Link2 className="mx-0.5 inline h-3 w-3 align-text-bottom" strokeWidth={2} /> icon on
              an issue row to pick it, then press{" "}
              <span className="font-semibold">Add to current issue</span> above.
            </span>
          )}
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
          <ul className="space-y-3 px-0.5 pb-1">
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
                onSetLinkTarget={onSetLinkTarget}
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
