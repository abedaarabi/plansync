"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import { EnterpriseInput, EnterpriseSelect } from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import { createFieldReport, ProRequiredError, type FieldReportRow } from "@/lib/api-client";
import { emptyDetails } from "@/lib/fieldReportUtils";
import { MOBILE_FORM_SECTION } from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Display names for the “Written by” select. */
  members: string[];
  defaultAuthor?: string;
  /** Prefill report date (`YYYY-MM-DD`), e.g. from missing-days CTA. */
  defaultDate?: string;
  onCreated: (report: FieldReportRow) => void;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export const fieldReportCreateSchema = z.object({
  author: z.string(),
  reportDate: z.string().trim().min(1, "Select a report date."),
});

type FieldReportCreateValues = z.infer<typeof fieldReportCreateSchema>;

export function FieldReportCreateSlideOver({
  open,
  onClose,
  projectId,
  members,
  defaultAuthor = "",
  defaultDate,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const form = useEnterpriseForm(fieldReportCreateSchema, {
    author: defaultAuthor.trim() || members[0] || "",
    reportDate: defaultDate?.trim() || todayYmd(),
  });
  const [msg, setMsg] = useState<string | null>(null);

  const reset = useCallback(() => {
    form.reset({
      author: defaultAuthor.trim() || members[0] || "",
      reportDate: defaultDate?.trim() || todayYmd(),
    });
    setMsg(null);
  }, [defaultAuthor, defaultDate, form, members]);

  const handleClose = useCallback(() => {
    onClose();
    reset();
  }, [onClose, reset]);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  const createMut = useMutation({
    mutationFn: (values: FieldReportCreateValues) =>
      createFieldReport(projectId, {
        reportDate: new Date(`${values.reportDate}T12:00:00.000Z`).toISOString(),
        reportKind: "DAILY",
        status: "DRAFT",
        authorLabel: values.author.trim() || undefined,
        details: emptyDetails(),
        totalWorkers: 0,
        photoCount: 0,
        issueCount: 0,
      }),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: qk.projectFieldReports(projectId) });
      handleClose();
      onCreated(row);
      toast.success("Report created.");
    },
    onError: (e: Error) => {
      const text =
        e instanceof ProRequiredError
          ? "Pro subscription required."
          : e.message || "Could not create report.";
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
      ariaLabelledBy="fr-create-title"
      header={
        <SlideOverHeader
          icon={ScrollText}
          titleId="fr-create-title"
          title="New field report"
          description="Daily site log. Weekly rollups are generated from dailies."
        />
      }
      footer={
        <>
          <EnterpriseButton type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton type="submit" size="sm" loading={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create"}
          </EnterpriseButton>
        </>
      }
    >
      <EnterpriseForm
        form={form}
        formId="field-report-create-form"
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
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Report</p>
          <div>
            <span className="enterprise-field-label">Type</span>
            <div className="mt-1 space-y-2 text-sm text-[var(--enterprise-text)]">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fr-type"
                  checked
                  onChange={() => {
                    /* Daily is the only creatable type */
                  }}
                />
                Daily
              </label>
              <label className="flex cursor-not-allowed items-center gap-2 text-[var(--enterprise-text-muted)]">
                <input type="radio" name="fr-type" disabled className="opacity-50" />
                Weekly (auto-generated from dailies)
              </label>
            </div>
          </div>
          <EnterpriseFormField<FieldReportCreateValues> name="reportDate" label="Date" required>
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
          <EnterpriseFormField<FieldReportCreateValues> name="author" label="Written by">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseSelect
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                <option value="">—</option>
                {members.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </EnterpriseSelect>
            )}
          </EnterpriseFormField>
        </div>
      </EnterpriseForm>
    </EnterpriseSlideOver>
  );
}
