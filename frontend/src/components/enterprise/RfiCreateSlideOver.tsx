"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { z } from "zod";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseMemberMultiPicker } from "@/components/enterprise/EnterpriseMemberMultiPicker";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import {
  EnterpriseInput,
  EnterpriseSelect,
  EnterpriseTextarea,
} from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import { RFI_PRIORITY_OPTIONS, RFI_RISK_OPTIONS } from "@/components/enterprise/rfiFormOptions";
import { RfiRelatedIssuesPicker } from "@/components/enterprise/RfiRelatedIssuesPicker";
import {
  groupSheetRows,
  sheetRowsForProject,
} from "@/components/enterprise/issueCreateSheetPicker";
import {
  createProjectRfi,
  fetchIssuesForProject,
  fetchProjectTeam,
  fetchProjects,
  ProRequiredError,
  type RfiRow,
} from "@/lib/api-client";
import { MOBILE_FORM_SECTION } from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  isPro: boolean;
  workspaceId?: string;
  onCreated: (rfi: RfiRow) => void;
};

export const rfiCreateSchema = z.object({
  dueYmd: z.string(),
  fromDiscipline: z.string(),
  pageNum: z
    .string()
    .refine((value) => !value || (Number.isInteger(Number(value)) && Number(value) > 0), {
      message: "Enter a whole page number greater than zero.",
    }),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  question: z.string().trim().min(1, "Enter the question that needs an official answer."),
  risk: z.enum(["", "low", "med", "high"]),
  sheetPick: z.string(),
  title: z.string().trim().min(1, "Enter a short RFI title."),
});

type RfiCreateValues = z.infer<typeof rfiCreateSchema>;

const RFI_CREATE_DEFAULTS: RfiCreateValues = {
  dueYmd: "",
  fromDiscipline: "",
  pageNum: "",
  priority: "MEDIUM",
  question: "",
  risk: "",
  sheetPick: "",
  title: "",
};

