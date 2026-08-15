"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MapPin, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
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
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  fetchIssuesForProject,
  fetchProjectTeam,
  HttpError,
  patchProjectRfi,
  ProRequiredError,
  viewerHrefForRfi,
  type RfiRow,
} from "@/lib/api-client";
import {
  issueDateToInputValue,
  RFI_STATUS_LABEL,
  rfiStatusBadgeClass,
} from "@/lib/issueStatusStyle";
import { MOBILE_FORM_SECTION } from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";
import { rfiAssigneeIds, rfiBallInCourt } from "@/lib/rfisOverviewStats";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  rfi: RfiRow | null;
};

export const rfiEditSchema = z.object({
  dueYmd: z.string(),
  fromDiscipline: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  question: z.string(),
  risk: z.enum(["", "low", "med", "high"]),
  title: z.string().trim().min(1, "Enter a short RFI title."),
});

type RfiEditValues = z.infer<typeof rfiEditSchema>;

const RFI_EDIT_DEFAULTS: RfiEditValues = {
  dueYmd: "",
  fromDiscipline: "",
  priority: "MEDIUM",
  question: "",
  risk: "",
  title: "",
};

function normStatus(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

// fallow-ignore-next-line complexity
export function RfiEditSlideOver({ open, onClose, projectId, rfi }: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const { me } = useEnterpriseWorkspace();
  const meId = me?.user.id ?? null;
  const form = useEnterpriseForm(rfiEditSchema, RFI_EDIT_DEFAULTS);
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [issueIds, setIssueIds] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [localRfi, setLocalRfi] = useState<RfiRow | null>(null);

  useEffect(() => {
    if (!open || !rfi) return;
    setLocalRfi(rfi);
    const priority =
      (rfi.priority || "MEDIUM").toUpperCase() === "HIGH"
        ? "HIGH"
        : (rfi.priority || "MEDIUM").toUpperCase() === "LOW"
          ? "LOW"
          : "MEDIUM";
    const rk = (rfi.risk ?? "").toLowerCase();
    form.reset({
      dueYmd: issueDateToInputValue(rfi.dueDate),
      fromDiscipline: rfi.fromDiscipline ?? "",
      priority,
      question: rfi.description ?? "",
      risk: rk === "low" || rk === "med" || rk === "high" ? rk : "",
      title: rfi.title,
    });
    setAssignUserIds(rfiAssigneeIds(rfi));
    setIssueIds((rfi.issues ?? []).map((i) => i.id));
    setMsg(null);
  }, [form, open, rfi]);

  const { data: team } = useQuery({
    queryKey: qk.projectTeam(projectId),
    queryFn: () => fetchProjectTeam(projectId),
    enabled: Boolean(projectId && open),
  });

  const { data: projectIssues = [] } = useQuery({
    queryKey: qk.issuesForProject(projectId),
    queryFn: () => fetchIssuesForProject(projectId),
    enabled: Boolean(projectId && open),
  });

  const assignablePickRows = useMemo(() => {
    return (team?.members ?? [])
      .filter((m) => m.access === "full" || m.access === "project")
      .map((m) => ({ userId: m.userId, name: m.name, email: m.email }));
  }, [team]);

  const active = localRfi ?? rfi;
  const st = active ? normStatus(active.status) : "";
  const isCreator = Boolean(meId && active?.creatorId === meId);
  const closed = st === "CLOSED";
  const viewerHref = active ? viewerHrefForRfi(active, projectId) : null;
  const detailHref = active ? `/projects/${projectId}/rfi/${active.id}` : "#";
  const ballInCourt = active ? rfiBallInCourt(active) : "—";

  const saveMut = useMutation({
    mutationFn: async (values: RfiEditValues) => {
      if (!active) throw new Error("Missing RFI.");
      return patchProjectRfi(projectId, active.id, {
        title: values.title.trim(),
        description: values.question.trim() || null,
        fromDiscipline: values.fromDiscipline.trim() || null,
        dueDate: values.dueYmd.trim() ? values.dueYmd.trim() : null,
        priority: values.priority,
        risk: values.risk === "" ? null : values.risk,
        assigneeUserIds: assignUserIds,
        issueIds,
      });
    },
    onSuccess: (row) => {
      setLocalRfi(row);
      setIssueIds((row.issues ?? []).map((i) => i.id));
      void qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
      void qc.invalidateQueries({ queryKey: qk.projectRfi(projectId, row.id) });
      toast.success("RFI updated.");
      onClose();
    },
    onError: (e: Error) => {
      const text =
        e instanceof ProRequiredError
          ? "Pro subscription required."
          : e instanceof HttpError
            ? e.message
            : e.message;
      setMsg(text);
      toast.error(text);
    },
  });

  const statusMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (!active) throw new Error("Missing RFI.");
      return patchProjectRfi(projectId, active.id, body);
    },
    onSuccess: (row) => {
      setLocalRfi(row);
      void qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
      toast.success("Status updated.");
      setMsg(null);
    },
    onError: (e: Error) => {
      const text =
        e instanceof ProRequiredError
          ? "Pro subscription required."
          : e instanceof HttpError
            ? e.message
            : e.message;
      setMsg(text);
      toast.error(text);
    },
  });

  if (!active) return null;

  const numLabel = `#${String(active.rfiNumber).padStart(3, "0")}`;
  const busy = saveMut.isPending || statusMut.isPending;

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      form={{
        noValidate: true,
        onSubmit: form.handleSubmit((values) => {
          if (!closed) saveMut.mutate(values);
        }),
      }}
      ariaLabelledBy="rfi-edit-title"
      header={
        <SlideOverHeader
          icon={MessageSquareText}
          titleId="rfi-edit-title"
          title={form.watch("title").trim() || "Edit RFI"}
          description={
            <>
              <span className="font-mono font-semibold tabular-nums">{numLabel}</span>
              {" · Ball in court: "}
              <span className="font-medium text-[var(--enterprise-text)]">{ballInCourt}</span>
            </>
          }
          badge={
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${rfiStatusBadgeClass(st)}`}
            >
              {RFI_STATUS_LABEL[st] ?? st.replace(/_/g, " ")}
            </span>
          }
        />
      }
      footer={
        <div className="flex w-full flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {st === "OPEN" && isCreator ? (
              <EnterpriseButton
                type="button"
                size="sm"
                loading={statusMut.isPending}
                disabled={assignUserIds.length === 0 && rfiAssigneeIds(active).length === 0}
                onClick={() =>
                  statusMut.mutate({
                    status: "IN_REVIEW",
                    ...(assignUserIds.length > 0 ? { assigneeUserIds: assignUserIds } : {}),
                  })
                }
              >
                Send for review
              </EnterpriseButton>
            ) : null}
            {st === "IN_REVIEW" ? (
              <EnterpriseButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => router.push(detailHref)}
              >
                Mark as answered
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </EnterpriseButton>
            ) : null}
            {st === "ANSWERED" && isCreator ? (
              <EnterpriseButton
                type="button"
                size="sm"
                loading={statusMut.isPending}
                onClick={() => statusMut.mutate({ status: "CLOSED" })}
              >
                Close RFI
              </EnterpriseButton>
            ) : null}
            {closed ? (
              <EnterpriseButton
                type="button"
                size="sm"
                variant="secondary"
                loading={statusMut.isPending}
                onClick={() => statusMut.mutate({ status: "IN_REVIEW" })}
              >
                Reopen
              </EnterpriseButton>
            ) : null}
          </div>
          <div className="flex w-full justify-end gap-2">
            <EnterpriseButton type="button" variant="secondary" onClick={onClose}>
              Cancel
            </EnterpriseButton>
            {!closed ? (
              <EnterpriseButton type="submit" loading={saveMut.isPending} disabled={busy}>
                {saveMut.isPending ? "Saving…" : "Save changes"}
              </EnterpriseButton>
            ) : null}
          </div>
        </div>
      }
    >
      <EnterpriseForm
        form={form}
        formId="rfi-edit-form"
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

        {st === "IN_REVIEW" ? (
          <p className="text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
            Recording an official answer requires selecting a discussion message.{" "}
            <Link
              href={detailHref}
              className="font-semibold text-[var(--enterprise-primary)] hover:underline"
            >
              Open full detail
            </Link>{" "}
            to mark as answered.
          </p>
        ) : null}

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Details</p>
          <EnterpriseFormField<RfiEditValues> name="title" label="Title" required>
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                disabled={closed || busy}
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<RfiEditValues> name="question" label="Question">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseTextarea
                {...field}
                id={id}
                rows={4}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                disabled={closed || busy}
              />
            )}
          </EnterpriseFormField>
        </div>

        <div className={`${MOBILE_FORM_SECTION} grid gap-4 sm:grid-cols-2`}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)] sm:col-span-2">
            Routing
          </p>
          <EnterpriseFormField<RfiEditValues> name="fromDiscipline" label="From discipline">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                disabled={closed || busy}
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<RfiEditValues> name="dueYmd" label="Due date">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                type="date"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                disabled={closed || busy}
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<RfiEditValues> name="priority" label="Priority">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                disabled={closed || busy}
              >
                {RFI_PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<RfiEditValues> name="risk" label="Risk">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                disabled={closed || busy}
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
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Responders</p>
          <p className="enterprise-field-label">Who can answer</p>
          <div className="mt-1">
            {assignablePickRows.length === 0 ? (
              <p className="text-xs text-[var(--enterprise-text-muted)]">No members yet.</p>
            ) : (
              <EnterpriseMemberMultiPicker
                members={assignablePickRows}
                value={assignUserIds}
                onChange={setAssignUserIds}
                disabled={closed || busy}
                emptyMessage="No one matches that search."
              />
            )}
          </div>
        </div>

        <div className={MOBILE_FORM_SECTION}>
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
            Related issues
          </p>
          <p className="enterprise-field-label">Linked site issues</p>
          <RfiRelatedIssuesPicker
            issues={projectIssues}
            value={issueIds}
            onChange={setIssueIds}
            disabled={closed || busy}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--enterprise-border)] pt-3">
          {viewerHref ? (
            <Link
              href={viewerHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
            >
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              Open in viewer
              {active.file?.name ? (
                <span className="font-normal text-[var(--enterprise-text-muted)]">
                  ({active.file.name}
                  {active.pageNumber != null ? ` · p.${active.pageNumber}` : ""})
                </span>
              ) : null}
            </Link>
          ) : null}
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
          >
            Open full detail
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </EnterpriseForm>
    </EnterpriseSlideOver>
  );
}
