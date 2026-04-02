"use client";

import { useMemo } from "react";
import { Building2 } from "lucide-react";
import { logoUrlFromWebsiteInput } from "@/lib/websiteUrl";
import { PROJECT_STAGES, type ProjectStageValue } from "@/lib/projectStage";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import { ProjectTypeSelect } from "./ProjectTypeSelect";

export type NewProjectDialogValues = {
  projectName: string;
  startDate: string;
  endDate: string;
  projectNumber: string;
  localBudget: string;
  projectSize: string;
  projectType: string;
  location: string;
  websiteUrl: string;
  projectStage: ProjectStageValue;
  progressPercent: number;
};

type Props = {
  open: boolean;
  saving: boolean;
  values: NewProjectDialogValues;
  onChange: (field: keyof NewProjectDialogValues, value: string | number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  /** Shown on the primary button when not saving */
  submitLabel?: string;
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] placeholder:text-[var(--enterprise-text-muted)]/75 transition focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20";

const labelClass = "block text-[13px] font-medium text-[var(--enterprise-text-muted)]";

export function NewProjectDialog({
  open,
  saving,
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Create project",
}: Props) {
  const websiteLogoPreview = useMemo(
    () => logoUrlFromWebsiteInput(values.websiteUrl),
    [values.websiteUrl],
  );

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onCancel}
      form={{ onSubmit }}
      ariaLabelledBy="new-project-dialog-title"
      header={
        <div className="flex items-start gap-4 pr-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
            <Building2 className="h-6 w-6 text-[var(--enterprise-primary)]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2
              id="new-project-dialog-title"
              className="text-xl font-bold tracking-tight text-[var(--enterprise-text)]"
            >
              New project
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-[var(--enterprise-text-muted)]">
              Create a new construction project to manage your drawings and team.
            </p>
          </div>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--enterprise-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[var(--enterprise-primary-deep)] hover:shadow-lg disabled:opacity-60"
          >
            {saving ? "Creating…" : submitLabel}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <label htmlFor="new-project-name" className={labelClass}>
            Project name <span className="text-[var(--enterprise-error)]">*</span>
          </label>
          <input
            id="new-project-name"
            value={values.projectName}
            onChange={(e) => onChange("projectName", e.target.value)}
            className={inputClass}
            placeholder="e.g. Tower A — Structure"
            required
            autoFocus
            autoComplete="off"
          />
        </div>

        <div className="rounded-xl border border-[var(--enterprise-border)]/60 bg-[var(--enterprise-bg)]/30 p-4 sm:p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
            Project Details
          </p>
          <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-project-start-date" className={labelClass}>
                Start date <span className="text-[var(--enterprise-error)]">*</span>
              </label>
              <input
                id="new-project-start-date"
                type="date"
                value={values.startDate}
                onChange={(e) => onChange("startDate", e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="new-project-end-date" className={labelClass}>
                End date <span className="text-[var(--enterprise-error)]">*</span>
              </label>
              <input
                id="new-project-end-date"
                type="date"
                value={values.endDate}
                onChange={(e) => onChange("endDate", e.target.value)}
                className={inputClass}
                min={values.startDate || undefined}
                required
              />
            </div>
            <div>
              <label htmlFor="new-project-number" className={labelClass}>
                Project number
              </label>
              <input
                id="new-project-number"
                value={values.projectNumber}
                onChange={(e) => onChange("projectNumber", e.target.value)}
                className={inputClass}
                placeholder="e.g. 2025-0142"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="new-project-budget" className={labelClass}>
                Local budget
              </label>
              <input
                id="new-project-budget"
                value={values.localBudget}
                onChange={(e) => onChange("localBudget", e.target.value)}
                inputMode="decimal"
                className={inputClass}
                placeholder="e.g. 1250000"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="new-project-size" className={labelClass}>
                Size
              </label>
              <input
                id="new-project-size"
                value={values.projectSize}
                onChange={(e) => onChange("projectSize", e.target.value)}
                className={inputClass}
                placeholder="e.g. 45,000 sq ft"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="new-project-type" className={labelClass}>
                Type
              </label>
              <ProjectTypeSelect
                id="new-project-type"
                value={values.projectType}
                onChange={(v) => onChange("projectType", v)}
                triggerClassName={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-project-location" className={labelClass}>
                Location
              </label>
              <input
                id="new-project-location"
                value={values.location}
                onChange={(e) => onChange("location", e.target.value)}
                className={inputClass}
                placeholder="Site or city"
                autoComplete="off"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-project-website" className={labelClass}>
                Website
              </label>
              <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  id="new-project-website"
                  value={values.websiteUrl}
                  onChange={(e) => onChange("websiteUrl", e.target.value)}
                  className={`${inputClass} min-w-0 flex-1`}
                  placeholder="https://client.com or client.com"
                  inputMode="url"
                  autoComplete="off"
                />
                {websiteLogoPreview ? (
                  <div className="flex shrink-0 items-center gap-2.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 shadow-[var(--enterprise-shadow-xs)]">
                    <span className="text-[11px] font-medium text-[var(--enterprise-text-muted)]">
                      Logo
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element -- favicon preview */}
                    <img
                      src={websiteLogoPreview}
                      alt=""
                      width={32}
                      height={32}
                      className="rounded-md border border-[var(--enterprise-border)]/60 bg-white object-cover"
                    />
                  </div>
                ) : null}
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-[var(--enterprise-text-muted)]">
                Optional. We use the site favicon as the project logo in the app.
              </p>
            </div>
            <div>
              <label htmlFor="new-project-stage" className={labelClass}>
                Stage
              </label>
              <select
                id="new-project-stage"
                value={values.projectStage}
                onChange={(e) => onChange("projectStage", e.target.value as ProjectStageValue)}
                className={inputClass}
              >
                {PROJECT_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="new-project-progress" className={labelClass}>
                  Overall progress
                </label>
                <span className="text-sm font-semibold tabular-nums text-[var(--enterprise-text)]">
                  {values.progressPercent}%
                </span>
              </div>
              <input
                id="new-project-progress"
                type="range"
                min={0}
                max={100}
                step={1}
                value={values.progressPercent}
                onChange={(e) => onChange("progressPercent", Number(e.target.value))}
                className="mt-2 h-2 w-full cursor-pointer accent-[var(--enterprise-primary)]"
              />
              <p className="mt-1.5 text-[12px] leading-snug text-[var(--enterprise-text-muted)]">
                High-level completion for reporting (independent of the stage above).
              </p>
            </div>
          </div>
        </div>
      </div>
    </EnterpriseSlideOver>
  );
}
