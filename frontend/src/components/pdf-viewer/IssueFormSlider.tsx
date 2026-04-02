"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { FileStack, Hash, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createIssue,
  deleteIssue,
  fetchProject,
  fetchWorkspaceMembers,
  formatIssueLockHint,
  patchIssue,
  type IssueRow,
} from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_PRIORITY_ORDER,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
  issueStatusMarkerStrokeHex,
} from "@/lib/issueStatusStyle";
import { qk } from "@/lib/queryKeys";
import { useViewerStore } from "@/store/viewerStore";
import { DeleteIssueConfirmDialog } from "./DeleteIssueConfirmDialog";

type CreateProps = {
  variant: "create";
  open: boolean;
  annotationId: string;
  onClose: () => void;
};

type EditProps = {
  variant: "edit";
  open: boolean;
  issue: IssueRow;
  onClose: () => void;
};

type Props = CreateProps | EditProps;

export function IssueFormSlider(props: Props) {
  const { open, onClose } = props;
  const variant = props.variant;
  const searchParams = useSearchParams();
  const fileId = searchParams.get("fileId");
  const versionParam = searchParams.get("version");
  const viewerFileName = useViewerStore((s) => s.fileName);
  const cloudFileVersionId = useViewerStore((s) => s.cloudFileVersionId);
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const annotations = useViewerStore((s) => s.annotations);
  const setIssueCreateDraft = useViewerStore((s) => s.setIssueCreateDraft);
  const updateAnnotation = useViewerStore((s) => s.updateAnnotation);
  const removeAnnotation = useViewerStore((s) => s.removeAnnotation);

  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const parsedUrlVersion = useMemo(() => {
    if (!versionParam) return null;
    const n = Number.parseInt(versionParam, 10);
    return Number.isFinite(n) ? n : null;
  }, [versionParam]);

  const sheetContext = useMemo(() => {
    if (variant === "edit") {
      const i = props.issue;
      let pageNum = i.pageNumber ?? null;
      if (pageNum == null && i.annotationId) {
        const byAnnId = annotations.find((a) => a.id === i.annotationId);
        if (byAnnId) pageNum = byAnnId.pageIndex + 1;
      }
      if (pageNum == null) {
        const byIssue = annotations.find((a) => a.linkedIssueId === i.id);
        if (byIssue) pageNum = byIssue.pageIndex + 1;
      }
      return {
        sheetName: i.sheetName ?? i.file.name,
        sheetVersion: i.sheetVersion ?? i.fileVersion.version,
        pageNumber: pageNum,
      };
    }
    const ann =
      props.variant === "create" ? annotations.find((a) => a.id === props.annotationId) : undefined;
    const pageNumber = ann ? ann.pageIndex + 1 : null;
    return {
      sheetName: viewerFileName?.trim() || "Sheet",
      sheetVersion: parsedUrlVersion,
      pageNumber,
    };
  }, [annotations, parsedUrlVersion, props, variant, viewerFileName]);

  const { data: project } = useQuery({
    queryKey: qk.project(viewerProjectId ?? ""),
    queryFn: () => fetchProject(viewerProjectId!),
    enabled: Boolean(viewerProjectId),
  });
  const workspaceId = project?.workspaceId;

  const { data: membersRes } = useQuery({
    queryKey: qk.workspaceMembers(workspaceId ?? ""),
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: Boolean(workspaceId) && open,
  });

  const issuesQueryKey = qk.issuesForFileVersion(cloudFileVersionId ?? "");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [priority, setPriority] = useState("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setDeleteDialogOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (props.variant === "edit") {
      const i = props.issue;
      setTitle(i.title);
      setDescription(i.description ?? "");
      setAssigneeId(i.assigneeId ?? "");
      setStatus(i.status);
      setPriority(i.priority ?? "MEDIUM");
      setStartDate(issueDateToInputValue(i.startDate));
      setDueDate(issueDateToInputValue(i.dueDate));
      setLocation(i.location ?? "");
    } else {
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setStatus("OPEN");
      setPriority("MEDIUM");
      setStartDate("");
      setDueDate("");
      setLocation("");
    }
  }, [open, props]);

  useEffect(() => {
    if (variant !== "create" || !open) return;
    const annId = props.variant === "create" ? props.annotationId : "";
    const ann = annotations.find((a) => a.id === annId);
    if (!ann) {
      setIssueCreateDraft(null);
    }
  }, [annotations, open, props, setIssueCreateDraft, variant]);

  const createMut = useMutation({
    mutationFn: () => {
      const page = sheetContext.pageNumber;
      if (page == null) throw new Error("Missing page for issue.");
      return createIssue({
        workspaceId: workspaceId!,
        fileId: fileId!,
        fileVersionId: cloudFileVersionId!,
        title: title.trim(),
        description: description.trim() || undefined,
        annotationId: variant === "create" ? props.annotationId : undefined,
        assigneeId: assigneeId || undefined,
        status,
        priority,
        startDate: startDate.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        ...(location.trim() ? { location: location.trim() } : {}),
        pageNumber: page,
      });
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: issuesQueryKey });
      void qc.invalidateQueries({ queryKey: ["issues", "project"], exact: false });
      if (variant === "create") {
        updateAnnotation(props.annotationId, {
          linkedIssueId: row.id,
          issueDraft: false,
          linkedIssueTitle: row.title,
          issueStatus: row.status,
          color: issueStatusMarkerStrokeHex(row.status),
        });
        setIssueCreateDraft(null);
        onClose();
      }
      toast.success("Issue created");
    },
    onError: (e: Error) => toast.error(formatIssueLockHint(e)),
  });

  const saveEditMut = useMutation({
    mutationFn: (issueId: string) => {
      const ann = useViewerStore.getState().annotations.find((a) => a.linkedIssueId === issueId);
      let pageNumber: number | undefined;
      if (ann) pageNumber = ann.pageIndex + 1;
      else if (variant === "edit" && props.issue.pageNumber != null)
        pageNumber = props.issue.pageNumber;
      return patchIssue(issueId, {
        title: title.trim(),
        description: description.trim() || null,
        assigneeId: assigneeId || null,
        status,
        priority,
        startDate: startDate.trim() || null,
        dueDate: dueDate.trim() || null,
        location: location.trim() ? location.trim() : null,
        ...(pageNumber !== undefined ? { pageNumber } : {}),
      });
    },
    onSuccess: (row) => {
      qc.setQueryData(issuesQueryKey, (old: IssueRow[] | undefined) => {
        if (!old) return old;
        return old.map((i) => (i.id === row.id ? row : i));
      });
      void qc.invalidateQueries({ queryKey: ["issues", "project"], exact: false });
      const ann = useViewerStore.getState().annotations.find((a) => a.linkedIssueId === row.id);
      if (ann) {
        updateAnnotation(ann.id, {
          issueStatus: row.status,
          linkedIssueTitle: row.title,
          color: issueStatusMarkerStrokeHex(row.status),
        });
      }
      toast.success("Issue updated");
      onClose();
    },
    onError: (e: Error) => toast.error(formatIssueLockHint(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteIssue(id),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: issuesQueryKey });
      void qc.invalidateQueries({ queryKey: ["issues", "project"], exact: false });
      const st = useViewerStore.getState();
      const ann = st.annotations.find((a) => a.linkedIssueId === id);
      if (ann) removeAnnotation(ann.id);
      toast.success("Issue deleted");
      onClose();
    },
    onError: (e: Error) => toast.error(formatIssueLockHint(e)),
  });

  const annotationId = variant === "create" ? props.annotationId : "";

  const canSubmit =
    Boolean(workspaceId && fileId && cloudFileVersionId && title.trim().length > 0) &&
    (variant === "edit" || (Boolean(annotationId) && sheetContext.pageNumber != null));

  const assignableMembers = (membersRes?.members ?? []).filter((m) => m.email?.trim());

  /** Only Cancel / successful Save / Delete — not backdrop or Escape. */
  const onCancel = useCallback(() => {
    if (deleteDialogOpen) return;
    if (createMut.isPending || saveEditMut.isPending || deleteMut.isPending) return;
    if (variant === "create") {
      removeAnnotation(annotationId);
      setIssueCreateDraft(null);
    }
    onClose();
  }, [
    annotationId,
    createMut.isPending,
    deleteMut.isPending,
    onClose,
    removeAnnotation,
    saveEditMut.isPending,
    setIssueCreateDraft,
    variant,
    deleteDialogOpen,
  ]);

  if (!open || !mounted || typeof document === "undefined") return null;

  const versionLabel =
    sheetContext.sheetVersion != null ? `v${sheetContext.sheetVersion}` : "Version —";
  const pageLabel = sheetContext.pageNumber != null ? `Page ${sheetContext.pageNumber}` : "Page —";

  return createPortal(
    <>
      <div className="fixed inset-0 z-[120]" role="presentation">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          aria-hidden
          onMouseDown={(e) => e.preventDefault()}
        />
        <aside
          role="dialog"
          aria-modal
          aria-labelledby="issue-form-title"
          className="absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-[#334155] bg-[#0f172a] shadow-[0_0_40px_rgba(0,0,0,0.45)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center border-b border-[#334155] px-4 py-3">
            <h2 id="issue-form-title" className="text-[13px] font-semibold text-[#F8FAFC]">
              {variant === "create" ? "New issue" : "Edit issue"}
            </h2>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
            <div className="mb-4 space-y-2 rounded-lg border border-[#334155] bg-[#1e293b]/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
                Saved on sheet
              </p>
              <div className="flex items-start gap-2 text-[11px] leading-snug text-[#e2e8f0]">
                <FileStack className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} />
                <span className="min-w-0 break-all font-medium">{sheetContext.sheetName}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#94a3b8]">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <span className="text-[#64748b]">Revision</span> {versionLabel}
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Hash className="h-3 w-3 text-[#64748b]" strokeWidth={2} />
                  {pageLabel}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
                  Title
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Issue title"
                  className="w-full rounded-md border border-[#475569] bg-[#0F172A] px-2.5 py-2 text-[12px] text-[#F8FAFC] placeholder:text-[#64748B] outline-none focus:border-[var(--viewer-primary)]/50 focus:ring-1 focus:ring-[var(--viewer-primary)]/35"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
                  Description
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details, steps to reproduce…"
                  rows={3}
                  className="w-full resize-none rounded-md border border-[#475569] bg-[#0F172A] px-2.5 py-2 text-[12px] text-[#F8FAFC] placeholder:text-[#64748B] outline-none focus:border-[var(--viewer-primary)]/50 focus:ring-1 focus:ring-[var(--viewer-primary)]/35"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
                    Status
                  </span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="viewer-input-select w-full max-w-none py-2 text-[11px]"
                  >
                    {ISSUE_STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {ISSUE_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
                    Priority
                  </span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="viewer-input-select w-full max-w-none py-2 text-[11px]"
                  >
                    {ISSUE_PRIORITY_ORDER.map((p) => (
                      <option key={p} value={p}>
                        {ISSUE_PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
                  Location / grid ref
                </span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Grid B-2, Level 3"
                  className="w-full rounded-md border border-[#475569] bg-[#0F172A] px-2.5 py-2 text-[12px] text-[#F8FAFC] placeholder:text-[#64748B] outline-none focus:border-[var(--viewer-primary)]/50 focus:ring-1 focus:ring-[var(--viewer-primary)]/35"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
                    Start date
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-md border border-[#475569] bg-[#0F172A] px-2 py-2 text-[11px] text-[#F8FAFC] outline-none focus:border-[var(--viewer-primary)]/50 focus:ring-1 focus:ring-[var(--viewer-primary)]/35"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
                    Due date
                  </span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-md border border-[#475569] bg-[#0F172A] px-2 py-2 text-[11px] text-[#F8FAFC] outline-none focus:border-[var(--viewer-primary)]/50 focus:ring-1 focus:ring-[var(--viewer-primary)]/35"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
                  Assignee
                </span>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-md border border-[#475569] bg-[#0F172A] px-2.5 py-2 text-[12px] text-[#F8FAFC] outline-none focus:border-[var(--viewer-primary)]/50 focus:ring-1 focus:ring-[var(--viewer-primary)]/35"
                >
                  <option value="">Unassigned</option>
                  {assignableMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name || m.email}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#334155] px-4 py-3">
            {variant === "edit" ? (
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => setDeleteDialogOpen(true)}
                className="viewer-focus-ring inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-red-100 hover:bg-red-950/80 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={createMut.isPending || saveEditMut.isPending}
                className="viewer-focus-ring rounded-md border border-[#475569] px-3 py-1.5 text-[11px] font-medium text-[#E2E8F0] hover:bg-[#334155] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit || createMut.isPending || saveEditMut.isPending}
                onClick={() => {
                  if (variant === "create") createMut.mutate();
                  else if (variant === "edit") saveEditMut.mutate(props.issue.id);
                }}
                className="viewer-focus-ring rounded-md bg-[#2563EB] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                {createMut.isPending || saveEditMut.isPending
                  ? "Saving…"
                  : variant === "create"
                    ? "Create issue"
                    : "Save"}
              </button>
            </div>
          </div>
        </aside>
      </div>
      {variant === "edit" ? (
        <DeleteIssueConfirmDialog
          open={deleteDialogOpen}
          issueTitle={props.issue.title}
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={() => {
            setDeleteDialogOpen(false);
            deleteMut.mutate(props.issue.id);
          }}
          isDeleting={deleteMut.isPending}
        />
      ) : null}
    </>,
    document.body,
  );
}
