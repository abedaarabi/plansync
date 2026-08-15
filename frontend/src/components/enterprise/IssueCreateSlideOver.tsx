"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  IssueReferencePhotosField,
  type IssuePendingPhoto,
} from "@/components/enterprise/IssueReferencePhotosField";
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
import { MOBILE_FORM_SECTION } from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";

type WorkspaceMember = { userId: string; name: string | null; email: string | null };

export const issueCreateSchema = z.object({
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
  sheetPick: z.string(),
  status: z.string(),
  title: z.string().trim().min(1, "Enter a short issue title."),
});

type IssueCreateValues = z.infer<typeof issueCreateSchema>;

const ISSUE_CREATE_DEFAULTS: IssueCreateValues = {
  assigneeId: "",
  description: "",
  dueDate: "",
  location: "",
  pageNum: "",
  priority: "MEDIUM",
  sheetPick: "",
  status: "OPEN",
  title: "",
};

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
  const form = useEnterpriseForm(issueCreateSchema, ISSUE_CREATE_DEFAULTS);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<IssuePendingPhoto[]>([]);

  const reset = useCallback(() => {
    setPendingPhotos((prev) => {
      revokePendingPhotos(prev);
      return [];
    });
    form.reset(ISSUE_CREATE_DEFAULTS);
    setMsg(null);
  }, [form]);

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
    mutationFn: async (values: IssueCreateValues) => {
      if (!workspaceId) throw new Error("Missing workspace.");
      const hasSheet = values.sheetPick.includes("|");
      const [fileId, fileVersionId] = hasSheet
        ? values.sheetPick.split("|")
        : [undefined, undefined];
      const pn = values.pageNum.trim() ? parseInt(values.pageNum, 10) : undefined;
      return createIssue({
        workspaceId,
        projectId,
        ...(hasSheet && fileId && fileVersionId ? { fileId, fileVersionId } : {}),
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        assigneeId: values.assigneeId || undefined,
        status: values.status,
        priority: values.priority,
        dueDate: values.dueDate.trim() || undefined,
        location: values.location.trim() || undefined,
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
        noValidate: true,
        onSubmit: form.handleSubmit((values) => createMut.mutate(values)),
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
          <EnterpriseButton type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton type="submit" size="sm" loading={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create issue"}
          </EnterpriseButton>
        </>
      }
    >
      <EnterpriseForm
        form={form}
        formId="issue-create-form"
        onSubmit={(values) => createMut.mutate(values)}
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
          <EnterpriseFormField<IssueCreateValues> name="title" label="Title" required>
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="Short summary"
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<IssueCreateValues> name="description" label="Description">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseTextarea
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                rows={3}
                placeholder="Context, scope, or steps to reproduce…"
              />
            )}
          </EnterpriseFormField>
        </div>
        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Drawing link</p>
          <EnterpriseFormField<IssueCreateValues> name="sheetPick" label="Sheet">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
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
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
          {sheetGrouped.length === 0 ? (
            <p className="-mt-2 text-xs text-[var(--enterprise-text-muted)]">
              Upload drawings in Project files first.
            </p>
          ) : null}
          {form.watch("sheetPick").includes("|") ? (
            <EnterpriseFormField<IssueCreateValues> name="pageNum" label="Page number">
              {({ describedBy, field, id, invalid }) => (
                <EnterpriseInput
                  {...field}
                  id={id}
                  type="text"
                  inputMode="numeric"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder="Optional — 1-based page"
                />
              )}
            </EnterpriseFormField>
          ) : null}
          {form.watch("sheetPick").includes("|") ? (
            <p className="enterprise-type-caption text-[var(--enterprise-text-muted)]">
              If this sheet is assigned to a building level, the level is linked automatically on
              create.
            </p>
          ) : null}
          <EnterpriseFormField<IssueCreateValues> name="location" label="Location / grid reference">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="e.g. Grid B-2, Level 3"
              />
            )}
          </EnterpriseFormField>
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
          <EnterpriseFormField<IssueCreateValues> name="status" label="Status">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                {ISSUE_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {ISSUE_STATUS_LABEL[status]}
                  </option>
                ))}
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<IssueCreateValues> name="priority" label="Priority">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                {ISSUE_PRIORITY_ORDER.map((priority) => (
                  <option key={priority} value={priority}>
                    {ISSUE_PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<IssueCreateValues> name="assigneeId" label="Assignee">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name || member.email || member.userId}
                  </option>
                ))}
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<IssueCreateValues> name="dueDate" label="Due date">
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
