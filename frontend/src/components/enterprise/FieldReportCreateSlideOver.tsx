"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { createFieldReport, ProRequiredError, type FieldReportRow } from "@/lib/api-client";
import { emptyDetails } from "@/lib/fieldReportUtils";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
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
  const [reportDate, setReportDate] = useState(todayYmd);
  const [author, setAuthor] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const reset = useCallback(() => {
    setReportDate(defaultDate?.trim() || todayYmd());
    setAuthor(defaultAuthor.trim() || members[0] || "");
    setMsg(null);
  }, [defaultAuthor, defaultDate, members]);

  const handleClose = useCallback(() => {
    onClose();
    reset();
  }, [onClose, reset]);

  useEffect(() => {
    if (!open) return;
    setReportDate(defaultDate?.trim() || todayYmd());
    setAuthor(defaultAuthor.trim() || members[0] || "");
    setMsg(null);
  }, [open, defaultAuthor, defaultDate, members]);

  const createMut = useMutation({
    mutationFn: () =>
      createFieldReport(projectId, {
        reportDate: new Date(`${reportDate}T12:00:00.000Z`).toISOString(),
        reportKind: "DAILY",
        status: "DRAFT",
        authorLabel: author.trim() || undefined,
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
        onSubmit: (e) => {
          e.preventDefault();
          if (!reportDate.trim()) return;
          createMut.mutate();
        },
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
          <EnterpriseButton
            type="submit"
            size="sm"
            loading={createMut.isPending}
            disabled={!reportDate.trim()}
          >
            {createMut.isPending ? "Creating…" : "Create"}
          </EnterpriseButton>
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
          <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Report</p>
          <div>
            <span className={MOBILE_FIELD_LABEL}>Type</span>
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
          <div>
            <label htmlFor="fr-create-date" className={MOBILE_FIELD_LABEL}>
              Date
            </label>
            <input
              id="fr-create-date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className={MOBILE_FIELD_INPUT}
              required
            />
          </div>
          <div>
            <label htmlFor="fr-create-author" className={MOBILE_FIELD_LABEL}>
              Written by
            </label>
            <select
              id="fr-create-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={MOBILE_FIELD_SELECT}
            >
              <option value="">—</option>
              {members.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </EnterpriseSlideOver>
  );
}
