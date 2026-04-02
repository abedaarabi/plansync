"use client";

import { useMemo } from "react";
import { Building2, ChevronDown } from "lucide-react";
import type { FolderStructureTemplateWithTree } from "@/lib/api-client";
import type { Project } from "@/types/projects";
import { FolderTreePreview } from "./FolderTreePreview";
import { logoUrlFromWebsiteInput } from "@/lib/websiteUrl";
import { PROJECT_STAGES, type ProjectStageValue } from "@/lib/projectStage";
import type { ProjectCurrencyCode } from "@/lib/projectCurrency";
import type { ProjectMeasurementSystem } from "@/lib/projectMeasurement";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import { ProjectCurrencyPicker } from "./ProjectCurrencyPicker";
import { ProjectMeasurementSystemPicker } from "./ProjectMeasurementSystemPicker";
import { ProjectTypeSelect } from "./ProjectTypeSelect";

export type InitialFolderStructureOption = "none" | "template" | "copy";

export type NewProjectDialogValues = {
  projectName: string;
  currency: ProjectCurrencyCode;
  measurementSystem: ProjectMeasurementSystem;
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
  /** Applied once after the project is created (project root). */
  initialFolderStructure: InitialFolderStructureOption;
  folderTemplateId: string;
  copyFromProjectId: string;
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
  templates: FolderStructureTemplateWithTree[];
  /** Existing workspace projects — pick one to copy folder names from (no files). */
  copySourceProjects: Project[];
};

const FLOW_STEPS = [
  { n: 1, title: "Basics", hint: "Name, timeline & units" },
  { n: 2, title: "Details", hint: "Budget, site & tracking" },
  { n: 3, title: "Folders", hint: "Optional structure" },
] as const;

const inputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] placeholder:text-[var(--enterprise-text-muted)]/75 transition focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20";

const labelClass = "block text-[13px] font-medium text-[var(--enterprise-text-muted)]";

const sectionCard =
  "rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-[var(--enterprise-shadow-xs)] sm:p-6";

function SectionHeader({
  step,
  title,
  description,
  id,
}: {
  step: number;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div className="mb-5 flex gap-4">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--enterprise-primary)]/35 bg-[var(--enterprise-primary-soft)] text-base font-bold text-[var(--enterprise-primary)]"
        aria-hidden
      >
        {step}
      </div>
      <div className="min-w-0">
        <h3
          id={id}
          className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]"
        >
          {title}
        </h3>
        <p className="mt-0.5 text-[13px] leading-snug text-[var(--enterprise-text-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}

