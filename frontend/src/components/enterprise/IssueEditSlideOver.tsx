"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { IssueReferencePhotosField } from "@/components/enterprise/IssueReferencePhotosField";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import {
  EnterpriseInput,
  EnterpriseSelect,
  EnterpriseTextarea,
} from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
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
import { MOBILE_FORM_SECTION } from "@/lib/mobileFormStyles";

type WorkspaceMember = { userId: string; name: string | null; email: string | null };

export const issueEditSchema = z.object({
  assigneeId: z.string(),
  description: z.string(),
  dueDate: z.string(),
  location: z.string(),
  pageNum: z
    .string()
    .refine((value) => !value || (Number.isInteger(Number(value)) && Number(value) > 0), {
      message: "Enter a whole page number greater than zero.",
    }),
  priority: z.string(),
  status: z.string(),
  title: z.string().trim().min(1, "Enter a short issue title."),
});

type IssueEditValues = z.infer<typeof issueEditSchema>;

const ISSUE_EDIT_DEFAULTS: IssueEditValues = {
  assigneeId: "",
  description: "",
  dueDate: "",
  location: "",
  pageNum: "",
  priority: "MEDIUM",
  status: "OPEN",
  title: "",
};

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
  const form = useEnterpriseForm(issueEditSchema, ISSUE_EDIT_DEFAULTS);
  const [photos, setPhotos] = useState<IssueReferencePhotoRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !issue) return;
    form.reset({
      assigneeId: issue.assigneeId ?? "",
      description: issue.description ?? "",
      dueDate: issueDateToInputValue(issue.dueDate),
      location: issue.location ?? "",
      pageNum: issue.pageNumber != null ? String(issue.pageNumber) : "",
      priority: issue.priority ?? "MEDIUM",
      status: issue.status,
      title: issue.title,
    });
    setPhotos(issue.referencePhotos ?? []);
    setMsg(null);
  }, [form, issue, open]);

  const saveMut = useMutation({
    mutationFn: async (values: IssueEditValues) => {
      if (!issue) throw new Error("Missing issue.");
      const pn = values.pageNum.trim() ? parseInt(values.pageNum, 10) : null;
      return patchIssue(issue.id, {
        title: values.title.trim(),
        description: values.description.trim() || null,
        assigneeId: values.assigneeId || null,
        status: values.status,
        priority: values.priority,
        dueDate: values.dueDate.trim() || null,
        location: values.location.trim() || null,
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
        noValidate: true,
        onSubmit: form.handleSubmit((values) => saveMut.mutate(values)),
      }}
      ariaLabelledBy="issue-edit-title"
      header={
        <SlideOverHeader
          icon={Pencil}
          titleId="issue-edit-title"
          title="Edit issue"
          description="Update status, assignee, and coordination details."
        />
      }
      footer={
        <>
          <EnterpriseButton type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton type="submit" size="sm" loading={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save changes"}
          </EnterpriseButton>
        </>
      }
    >
      <EnterpriseForm
        form={form}
        formId="issue-edit-form"
        onSubmit={(values) => saveMut.mutate(values)}
        className="space-y-4"
      >
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
          <EnterpriseFormField<IssueEditValues> name="title" label="Title" required>
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<IssueEditValues> name="description" label="Description">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseTextarea
                {...field}
                id={id}
                rows={3}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </EnterpriseFormField>
        </div>
        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Drawing link</p>
          <div>
            <span className="enterprise-field-label">Linked sheet</span>
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
            <EnterpriseFormField<IssueEditValues> name="pageNum" label="Page number">
              {({ describedBy, field, id, invalid }) => (
                <EnterpriseInput
                  {...field}
                  id={id}
                  inputMode="numeric"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </EnterpriseFormField>
          ) : null}
          {issue.levelName ? (
            <p className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)]">
              <span className="font-medium text-[var(--enterprise-text-muted)]">Level · </span>
              {issue.levelName}
            </p>
          ) : null}
          <EnterpriseFormField<IssueEditValues> name="location" label="Location / grid reference">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </EnterpriseFormField>
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
          <EnterpriseFormField<IssueEditValues> name="status" label="Status">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                {ISSUE_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {ISSUE_STATUS_LABEL[s]}
                  </option>
                ))}
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<IssueEditValues> name="priority" label="Priority">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                {ISSUE_PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {ISSUE_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<IssueEditValues> name="assigneeId" label="Assignee">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name || m.email || m.userId}
                  </option>
                ))}
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<IssueEditValues> name="dueDate" label="Due date">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                type="date"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </EnterpriseFormField>
        </div>
      </EnterpriseForm>
    </EnterpriseSlideOver>
  );
}
