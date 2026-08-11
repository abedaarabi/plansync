"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  IssueReferencePhotosField,
  type IssuePendingPhoto,
} from "@/components/enterprise/IssueReferencePhotosField";
import {
  EnterpriseSlideOver,
  SlideOverHeader,
  SLIDE_OVER_BTN_PRIMARY,
  SLIDE_OVER_BTN_SECONDARY,
} from "@/components/enterprise/EnterpriseSlideOver";
import {
  groupSheetRows,
  sheetRowsForProject,
} from "@/components/enterprise/issueCreateSheetPicker";
import {
  createIssue,
  fetchProjects,
  formatIssueLockHint,
  ProRequiredError,
  uploadIssueReferencePhotoFile,
  type IssueRow,
} from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_PRIORITY_ORDER,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
} from "@/lib/issueStatusStyle";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";

type WorkspaceMember = { userId: string; name: string | null; email: string | null };

function revokePendingPhotos(list: IssuePendingPhoto[]) {
  for (const p of list) URL.revokeObjectURL(p.previewUrl);
}

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspaceId: string | undefined;
  wid: string | undefined;
  isPro: boolean;
  members: WorkspaceMember[];
  onCreated: (row: IssueRow) => void | Promise<void>;
};

export function IssueCreateSlideOver({
  open,
  onClose,
  projectId,
  workspaceId,
  wid,
  isPro,
  members,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sheetPick, setSheetPick] = useState("");
  const [pageNum, setPageNum] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<IssuePendingPhoto[]>([]);

  const reset = useCallback(() => {
    setPendingPhotos((prev) => {
      revokePendingPhotos(prev);
      return [];
    });
    setTitle("");
    setDescription("");
    setSheetPick("");
    setPageNum("");
    setAssigneeId("");
    setStatus("OPEN");
    setPriority("MEDIUM");
    setDueDate("");
    setLocation("");
    setMsg(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    reset();
  }, [onClose, reset]);

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && open && isPro),
  });
  const projectWithFiles = projects.find((p) => p.id === projectId);
  const sheetGrouped = useMemo(
    () => (projectWithFiles ? groupSheetRows(sheetRowsForProject(projectWithFiles)) : []),
    [projectWithFiles],
  );

  const createMut = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Missing workspace.");
      const hasSheet = sheetPick.includes("|");
      const [fileId, fileVersionId] = hasSheet ? sheetPick.split("|") : [undefined, undefined];
      const pn = pageNum.trim() ? parseInt(pageNum, 10) : undefined;
      return createIssue({
        workspaceId,
        projectId,
        ...(hasSheet && fileId && fileVersionId ? { fileId, fileVersionId } : {}),
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: assigneeId || undefined,
        status,
        priority,
        dueDate: dueDate.trim() || undefined,
        location: location.trim() || undefined,
        ...(hasSheet && Number.isFinite(pn) ? { pageNumber: pn } : {}),
        issueKind: "CONSTRUCTION",
      });
    },
    onSuccess: async (row) => {
      const pending = [...pendingPhotos];
      if (pending.length > 0) {
        try {
          for (const p of pending) {
            await uploadIssueReferencePhotoFile(row.id, p.file);
          }
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Issue created but some photos failed to upload.",
          );
        }
        revokePendingPhotos(pending);
      }
      await onCreated(row);
      handleClose();
      toast.success("Issue created.");
    },
    onError: (e: Error) => {
      const text =
        e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e);
      setMsg(text);
      toast.error(text);
    },
  });

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={handleClose}
      form={{
        onSubmit: (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          createMut.mutate();
        },
      }}
      ariaLabelledBy="issue-create-title"
      header={
        <SlideOverHeader
          icon={MapPin}
          titleId="issue-create-title"
          title="New issue"
          description="Title required. Optionally link a sheet and assign an owner."
        />
      }
      footer={
        <>
          <button type="button" onClick={handleClose} className={SLIDE_OVER_BTN_SECONDARY}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMut.isPending || !title.trim()}
            className={SLIDE_OVER_BTN_PRIMARY}
          >
            {createMut.isPending ? "Creating…" : "Create issue"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {msg ? (
          <div
            className="rounded-md border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-3 py-2 text-sm text-[var(--enterprise-semantic-danger-text)]"
            role="alert"
          >
            {msg}
          </div>
        ) : null}
        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Details</p>
          <div>
            <label htmlFor="issue-create-title-input" className={MOBILE_FIELD_LABEL}>
              Title *
            </label>
            <input
              id="issue-create-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              required
              placeholder="Short summary"
            />
          </div>
          <div>
            <label htmlFor="issue-create-description" className={MOBILE_FIELD_LABEL}>
              Description
            </label>
            <textarea
              id="issue-create-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={MOBILE_FIELD_TEXTAREA}
              placeholder="Context, scope, or steps to reproduce…"
            />
          </div>
        </div>
        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Drawing link</p>
          <div>
            <label htmlFor="issue-create-sheet" className={MOBILE_FIELD_LABEL}>
              Sheet
            </label>
            <select
              id="issue-create-sheet"
              value={sheetPick}
              onChange={(e) => setSheetPick(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              <option value="">No sheet linked</option>
              {sheetGrouped.map(({ group, items: sheetItems }) => (
                <optgroup key={group} label={group}>
                  {sheetItems.map((row) => (
                    <option
                      key={`${row.file.id}|${row.version.id}`}
                      value={`${row.file.id}|${row.version.id}`}
                    >
                      {row.file.name} (v{row.version.version})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {sheetGrouped.length === 0 ? (
              <p className="mt-1.5 text-xs text-[var(--enterprise-text-muted)]">
                Upload drawings in Project files first.
              </p>
            ) : null}
          </div>
          {sheetPick.includes("|") ? (
            <div>
              <label htmlFor="issue-create-page" className={MOBILE_FIELD_LABEL}>
                Page number
              </label>
              <input
                id="issue-create-page"
                type="number"
                min={1}
                value={pageNum}
                onChange={(e) => setPageNum(e.target.value)}
                className={MOBILE_FIELD_INPUT}
                placeholder="Optional — 1-based page"
              />
            </div>
          ) : null}
          {sheetPick.includes("|") ? (
            <p className="enterprise-type-caption text-[var(--enterprise-text-muted)]">
              If this sheet is assigned to a building level, the level is linked automatically on
              create.
            </p>
          ) : null}
          <div>
            <label htmlFor="issue-create-location" className={MOBILE_FIELD_LABEL}>
              Location / grid reference
            </label>
            <input
              id="issue-create-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              placeholder="e.g. Grid B-2, Level 3"
            />
          </div>
        </div>
        <div className={MOBILE_FORM_SECTION}>
          <IssueReferencePhotosField
            issueId={null}
            photos={[]}
            onPhotosChange={() => {}}
            pendingPhotos={pendingPhotos}
            onPendingPhotosChange={setPendingPhotos}
            disabled={createMut.isPending}
          />
        </div>
        <div className={`${MOBILE_FORM_SECTION} grid gap-4 sm:grid-cols-2`}>
          <p className="enterprise-type-label col-span-full text-[var(--enterprise-text-muted)]">
            Assignment
          </p>
          <div>
            <label htmlFor="issue-create-status" className={MOBILE_FIELD_LABEL}>
              Status
            </label>
            <select
              id="issue-create-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              {ISSUE_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {ISSUE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="issue-create-priority" className={MOBILE_FIELD_LABEL}>
              Priority
            </label>
            <select
              id="issue-create-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              {ISSUE_PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {ISSUE_PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="issue-create-assignee" className={MOBILE_FIELD_LABEL}>
              Assignee
            </label>
            <select
              id="issue-create-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.email || m.userId}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="issue-create-due" className={MOBILE_FIELD_LABEL}>
              Due date
            </label>
            <input
              id="issue-create-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
        </div>
      </div>
    </EnterpriseSlideOver>
  );
}