export function NewProjectDialog({
  open,
  saving,
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Create project",
  templates,
  copySourceProjects,
}: Props) {
  const websiteLogoPreview = useMemo(
    () => logoUrlFromWebsiteInput(values.websiteUrl),
    [values.websiteUrl],
  );

  const canUseTemplate = templates.length > 0;
  const canCopyFromProject = copySourceProjects.length > 0;

  const panelPad = "px-4 py-6 sm:px-8 lg:px-10 xl:px-12";

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onCancel}
      form={{ onSubmit }}
      ariaLabelledBy="new-project-dialog-title"
      panelMaxWidthClass="w-[min(100%,calc(100vw-12px))] max-w-[min(1920px,calc(100vw-12px))]"
      headerClassName="px-4 sm:px-8 lg:px-10 xl:px-12"
      bodyClassName={`${panelPad} pb-8`}
      footerClassName={`${panelPad} sm:!justify-between sm:!items-center`}
      closeOnBackdrop={false}
      closeOnEscape={false}
      showHeaderCloseButton
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
              Work through the three steps: essentials first, then details, then optional folders.
              You can change almost everything later in project settings.
            </p>
          </div>
        </div>
      }
      footer={
        <>
          <p className="mr-auto hidden max-w-md text-[12px] leading-snug text-[var(--enterprise-text-muted)] sm:block">
            <span className="font-medium text-[var(--enterprise-text)]">Tip:</span> Folder templates
            and copy-from apply only at creation — you can still rename folders anytime.
          </p>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
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
          </div>
        </>
      }
    >
      <div className="mx-auto flex max-w-[min(1280px,100%)] flex-col gap-8">
        <div className="grid gap-3 sm:grid-cols-3" role="list" aria-label="Project creation steps">
          {FLOW_STEPS.map((s) => (
            <div
              key={s.n}
              role="listitem"
              className="flex gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-3 py-3 sm:flex-col sm:px-4 sm:py-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary)] text-sm font-bold text-white shadow-sm">
                {s.n}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--enterprise-text)]">{s.title}</p>
                <p className="text-[12px] leading-snug text-[var(--enterprise-text-muted)]">
                  {s.hint}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Step 1 */}
        <section className={sectionCard} aria-labelledby="new-project-step-1">
          <SectionHeader
            step={1}
            id="new-project-step-1"
            title="Project basics"
            description="Name your project, set the contract timeline, and choose currency and measurement units used in takeoffs and budgets."
          />
          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <div className="space-y-5">
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
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            </div>

            <div className="rounded-xl border border-[var(--enterprise-border)]/70 bg-[var(--enterprise-bg)]/35 p-4 sm:p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
                Currency &amp; units
              </p>
              <p className="mt-1 text-[12px] leading-snug text-[var(--enterprise-text-muted)]">
                Used for budgets, takeoff quantities, and measurement tools across this project.
              </p>
              <div className="mt-4 space-y-5">
                <div>
                  <label className={labelClass}>Project currency</label>
                  <div className="mt-2">
                    <ProjectCurrencyPicker
                      value={values.currency}
                      onChange={(v) => onChange("currency", v)}
                      idPrefix="new-project-currency"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Measurement system</label>
                  <div className="mt-2">
                    <ProjectMeasurementSystemPicker
                      value={values.measurementSystem}
                      onChange={(v) => onChange("measurementSystem", v)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 2 */}
        <section className={sectionCard} aria-labelledby="new-project-step-2">
          <SectionHeader
            step={2}
            id="new-project-step-2"
            title="Project details"
            description="Reference numbers, budget, site, and progress tracking — all optional except where noted."
          />
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
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
                Local budget ({values.currency})
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
        </section>

        {/* Step 3 */}
        <section className={sectionCard} aria-labelledby="new-project-step-3">
          <SectionHeader
            step={3}
            id="new-project-step-3"
            title="Initial folder structure"
            description="Optional. Create empty folders at the project root, use a template, or mirror folder names from another project. Files are never copied."
          />

          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-2 transition hover:bg-[var(--enterprise-bg)]/60">
              <input
                type="radio"
                name="new-project-ifs"
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
                checked={values.initialFolderStructure === "none"}
                onChange={() => onChange("initialFolderStructure", "none")}
              />
              <span>
                <span className="text-sm font-medium text-[var(--enterprise-text)]">None</span>
                <span className="mt-0.5 block text-[12px] text-[var(--enterprise-text-muted)]">
                  Start with an empty folder tree.
                </span>
              </span>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-2 transition hover:bg-[var(--enterprise-bg)]/60 ${!canUseTemplate ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="new-project-ifs"
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
                disabled={!canUseTemplate}
                checked={values.initialFolderStructure === "template"}
                onChange={() => onChange("initialFolderStructure", "template")}
              />
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium text-[var(--enterprise-text)]">
                  Use a PlanSync template
                </span>
                <span className="mt-0.5 block text-[12px] text-[var(--enterprise-text-muted)]">
                  AEC-style presets (administration, design, RFIs, field, BIM, and more).
                </span>
                {!canUseTemplate ? (
                  <span className="mt-1 block text-[11px] text-amber-700">
                    No templates are configured yet.
                  </span>
                ) : null}
              </span>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-2 transition hover:bg-[var(--enterprise-bg)]/60 ${!canCopyFromProject ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="new-project-ifs"
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
                disabled={!canCopyFromProject}
                checked={values.initialFolderStructure === "copy"}
                onChange={() => onChange("initialFolderStructure", "copy")}
              />
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium text-[var(--enterprise-text)]">
                  Copy folder structure from a project
                </span>
                <span className="mt-0.5 block text-[12px] text-[var(--enterprise-text-muted)]">
                  Recreates folder names and nesting only. Files stay in the source project.
                </span>
                {!canCopyFromProject ? (
                  <span className="mt-1 block text-[11px] text-amber-700">
                    Create another project first to use this option.
                  </span>
                ) : null}
              </span>
            </label>
          </div>

          {values.initialFolderStructure === "template" && canUseTemplate ? (
            <div className="mt-4 max-h-[min(360px,50vh)] space-y-2 overflow-y-auto pr-1">
              {templates.map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer flex-col rounded-xl border px-3 py-3 transition ${
                    values.folderTemplateId === t.id
                      ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary-soft)] ring-1 ring-[var(--enterprise-primary)]/25"
                      : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="new-project-template"
                      checked={values.folderTemplateId === t.id}
                      onChange={() => onChange("folderTemplateId", t.id)}
                      className="mt-1 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--enterprise-text)]">
                        {t.name}
                      </p>
                      <p className="mt-1 text-[12px] leading-snug text-[var(--enterprise-text-muted)]">
                        {t.description}
                      </p>
                      <details className="group/details mt-2">
                        <summary className="flex cursor-pointer list-none items-center gap-1 text-[12px] font-medium text-[var(--enterprise-primary)] marker:content-none [&::-webkit-details-marker]:hidden">
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition group-open/details:rotate-180" />
                          View folder tree
                        </summary>
                        <div className="mt-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-3">
                          <FolderTreePreview nodes={t.tree} />
                        </div>
                      </details>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          {values.initialFolderStructure === "copy" && canCopyFromProject ? (
            <div className="mt-4">
              <label htmlFor="new-project-copy-from" className={labelClass}>
                Copy structure from
              </label>
              <select
                id="new-project-copy-from"
                value={values.copyFromProjectId}
                onChange={(e) => onChange("copyFromProjectId", e.target.value)}
                className={inputClass}
              >
                {copySourceProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </section>
      </div>
    </EnterpriseSlideOver>
  );
}