// fallow-ignore-next-line complexity
export function RfiCreateSlideOver({
  open,
  onClose,
  projectId,
  isPro,
  workspaceId,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const form = useEnterpriseForm(rfiCreateSchema, RFI_CREATE_DEFAULTS);
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [issueIds, setIssueIds] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const reset = useCallback(() => {
    form.reset(RFI_CREATE_DEFAULTS);
    setAssignUserIds([]);
    setIssueIds([]);
    setMsg(null);
  }, [form]);

  const handleClose = useCallback(() => {
    onClose();
    reset();
  }, [onClose, reset]);

  const { data: team } = useQuery({
    queryKey: qk.projectTeam(projectId),
    queryFn: () => fetchProjectTeam(projectId),
    enabled: Boolean(projectId && open),
  });

  const { data: issues = [] } = useQuery({
    queryKey: qk.issuesForProject(projectId),
    queryFn: () => fetchIssuesForProject(projectId),
    enabled: Boolean(projectId && open && isPro),
  });

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects(workspaceId ?? ""),
    queryFn: () => fetchProjects(workspaceId!),
    enabled: Boolean(workspaceId && open && isPro),
  });

  const project = projects.find((p) => p.id === projectId);
  const sheetGrouped = useMemo(
    () => (project ? groupSheetRows(sheetRowsForProject(project)) : []),
    [project],
  );

  const assignablePickRows = useMemo(() => {
    return (team?.members ?? [])
      .filter((m) => m.access === "full" || m.access === "project")
      .map((m) => ({ userId: m.userId, name: m.name, email: m.email }));
  }, [team]);

  const createMut = useMutation({
    mutationFn: (values: RfiCreateValues) => {
      let fileId: string | undefined;
      let fileVersionId: string | undefined;
      if (issueIds.length === 0 && values.sheetPick.includes("|")) {
        const [f, v] = values.sheetPick.split("|");
        if (f && v) {
          fileId = f;
          fileVersionId = v;
        }
      }
      const pn = values.pageNum.trim() ? parseInt(values.pageNum, 10) : undefined;
      return createProjectRfi(projectId, {
        title: values.title.trim(),
        description: values.question.trim(),
        fromDiscipline: values.fromDiscipline.trim() || undefined,
        assigneeUserIds: assignUserIds.length > 0 ? assignUserIds : undefined,
        dueDate: values.dueYmd.trim() ? values.dueYmd.trim() : null,
        priority: values.priority,
        risk: values.risk === "" ? null : values.risk,
        issueIds: issueIds.length > 0 ? issueIds : undefined,
        fileId,
        fileVersionId,
        pageNumber: Number.isFinite(pn) ? pn : undefined,
      });
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
      handleClose();
      onCreated(data);
    },
    onError: (e: Error) => {
      if (e instanceof ProRequiredError) setMsg("Pro subscription required.");
      else setMsg(e.message);
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
      ariaLabelledBy="rfi-create-title"
      header={
        <SlideOverHeader
          icon={MessageSquareText}
          titleId="rfi-create-title"
          title="New RFI"
          description="Title and question required. Assign responders before review."
        />
      }
      footer={
        <>
          <EnterpriseButton type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton type="submit" size="sm" loading={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create RFI"}
          </EnterpriseButton>
        </>
      }
    >
      <EnterpriseForm
        form={form}
        formId="rfi-create-form"
        onSubmit={(values) => createMut.mutate(values)}
        className="space-y-4"
      >
        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Details</p>
          <EnterpriseFormField<RfiCreateValues> name="title" label="Title" required>
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="Wall thickness clarification"
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<RfiCreateValues> name="question" label="Question" required>
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseTextarea
                {...field}
                id={id}
                rows={4}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="Describe what needs an official answer…"
              />
            )}
          </EnterpriseFormField>
        </div>
        <div className={`${MOBILE_FORM_SECTION} grid gap-4`}>
          <EnterpriseFormField<RfiCreateValues> name="fromDiscipline" label="From discipline">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="GC, Structural, MEP…"
              />
            )}
          </EnterpriseFormField>
          <div className="sm:col-span-2">
            <p className="enterprise-field-label">Responders (optional)</p>
            <div className="mt-1">
              {assignablePickRows.length === 0 ? (
                <p className="text-xs text-[var(--enterprise-text-muted)]">No members yet.</p>
              ) : (
                <EnterpriseMemberMultiPicker
                  members={assignablePickRows}
                  value={assignUserIds}
                  onChange={setAssignUserIds}
                  disabled={createMut.isPending}
                  emptyMessage="No one matches that search."
                />
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              Search and add people. Any selected person can receive the review and submit the
              answer. Leave empty to assign later.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <EnterpriseFormField<RfiCreateValues> name="dueYmd" label="Due date">
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
          <EnterpriseFormField<RfiCreateValues> name="priority" label="Priority">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                {RFI_PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<RfiCreateValues> name="risk" label="Risk">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                {RFI_RISK_OPTIONS.map((opt) => (
                  <option key={opt.value || "none"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
        </div>
        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
            Related issues
          </p>
          <p className="enterprise-field-label">Link site issues (optional)</p>
          <RfiRelatedIssuesPicker
            issues={issues}
            value={issueIds}
            onChange={(ids) => {
              setIssueIds(ids);
              if (ids.length > 0) form.setValue("sheetPick", "");
            }}
            disabled={createMut.isPending}
          />
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
            {issueIds.length > 0
              ? `${issueIds.length} linked · sheet defaults from the first issue unless you pick a drawing below.`
              : "Search and select one or more issues, or leave empty and link a drawing below."}
          </p>
        </div>
        {issueIds.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <EnterpriseFormField<RfiCreateValues>
                name="sheetPick"
                label="Link to drawing (optional)"
              >
                {({ describedBy, field, id, invalid }) => (
                  <EnterpriseSelect
                    {...field}
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  >
                    <option value="">— Select sheet & revision —</option>
                    {sheetGrouped.map(({ group, items }) => (
                      <optgroup key={group} label={group}>
                        {items.map(({ file, version }) => (
                          <option
                            key={`${file.id}|${version.id}`}
                            value={`${file.id}|${version.id}`}
                          >
                            {file.name} · v{version.version}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </EnterpriseSelect>
                )}
              </EnterpriseFormField>
              {project && sheetGrouped.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                  No drawings in this project yet. Add PDFs under Files, then link a sheet here.
                </p>
              ) : null}
            </div>
            <EnterpriseFormField<RfiCreateValues> name="pageNum" label="Page (optional)">
              {({ describedBy, field, id, invalid }) => (
                <EnterpriseInput
                  {...field}
                  id={id}
                  inputMode="numeric"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder="1"
                />
              )}
            </EnterpriseFormField>
          </div>
        ) : null}
        {msg ? (
          <p className="text-sm text-[var(--enterprise-semantic-danger-text)]" role="alert">
            {msg}
          </p>
        ) : null}
      </EnterpriseForm>
    </EnterpriseSlideOver>
  );
}
