"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ChevronDown, FileStack, Hash, Link2, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createIssue,
  deleteIssue,
  fetchProject,
  fetchProjectRfis,
  fetchResolvedFileRevision,
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
import { ViewerUserThumb } from "./ViewerUserThumb";

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
  const projectIdFromUrl = searchParams.get("projectId")?.trim() || null;
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

  /** Project id when store/URL lack it: resolve file revision (create flow only). */
  const { data: revisionResolve, isPending: resolveProjectPending } =
    useResolvedFileRevisionProjectQuery({
      fileId,
      parsedUrlVersion,
      enabled: Boolean(
        variant === "create" && open && fileId && !viewerProjectId && !projectIdFromUrl,
      ),
    });

  const resolvedProjectId = useMemo(() => {
    if (variant === "edit") return props.issue.projectId;
    return viewerProjectId ?? projectIdFromUrl ?? revisionResolve?.projectId ?? null;
  }, [variant, props, viewerProjectId, projectIdFromUrl, revisionResolve?.projectId]);

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
    queryKey: qk.project(resolvedProjectId ?? ""),
    queryFn: () => fetchProject(resolvedProjectId!),
    enabled: Boolean(resolvedProjectId && open),
  });
  const workspaceId = project?.workspaceId;

  const { data: membersRes } = useQuery({
    queryKey: qk.workspaceMembers(workspaceId ?? ""),
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: Boolean(workspaceId) && open,
  });

  const viewerOperationsMode = useViewerStore((s) => s.viewerOperationsMode);
  const issuesQueryKey = qk.issuesForFileVersion(
    cloudFileVersionId ?? "",
    viewerOperationsMode ? "WORK_ORDER" : null,
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [priority, setPriority] = useState("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState("");
  /** Optional: attach this issue to one or more project RFIs (create + edit). */
  const [rfiLinkIds, setRfiLinkIds] = useState<string[]>([]);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");
  const assigneePickerRef = useRef<HTMLDivElement>(null);
  const assigneeSearchInputRef = useRef<HTMLInputElement>(null);

  const {
    data: projectRfis = [],
    isPending: rfisPending,
    isError: rfisError,
  } = useQuery({
    queryKey: qk.projectRfis(resolvedProjectId ?? ""),
    queryFn: () => fetchProjectRfis(resolvedProjectId!),
    enabled: Boolean(
      open &&
      resolvedProjectId &&
      (variant === "create" || variant === "edit") &&
      !viewerOperationsMode,
    ),
  });

  const linkableRfis = useMemo(() => {
    const norm = (s: string) => s.trim().toUpperCase();
    return projectRfis.filter((r) => norm(r.status) !== "CLOSED");
  }, [projectRfis]);

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
      setRfiLinkIds(i.linkedRfis.map((r) => r.id));
    } else {
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setStatus("OPEN");
      setPriority("MEDIUM");
      setStartDate("");
      setDueDate("");
      setLocation("");
      setRfiLinkIds([]);
    }
  }, [
    open,
    props.variant,
    props.variant === "edit" ? props.issue.id : props.annotationId,
    props.variant === "edit" ? props.issue.updatedAt : "",
  ]);

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
        ...(rfiLinkIds.length > 0 && !viewerOperationsMode ? { rfiIds: rfiLinkIds } : {}),
        ...(viewerOperationsMode ? { issueKind: "WORK_ORDER" as const } : {}),
      });
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: issuesQueryKey });
      void qc.invalidateQueries({ queryKey: ["issues", "project"], exact: false });
      if (resolvedProjectId)
        void qc.invalidateQueries({ queryKey: qk.projectRfis(resolvedProjectId) });
      if (variant === "create") {
        updateAnnotation(props.annotationId, {
          linkedIssueId: row.id,
          issueDraft: false,
          linkedIssueTitle: row.title,
          issueStatus: row.status,
          color: issueStatusMarkerStrokeHex(row.status),
          linkedIssueKind: row.issueKind === "WORK_ORDER" ? "WORK_ORDER" : "CONSTRUCTION",
        });
        setIssueCreateDraft(null);
        onClose();
      }
      toast.success(viewerOperationsMode ? "Work order created" : "Issue created");
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
        ...(!viewerOperationsMode ? { rfiIds: rfiLinkIds } : {}),
      });
    },
    onSuccess: (row) => {
      qc.setQueryData(issuesQueryKey, (old: IssueRow[] | undefined) => {
        if (!old) return old;
        return old.map((i) => (i.id === row.id ? row : i));
      });
      void qc.invalidateQueries({ queryKey: ["issues", "project"], exact: false });
      if (resolvedProjectId)
        void qc.invalidateQueries({ queryKey: qk.projectRfis(resolvedProjectId) });
      const ann = useViewerStore.getState().annotations.find((a) => a.linkedIssueId === row.id);
      if (ann) {
        updateAnnotation(ann.id, {
          issueStatus: row.status,
          linkedIssueTitle: row.title,
          color: issueStatusMarkerStrokeHex(row.status),
          linkedIssueKind: row.issueKind === "WORK_ORDER" ? "WORK_ORDER" : "CONSTRUCTION",
        });
      }
      toast.success(viewerOperationsMode ? "Work order updated" : "Issue updated");
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

  const assigneePickerMembersFiltered = useMemo(() => {
    const q = assigneeSearchQuery.trim().toLowerCase();
    if (!q) return assignableMembers;
    return assignableMembers.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [assignableMembers, assigneeSearchQuery]);

  const issueAssignee = props.variant === "edit" ? props.issue.assignee : null;
  const issueAssigneeId = props.variant === "edit" ? props.issue.assigneeId : null;

  const assigneeDisplay = useMemo(() => {
    if (!assigneeId) return null;
    const fromMembers = assignableMembers.find((m) => m.userId === assigneeId);
    if (fromMembers) {
      return {
        name: fromMembers.name,
        email: fromMembers.email,
        image: fromMembers.image ?? null,
      };
    }
    if (issueAssigneeId === assigneeId && issueAssignee) {
      return {
        name: issueAssignee.name,
        email: issueAssignee.email,
        image: issueAssignee.image ?? null,
      };
    }
    return { name: "Teammate", email: "", image: null as string | null };
  }, [assigneeId, assignableMembers, issueAssignee, issueAssigneeId]);

  useEffect(() => {
    if (!assigneePickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!assigneePickerRef.current?.contains(e.target as Node)) setAssigneePickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [assigneePickerOpen]);

  useEffect(() => {
    if (!open) setAssigneePickerOpen(false);
  }, [open]);

  useEffect(() => {
    if (!assigneePickerOpen) setAssigneeSearchQuery("");
  }, [assigneePickerOpen]);

  /** Only Cancel / successful Save / Delete — backdrop and Escape use the same handler. */
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

  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (deleteDialogOpen) return;
      if (assigneePickerOpen) {
        e.preventDefault();
        setAssigneePickerOpen(false);
        return;
      }
      e.preventDefault();
      onCancelRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, assigneePickerOpen, deleteDialogOpen]);

  if (!open || !mounted || typeof document === "undefined") return null;

  const versionLabel =
    sheetContext.sheetVersion != null ? `v${sheetContext.sheetVersion}` : "Version —";
  const pageLabel = sheetContext.pageNumber != null ? `Page ${sheetContext.pageNumber}` : "Page —";

  const fieldClass =
    "w-full rounded-lg border border-slate-600/70 bg-slate-900/60 px-2.5 py-2 text-[12px] leading-snug text-slate-100 shadow-sm placeholder:text-slate-500 outline-none transition focus:border-[var(--viewer-primary)]/55 focus:ring-2 focus:ring-[var(--viewer-primary)]/20";
  /** Native date picker icon: align with dark chrome (WebKit + `color-scheme`). */
  /** Calendar glyph → solid white (WebKit); `color-scheme: dark` helps Firefox/native chrome. */
  const dateFieldClass = `${fieldClass} tabular-nums [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:[filter:brightness(0)_invert(1)]`;
  const labelClass = "mb-1 block text-[10px] font-medium text-slate-400";
  const sectionTitleClass = "text-[10px] font-semibold uppercase tracking-wider text-slate-500";

  return createPortal(
    <>
      <div className="fixed inset-0 z-[120]" role="presentation">
        <button
          type="button"
          aria-label="Close issue form"
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-[3px] transition hover:bg-slate-950/70"
          onClick={onCancel}
          onMouseDown={(e) => e.preventDefault()}
        />
        <aside
          role="dialog"
          aria-modal
          aria-labelledby="issue-form-title"
          className="absolute right-0 top-0 flex h-full w-full max-w-[min(640px,calc(100vw-1rem))] flex-col border-l border-slate-700/80 bg-slate-950 shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.55)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/90 bg-slate-950 px-5 py-3.5">
            <div className="min-w-0 space-y-0.5 pr-2">
              <h2
                id="issue-form-title"
                className="text-[15px] font-semibold tracking-tight text-white"
              >
                {variant === "create" ? "New issue" : "Edit issue"}
              </h2>
              <p className="text-[11px] leading-relaxed text-slate-500">
                {variant === "create"
                  ? "The pin is saved on the sheet. Add a title and any details below."
                  : "Update this issue and save your changes."}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={createMut.isPending || saveEditMut.isPending || deleteMut.isPending}
              className="viewer-focus-ring shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-color:rgba(71,85,105,0.5)_transparent] [scrollbar-width:thin]">
            <div
              className="mb-4 flex flex-col gap-1.5 rounded-lg border border-slate-800/90 bg-slate-900/50 px-3 py-2 ring-1 ring-white/[0.03] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-1"
              role="group"
              aria-label="Sheet context"
            >
              <div className="flex min-w-0 items-start gap-2 sm:items-center">
                <FileStack
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 sm:mt-0"
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="min-w-0 text-[11px] font-medium leading-snug text-slate-200 [overflow-wrap:anywhere]">
                  {sheetContext.sheetName}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                <span className="inline-flex items-center rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-400">
                  Rev {versionLabel}
                </span>
                <span className="inline-flex items-center gap-0.5 rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-400">
                  <Hash className="h-2.5 w-2.5 text-slate-500" strokeWidth={2} aria-hidden />
                  {pageLabel}
                </span>
              </div>
            </div>

            <div className="space-y-6 pb-2">
              <section className="space-y-3" aria-labelledby="issue-section-details">
                <h3 id="issue-section-details" className={sectionTitleClass}>
                  Details
                </h3>
                <label className="block">
                  <span className={labelClass}>Title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Short summary of the issue"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Context, scope, or steps to reproduce…"
                    rows={3}
                    className={`${fieldClass} min-h-[4.75rem] resize-y`}
                  />
                </label>
              </section>

              {!viewerOperationsMode ? (
                <section
                  className="rounded-xl border border-slate-800/80 bg-slate-900/25 p-3 ring-1 ring-white/[0.02]"
                  aria-labelledby="issue-section-rfis"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Link2 className="h-3 w-3 text-slate-500" strokeWidth={2} aria-hidden />
                    <h3 id="issue-section-rfis" className={sectionTitleClass}>
                      Related RFIs{" "}
                      <span className="font-normal normal-case text-slate-600">(optional)</span>
                    </h3>
                  </div>
                  {variant === "create" && !resolvedProjectId ? (
                    resolveProjectPending ? (
                      <p className="text-[12px] text-slate-500">Finding project…</p>
                    ) : (
                      <p className="text-[12px] leading-relaxed text-slate-500">
                        Open this drawing from the project’s Files tab (or a viewer link with the
                        project) to list RFIs for this job.
                      </p>
                    )
                  ) : rfisPending ? (
                    <p className="text-[12px] text-slate-500">Loading RFIs…</p>
                  ) : rfisError ? (
                    <p className="text-[12px] leading-relaxed text-amber-200/90">
                      Could not load RFIs. A Pro subscription and project access are required.
                    </p>
                  ) : linkableRfis.length === 0 ? (
                    <p className="text-[12px] leading-relaxed text-slate-500">
                      No open RFIs in this project. Create RFIs from the project RFIs page, then
                      link them here.
                    </p>
                  ) : (
                    <>
                      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-800/60 bg-slate-950/40 p-1 [scrollbar-width:thin]">
                        {linkableRfis.map((r) => (
                          <label
                            key={r.id}
                            className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-[12px] leading-snug text-slate-200 transition hover:bg-slate-800/50"
                          >
                            <input
                              type="checkbox"
                              className="viewer-focus-ring mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 accent-[var(--viewer-primary)]"
                              checked={rfiLinkIds.includes(r.id)}
                              onChange={() => {
                                setRfiLinkIds((prev) =>
                                  prev.includes(r.id)
                                    ? prev.filter((x) => x !== r.id)
                                    : [...prev, r.id],
                                );
                              }}
                            />
                            <span className="min-w-0">
                              <span className="font-medium text-slate-300">
                                RFI #{String(r.rfiNumber).padStart(3, "0")}
                              </span>
                              <span className="text-slate-500"> — </span>
                              {r.title}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                        {variant === "create"
                          ? "Linked RFIs without a sheet use this drawing and page. You can attach several RFIs to one issue."
                          : "This replaces linked RFIs for the issue. RFIs without a sheet may adopt this drawing when you save."}
                      </p>
                    </>
                  )}
                </section>
              ) : null}

              <section className="space-y-3" aria-labelledby="issue-section-workflow">
                <h3 id="issue-section-workflow" className={sectionTitleClass}>
                  Status & assignment
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Status</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="viewer-input-select w-full max-w-none rounded-lg py-2 text-[12px]"
                    >
                      {ISSUE_STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {ISSUE_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>Priority</span>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="viewer-input-select w-full max-w-none rounded-lg py-2 text-[12px]"
                    >
                      {ISSUE_PRIORITY_ORDER.map((p) => (
                        <option key={p} value={p}>
                          {ISSUE_PRIORITY_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div ref={assigneePickerRef} className="relative block">
                  <span className={labelClass} id="issue-form-assignee-label">
                    Assignee
                  </span>
                  <button
                    type="button"
                    id="issue-form-assignee-trigger"
                    aria-labelledby="issue-form-assignee-label"
                    aria-haspopup="listbox"
                    aria-expanded={assigneePickerOpen}
                    onClick={() => {
                      setAssigneePickerOpen((o) => {
                        const next = !o;
                        if (next) queueMicrotask(() => assigneeSearchInputRef.current?.focus());
                        return next;
                      });
                    }}
                    className="viewer-focus-ring flex w-full items-center gap-2 rounded-lg border border-slate-600/70 bg-slate-900/60 px-2.5 py-2 text-left text-[12px] text-slate-100 shadow-sm outline-none transition focus:border-[var(--viewer-primary)]/55 focus:ring-2 focus:ring-[var(--viewer-primary)]/20"
                  >
                    {assigneeDisplay ? (
                      <>
                        <ViewerUserThumb
                          name={assigneeDisplay.name}
                          email={assigneeDisplay.email}
                          image={assigneeDisplay.image}
                          className="h-7 w-7 text-[9px]"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {assigneeDisplay.name || assigneeDisplay.email}
                        </span>
                      </>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-slate-500">
                        Choose a teammate…
                      </span>
                    )}
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${assigneePickerOpen ? "rotate-180" : ""}`}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </button>
                  {assigneePickerOpen ? (
                    <div
                      className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-700/90 bg-slate-900 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)] ring-1 ring-black/20"
                      role="presentation"
                    >
                      <div className="border-b border-slate-800 p-2.5">
                        <div className="relative">
                          <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <input
                            ref={assigneeSearchInputRef}
                            type="search"
                            value={assigneeSearchQuery}
                            onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                            placeholder="Search by name or email…"
                            autoComplete="off"
                            aria-label="Filter assignees by name or email"
                            className="viewer-focus-ring w-full rounded-lg border border-slate-700/80 bg-slate-950 py-1.5 pl-8 pr-2.5 text-[11px] text-slate-100 placeholder:text-slate-500 outline-none focus:border-[var(--viewer-primary)]/50 focus:ring-2 focus:ring-[var(--viewer-primary)]/15"
                          />
                        </div>
                      </div>
                      <ul
                        role="listbox"
                        aria-labelledby="issue-form-assignee-label"
                        className="max-h-48 overflow-y-auto py-1 [scrollbar-width:thin]"
                      >
                        <li role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={assigneeId === ""}
                            onClick={() => {
                              setAssigneeId("");
                              setAssigneePickerOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] transition ${
                              assigneeId === ""
                                ? "bg-[var(--viewer-primary-muted)] text-white"
                                : "text-slate-200 hover:bg-slate-800/80"
                            }`}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-600 text-[10px] text-slate-500">
                              —
                            </span>
                            <span>Unassigned</span>
                          </button>
                        </li>
                        {assigneePickerMembersFiltered.map((m) => {
                          const selected = assigneeId === m.userId;
                          return (
                            <li key={m.userId} role="presentation">
                              <button
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onClick={() => {
                                  setAssigneeId(m.userId);
                                  setAssigneePickerOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] transition ${
                                  selected
                                    ? "bg-[var(--viewer-primary-muted)] text-white"
                                    : "text-slate-200 hover:bg-slate-800/80"
                                }`}
                              >
                                <ViewerUserThumb
                                  name={m.name}
                                  email={m.email}
                                  image={m.image}
                                  className="h-7 w-7 text-[9px]"
                                />
                                <span className="min-w-0 flex-1 truncate">{m.name || m.email}</span>
                              </button>
                            </li>
                          );
                        })}
                        {assignableMembers.length > 0 &&
                        assigneePickerMembersFiltered.length === 0 ? (
                          <li className="px-3 py-5 text-center text-[12px] text-slate-500">
                            No matches for &ldquo;{assigneeSearchQuery.trim()}&rdquo;
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="space-y-3" aria-labelledby="issue-section-schedule">
                <h3 id="issue-section-schedule" className={sectionTitleClass}>
                  Location & dates
                </h3>
                <label className="block">
                  <span className={labelClass}>Location / grid reference</span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Grid B-2, Level 3"
                    className={fieldClass}
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Start date</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={dateFieldClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Due date</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={dateFieldClass}
                    />
                  </label>
                </div>
              </section>
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-800/90 bg-slate-950/95 px-5 py-3.5 backdrop-blur-sm supports-[backdrop-filter]:bg-slate-950/80">
            {variant === "edit" ? (
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => setDeleteDialogOpen(true)}
                className="viewer-focus-ring inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-950/40 px-2.5 py-1.5 text-[11px] font-semibold text-red-100 transition hover:bg-red-950/65 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Delete
              </button>
            ) : (
              <span className="hidden min-[480px]:inline text-[10px] text-slate-600">
                Click outside to close
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={createMut.isPending || saveEditMut.isPending}
                className="viewer-focus-ring rounded-lg border border-slate-600/80 bg-transparent px-3 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-slate-800/80 disabled:opacity-40"
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
                className="viewer-focus-ring rounded-lg bg-[var(--viewer-primary)] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[var(--viewer-primary-hover)] disabled:opacity-40"
              >
                {createMut.isPending || saveEditMut.isPending
                  ? "Saving…"
                  : variant === "create"
                    ? "Create issue"
                    : "Save changes"}
              </button>
            </div>
          </footer>
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

function useResolvedFileRevisionProjectQuery(opts: {
  fileId: string | null;
  parsedUrlVersion: number | null;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: ["fileResolvedRevision", opts.fileId, opts.parsedUrlVersion] as const,
    queryFn: () => fetchResolvedFileRevision(opts.fileId!, opts.parsedUrlVersion ?? undefined),
    enabled: opts.enabled,
    retry: false,
  });
}
