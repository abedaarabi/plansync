"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  ASSET_METER_TYPE_LABEL,
  createOmMaintenance,
  fetchOmAssets,
  fetchProjectTeam,
  patchOmMaintenance,
  type AssetMeterTypeApi,
  type OmAssetRow,
  type OmMaintenanceFrequency,
  type OmMaintenanceRow,
  type ProjectTeamResponse,
  ProRequiredError,
} from "@/lib/api-client";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
} from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";
import {
  EnterpriseButton,
  enterpriseButtonClassName,
} from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { OmAssetPicker } from "@/components/enterprise/OmAssetPicker";
import { OmAssigneePicker } from "@/components/enterprise/OmAssigneePicker";
import { OmFormSection } from "@/components/enterprise/OmFormSection";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import { EnterpriseInput } from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";

const FREQUENCY_OPTIONS: { value: OmMaintenanceFrequency; label: string; short: string }[] = [
  { value: "DAILY", label: "Daily", short: "Daily" },
  { value: "WEEKLY", label: "Weekly", short: "Weekly" },
  { value: "BIWEEKLY", label: "Bi-weekly", short: "Bi-wk" },
  { value: "MONTHLY", label: "Monthly", short: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly", short: "Qtr" },
  { value: "SEMI_ANNUAL", label: "Semi-annual", short: "Semi" },
  { value: "ANNUAL", label: "Annual", short: "Annual" },
  { value: "CUSTOM", label: "Custom interval", short: "Custom" },
];

type FormState = {
  assetId: string;
  title: string;
  frequency: OmMaintenanceFrequency;
  intervalDays: string;
  nextDueDate: string;
  assignedVendorLabel: string;
  assignedToUserId: string;
  isActive: boolean;
  meterEnabled: boolean;
  meterType: AssetMeterTypeApi;
  meterThreshold: string;
};

const maintenanceScheduleSchema = z.object({
  title: z.string().trim().min(1, "Enter a schedule title."),
});

type MaintenanceScheduleValues = z.infer<typeof maintenanceScheduleSchema>;

const METER_TYPES: AssetMeterTypeApi[] = [
  "RUN_HOURS",
  "CYCLES",
  "PRESSURE",
  "TEMPERATURE",
  "CUSTOM",
];

function emptyForm(defaultAssetId = ""): FormState {
  return {
    assetId: defaultAssetId,
    title: "",
    frequency: "MONTHLY",
    intervalDays: "30",
    nextDueDate: "",
    assignedVendorLabel: "",
    assignedToUserId: "",
    isActive: true,
    meterEnabled: false,
    meterType: "RUN_HOURS",
    meterThreshold: "",
  };
}

function formFromSchedule(s: OmMaintenanceRow): FormState {
  const hasMeter = Boolean(s.meterType && s.meterThreshold != null);
  return {
    assetId: s.assetId,
    title: s.title,
    frequency: s.frequency as OmMaintenanceFrequency,
    intervalDays: String(s.intervalDays ?? 30),
    nextDueDate: s.nextDueAt ? s.nextDueAt.slice(0, 10) : "",
    assignedVendorLabel: s.assignedVendorLabel ?? "",
    assignedToUserId: s.assignedToUserId ?? "",
    isActive: s.isActive,
    meterEnabled: hasMeter,
    meterType: (s.meterType as AssetMeterTypeApi) ?? "RUN_HOURS",
    meterThreshold: s.meterThreshold != null ? String(s.meterThreshold) : "",
  };
}

type FormFieldsProps = {
  projectId: string;
  schedule: OmMaintenanceRow | null;
  assets: OmAssetRow[];
  team: ProjectTeamResponse | undefined;
  initialAssetId?: string | null;
  onClose: () => void;
};

function MaintenanceScheduleFormFields({
  projectId,
  schedule,
  assets,
  team,
  initialAssetId,
  onClose,
}: FormFieldsProps) {
  const qc = useQueryClient();
  const isEdit = schedule !== null;
  const preferredAssetId = assets.find((a) => a.id === initialAssetId)?.id ?? assets[0]?.id ?? "";
  const [form, setForm] = useState<FormState>(() =>
    schedule ? formFromSchedule(schedule) : emptyForm(preferredAssetId),
  );
  const titleForm = useEnterpriseForm(maintenanceScheduleSchema, { title: form.title });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!form.assetId) throw new Error("Select an asset.");
      if (form.frequency === "CUSTOM") {
        const days = Number.parseInt(form.intervalDays, 10);
        if (!Number.isFinite(days) || days < 1) {
          throw new Error("Custom interval must be at least 1 day.");
        }
      }
      const nextDueAt = form.nextDueDate.trim() ? `${form.nextDueDate.trim()}T00:00:00.000Z` : null;
      const assignedToUserId = form.assignedToUserId.trim() || null;
      const assignedVendorLabel = form.assignedVendorLabel.trim() || null;

      let meterType: AssetMeterTypeApi | null = null;
      let meterThreshold: number | null = null;
      if (form.meterEnabled) {
        const th = parseFloat(form.meterThreshold);
        if (!Number.isFinite(th) || th < 0) {
          throw new Error("Meter threshold must be a non-negative number.");
        }
        meterType = form.meterType;
        meterThreshold = th;
      }

      if (isEdit && schedule) {
        return patchOmMaintenance(projectId, schedule.id, {
          title: form.title.trim(),
          frequency: form.frequency,
          intervalDays: form.frequency === "CUSTOM" ? Number.parseInt(form.intervalDays, 10) : null,
          nextDueAt,
          assignedVendorLabel,
          assignedToUserId,
          isActive: form.isActive,
          meterType,
          meterThreshold,
        });
      }

      return createOmMaintenance(projectId, {
        assetId: form.assetId,
        title: form.title.trim() || undefined,
        frequency: form.frequency,
        intervalDays: form.frequency === "CUSTOM" ? Number.parseInt(form.intervalDays, 10) : null,
        nextDueAt,
        assignedVendorLabel,
        assignedToUserId,
        meterType,
        meterThreshold,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.omMaintenance(projectId) }),
        qc.invalidateQueries({ queryKey: qk.projectAuditRoot(projectId) }),
      ]);
      toast.success(isEdit ? "Schedule updated." : "Maintenance schedule created.");
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <EnterpriseForm
      form={titleForm}
      onSubmit={() => saveMut.mutate()}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="space-y-7 px-5 py-5">
        <OmFormSection title="Asset" description="Equipment this preventive task applies to.">
          <OmAssetPicker
            projectId={projectId}
            assets={assets}
            value={form.assetId}
            onChange={(assetId) => set("assetId", assetId)}
            disabled={isEdit}
            lockedPreview={
              schedule
                ? {
                    id: schedule.asset.id,
                    tag: schedule.asset.tag,
                    name: schedule.asset.name,
                    hasImage: schedule.asset.hasImage,
                  }
                : null
            }
          />
        </OmFormSection>

        <OmFormSection title="Schedule">
          <EnterpriseFormField<MaintenanceScheduleValues>
            name="title"
            label="Schedule title"
            required
          >
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                maxLength={200}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="e.g. Filter replacement"
                onChange={(event) => {
                  field.onChange(event);
                  set("title", event.target.value);
                }}
              />
            )}
          </EnterpriseFormField>

          <div>
            <p className={MOBILE_FIELD_LABEL}>Frequency</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {FREQUENCY_OPTIONS.map((f) => {
                const active = form.frequency === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={active}
                    title={f.label}
                    onClick={() => set("frequency", f.value)}
                    className={`inline-flex min-h-9 items-center rounded-lg border px-2.5 text-xs font-semibold transition ${
                      active
                        ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)] text-white"
                        : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
                    }`}
                  >
                    <span className="sm:hidden">{f.short}</span>
                    <span className="hidden sm:inline">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {form.frequency === "CUSTOM" ? (
            <div>
              <label htmlFor="ppm-interval" className={MOBILE_FIELD_LABEL}>
                Interval (days)
              </label>
              <input
                id="ppm-interval"
                type="number"
                min={1}
                max={3650}
                value={form.intervalDays}
                onChange={(e) => set("intervalDays", e.target.value)}
                className={MOBILE_FIELD_INPUT}
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="ppm-next-due" className={MOBILE_FIELD_LABEL}>
              Next due date{" "}
              <span className="font-normal text-[var(--enterprise-text-muted)]">
                {isEdit ? "" : "(optional)"}
              </span>
            </label>
            <input
              id="ppm-next-due"
              type="date"
              value={form.nextDueDate}
              onChange={(e) => set("nextDueDate", e.target.value)}
              className={MOBILE_FIELD_INPUT}
            />
            {!isEdit ? (
              <p className="mt-1.5 text-xs text-[var(--enterprise-text-muted)]">
                Leave blank to start from today and compute the first due from frequency.
              </p>
            ) : null}
          </div>
        </OmFormSection>

        <OmFormSection
          title="Assignment"
          description="Assignee gets email and push when this schedule is due. Managers also receive a daily digest."
        >
          <OmAssigneePicker
            members={team?.members ?? []}
            value={form.assignedToUserId}
            onChange={(userId) => set("assignedToUserId", userId)}
          />

          <div>
            <label htmlFor="ppm-vendor" className={MOBILE_FIELD_LABEL}>
              External vendor{" "}
              <span className="font-normal text-[var(--enterprise-text-muted)]">(optional)</span>
            </label>
            <input
              id="ppm-vendor"
              value={form.assignedVendorLabel}
              onChange={(e) => set("assignedVendorLabel", e.target.value)}
              placeholder="e.g. ABC Mechanical"
              maxLength={200}
              className={MOBILE_FIELD_INPUT}
            />
          </div>
        </OmFormSection>

        <OmFormSection
          title="Meter trigger"
          description="Optional — in addition to calendar due dates."
        >
          <div className="space-y-3 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.meterEnabled}
                onChange={(e) => set("meterEnabled", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--enterprise-border)]"
              />
              <span className="text-sm font-semibold text-[var(--enterprise-text)]">
                Enable meter-based work order
              </span>
            </label>
            <p className="text-xs leading-snug text-[var(--enterprise-text-muted)]">
              Create a work order when a meter reading on this asset reaches the threshold.
            </p>
            {form.meterEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ppm-meter-type" className={MOBILE_FIELD_LABEL}>
                    Meter type
                  </label>
                  <select
                    id="ppm-meter-type"
                    value={form.meterType}
                    onChange={(e) => set("meterType", e.target.value as AssetMeterTypeApi)}
                    className={MOBILE_FIELD_SELECT}
                  >
                    {METER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ASSET_METER_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ppm-meter-threshold" className={MOBILE_FIELD_LABEL}>
                    Threshold value *
                  </label>
                  <input
                    id="ppm-meter-threshold"
                    type="number"
                    min={0}
                    step="any"
                    value={form.meterThreshold}
                    onChange={(e) => set("meterThreshold", e.target.value)}
                    placeholder="e.g. 5000"
                    className={MOBILE_FIELD_INPUT}
                    required={form.meterEnabled}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </OmFormSection>

        {isEdit ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="h-4 w-4 rounded border-[var(--enterprise-border)]"
            />
            <span className="text-sm font-medium text-[var(--enterprise-text)]">
              Schedule active
            </span>
          </label>
        ) : null}
      </div>

      <div className="flex w-full justify-end gap-2 border-t border-[var(--enterprise-border)] px-5 py-3">
        <EnterpriseButton variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </EnterpriseButton>
        <EnterpriseButton type="submit" size="sm" loading={saveMut.isPending}>
          {isEdit ? "Save changes" : "Create schedule"}
        </EnterpriseButton>
      </div>
    </EnterpriseForm>
  );
}

type Props = {
  projectId: string;
  open: boolean;
  schedule: OmMaintenanceRow | null;
  formSession: number;
  initialAssetId?: string | null;
  onClose: () => void;
};

export function OmMaintenanceScheduleSlideOver({
  projectId,
  open,
  schedule,
  formSession,
  initialAssetId,
  onClose,
}: Props) {
  const isEdit = schedule !== null;
  const formKey = `${schedule?.id ?? "new"}-${formSession}-${initialAssetId ?? "auto"}`;

  const { data: assets = [], isPending: assetsLoading } = useQuery({
    queryKey: qk.omAssets(projectId),
    queryFn: () => fetchOmAssets(projectId),
    enabled: open,
  });

  const { data: team } = useQuery({
    queryKey: qk.projectTeam(projectId),
    queryFn: () => fetchProjectTeam(projectId),
    enabled: open,
  });

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      ariaLabelledBy="ppm-slide-title"
      bodyClassName="p-0"
      footer={null}
      footerClassName="hidden"
      closeOnBackdrop={false}
      closeOnEscape={false}
      header={
        <SlideOverHeader
          titleId="ppm-slide-title"
          title={isEdit ? "Edit maintenance schedule" : "New maintenance schedule"}
          description={
            isEdit
              ? "Update frequency, due date, assignee, or vendor. Asset cannot be changed here."
              : "Link a preventive task to an asset. Assignees get email and push when due."
          }
        />
      }
    >
      {assetsLoading ? (
        <p className="px-5 py-5 text-sm text-[var(--enterprise-text-muted)]">Loading assets…</p>
      ) : assets.length === 0 ? (
        <div className="px-5 py-5">
          <div className="enterprise-alert-warning rounded-md px-4 py-3 text-sm">
            <p className="font-medium">No assets yet</p>
            <p className="mt-1 text-xs leading-relaxed opacity-90">
              Add equipment in the asset register before creating a PPM schedule.
            </p>
            <Link
              href={`/projects/${encodeURIComponent(projectId)}/om/assets`}
              className={enterpriseButtonClassName({
                variant: "primary",
                size: "sm",
                className: "mt-3",
              })}
            >
              Go to Assets
            </Link>
          </div>
        </div>
      ) : (
        <MaintenanceScheduleFormFields
          key={formKey}
          projectId={projectId}
          schedule={schedule}
          assets={assets}
          team={team}
          initialAssetId={initialAssetId}
          onClose={onClose}
        />
      )}
    </EnterpriseSlideOver>
  );
}
