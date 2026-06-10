"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
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
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";

const FREQUENCY_OPTIONS: { value: OmMaintenanceFrequency; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Bi-weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI_ANNUAL", label: "Semi-annual" },
  { value: "ANNUAL", label: "Annual" },
  { value: "CUSTOM", label: "Custom interval" },
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
    <>
      <div className="space-y-5 px-5 py-5">
        <div>
          <label htmlFor="ppm-asset" className={MOBILE_FIELD_LABEL}>
            Asset
          </label>
          <select
            id="ppm-asset"
            value={form.assetId}
            disabled={isEdit}
            onChange={(e) => set("assetId", e.target.value)}
            className={`${MOBILE_FIELD_SELECT}${isEdit ? " opacity-70" : ""}`}
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tag} — {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ppm-title" className={MOBILE_FIELD_LABEL}>
            Schedule title
          </label>
          <input
            id="ppm-title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Filter replacement"
            maxLength={200}
            className={MOBILE_FIELD_INPUT}
          />
        </div>

        <div>
          <label htmlFor="ppm-frequency" className={MOBILE_FIELD_LABEL}>
            Frequency
          </label>
          <select
            id="ppm-frequency"
            value={form.frequency}
            onChange={(e) => set("frequency", e.target.value as OmMaintenanceFrequency)}
            className={MOBILE_FIELD_SELECT}
          >
            {FREQUENCY_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
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

        <div>
          <label htmlFor="ppm-assignee" className={MOBILE_FIELD_LABEL}>
            Assigned to{" "}
            <span className="font-normal text-[var(--enterprise-text-muted)]">(team member)</span>
          </label>
          <select
            id="ppm-assignee"
            value={form.assignedToUserId}
            onChange={(e) => set("assignedToUserId", e.target.value)}
            className={MOBILE_FIELD_SELECT}
          >
            <option value="">Unassigned</option>
            {(team?.members ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name?.trim() || m.email}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-[var(--enterprise-text-muted)]">
            Assignee gets an in-app notification and is included in daily PPM email reminders.
          </p>
        </div>

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

        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4 space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.meterEnabled}
              onChange={(e) => set("meterEnabled", e.target.checked)}
              className="h-4 w-4 rounded border-[var(--enterprise-border)]"
            />
            <span className="text-sm font-semibold text-[var(--enterprise-text)]">
              Meter-based trigger
            </span>
          </label>
          <p className="text-xs leading-snug text-[var(--enterprise-text-muted)]">
            Also create a work order when a meter reading on this asset reaches the threshold (in
            addition to calendar due dates).
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

        {isEdit ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3">
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
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 items-center rounded-lg border border-[var(--enterprise-border)] px-4 text-sm font-medium text-[var(--enterprise-text)]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate()}
          className="inline-flex min-h-10 items-center rounded-lg bg-[var(--enterprise-primary)] px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isEdit ? "Save changes" : "Create schedule"}
        </button>
      </div>
    </>
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
      panelMaxWidthClass="max-w-[560px]"
      ariaLabelledBy="ppm-slide-title"
      bodyClassName="p-0"
      footer={null}
      footerClassName="hidden"
      header={
        <div className="min-w-0">
          <h2
            id="ppm-slide-title"
            className="truncate text-lg font-semibold text-[var(--enterprise-text)]"
          >
            {isEdit ? "Edit maintenance schedule" : "New maintenance schedule"}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
            {isEdit
              ? "Update frequency, due date, assignee, or vendor. Asset cannot be changed here."
              : "Link a preventive task to an asset. Assign a team member to receive reminders."}
          </p>
        </div>
      }
    >
      {assetsLoading ? (
        <p className="px-5 py-5 text-sm text-[var(--enterprise-text-muted)]">Loading assets…</p>
      ) : assets.length === 0 ? (
        <div className="px-5 py-5">
          <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">No assets yet</p>
            <p className="mt-1 text-xs leading-relaxed opacity-90">
              Add equipment in the asset register before creating a PPM schedule.
            </p>
            <Link
              href={`/projects/${encodeURIComponent(projectId)}/om/assets`}
              className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[var(--enterprise-primary)] px-4 text-xs font-semibold text-white"
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
