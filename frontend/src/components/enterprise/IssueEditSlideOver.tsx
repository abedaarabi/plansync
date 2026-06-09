"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";
import { IssueReferencePhotosField } from "@/components/enterprise/IssueReferencePhotosField";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import {
  formatIssueLockHint,
  patchIssue,
  ProRequiredError,
  type IssueReferencePhotoRow,
  type IssueRow,
} from "@/lib/api-client";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_PRIORITY_ORDER,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  issueDateToInputValue,
} from "@/lib/issueStatusStyle";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FIELD_TEXTAREA,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";

type WorkspaceMember = { userId: string; name: string | null; email: string | null };

type Props = {
  open: boolean;
  issue: IssueRow | null;
  onClose: () => void;
  members: WorkspaceMember[];
  onSaved: (row: IssueRow) => void;
};

function issueSheetLabel(issue: IssueRow): string {
  const name = issue.sheetName?.trim() || issue.file?.name?.trim();
  if (!name) return "No sheet linked";
  const ver = issue.sheetVersion ?? issue.fileVersion?.version;
  return ver != null ? `${name} · v${ver}` : name;
}

export function IssueEditSlideOver({ open, issue, onClose, members, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageNum, setPageNum] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<IssueReferencePhotoRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !issue) return;
    setTitle(issue.title);
    setDescription(issue.description ?? "");
    setPageNum(issue.pageNumber != null ? String(issue.pageNumber) : "");
    setAssigneeId(issue.assigneeId ?? "");
    setStatus(issue.status);
    setPriority(issue.priority ?? "MEDIUM");
    setDueDate(issueDateToInputValue(issue.dueDate));
    setLocation(issue.location ?? "");
    setPhotos(issue.referencePhotos ?? []);
    setMsg(null);
  }, [open, issue]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!issue) throw new Error("Missing issue.");
      const pn = pageNum.trim() ? parseInt(pageNum, 10) : null;
      return patchIssue(issue.id, {
        title: title.trim(),
        description: description.trim() || null,
        assigneeId: assigneeId || null,
        status,
        priority,
        dueDate: dueDate.trim() || null,
        location: location.trim() || null,
        ...(issue.fileVersionId
          ? { pageNumber: pn != null && Number.isFinite(pn) ? pn : null }
          : {}),
      });
    },
    onSuccess: (row) => {
      onSaved(row);
      onClose();
      toast.success("Issue updated.");
    },
    onError: (e: Error) => {
      const text =
        e instanceof ProRequiredError ? "Pro subscription required." : formatIssueLockHint(e);
      setMsg(text);
      toast.error(text);
    },
  });

  if (!issue) return null;

  const hasSheet = Boolean(issue.fileVersionId);

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      form={{
        onSubmit: (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          saveMut.mutate();
        },
      }}
      ariaLabelledBy="issue-edit-title"
      panelMaxWidthClass="max-w-[min(calc(100dvw-16px),520px)]"
      bodyClassName="px-5 py-5"
      header={
        <div className="flex items-start gap-3 pr-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
            <Pencil className="h-5 w-5 text-[var(--enterprise-primary)]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2
              id="issue-edit-title"
              className="text-lg font-bold tracking-tight text-[var(--enterprise-text)]"
            >
              Edit issue
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-[var(--enterprise-text-muted)]">
              Update coordination issue details.
            </p>
          </div>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMut.isPending || !title.trim()}
            className="rounded-lg bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-60"
          >
            {saveMut.isPending ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {msg ? (
          <div
            className="rounded-xl border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-3 py-2 text-sm text-[var(--enterprise-semantic-danger-text)]"
            role="alert"
          >
            {msg}
          </div>
        ) : null}
        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Details</p>
          <div>
            <label htmlFor="issue-edit-title-input" className={MOBILE_FIELD_LABEL}>
              Title *
            </label>
            <input
              id="issue-edit-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              required
            />
          </div>
          <div>
            <label htmlFor="issue-edit-description" className={MOBILE_FIELD_LABEL}>
              Description
            </label>
            <textarea
              id="issue-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={MOBILE_FIELD_TEXTAREA}
            />
          </div>
        </div>
        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Drawing link</p>
          <div>
            <span className={MOBILE_FIELD_LABEL}>Linked sheet</span>
            <p className="mt-1 flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2.5 text-sm text-[var(--enterprise-text)]">
              <MapPin className="h-4 w-4 shrink-0 text-[var(--enterprise-primary)]" aria-hidden />
              {issueSheetLabel(issue)}
            </p>
            {!hasSheet ? (
              <p className="mt-1.5 text-xs text-[var(--enterprise-text-muted)]">
                Open the PDF viewer to link this issue to a drawing.
              </p>
            ) : null}
          </div>
          {hasSheet ? (
            <div>
              <label htmlFor="issue-edit-page" className={MOBILE_FIELD_LABEL}>
                Page number
              </label>
              <input
                id="issue-edit-page"
                type="number"
                min={1}
                value={pageNum}
                onChange={(e) => setPageNum(e.target.value)}
                className={MOBILE_FIELD_INPUT}
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="issue-edit-location" className={MOBILE_FIELD_LABEL}>
              Location / grid reference
            </label>
            <input
              id="issue-edit-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
        </div>
        <div className={MOBILE_FORM_SECTION}>
          <IssueReferencePhotosField
            issueId={issue.id}
            photos={photos}
            onPhotosChange={setPhotos}
            disabled={saveMut.isPending}
          />
        </div>
        <div className={`${MOBILE_FORM_SECTION} grid gap-4 sm:grid-cols-2`}>
          <p className="enterprise-type-label col-span-full text-[var(--enterprise-text-muted)]">
            Assignment
          </p>
          <div>
            <label htmlFor="issue-edit-status" className={MOBILE_FIELD_LABEL}>
              Status
            </label>
            <select
              id="issue-edit-status"
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
            <label htmlFor="issue-edit-priority" className={MOBILE_FIELD_LABEL}>
              Priority
            </label>
            <select
              id="issue-edit-priority"
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
            <label htmlFor="issue-edit-assignee" className={MOBILE_FIELD_LABEL}>
              Assignee
            </label>
            <select
              id="issue-edit-assignee"
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
            <label htmlFor="issue-edit-due" className={MOBILE_FIELD_LABEL}>
              Due date
            </label>
            <input
              id="issue-edit-due"
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
