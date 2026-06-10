"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import {
  ASSET_METER_TYPE_LABEL,
  fetchOmAssetMeterReadings,
  postOmAssetMeterReading,
  type AssetMeterTypeApi,
  ProRequiredError,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
} from "@/lib/mobileFormStyles";

const METER_TYPES: AssetMeterTypeApi[] = [
  "RUN_HOURS",
  "CYCLES",
  "PRESSURE",
  "TEMPERATURE",
  "CUSTOM",
];

type Props = {
  projectId: string;
  assetId: string;
  enabled?: boolean;
};

export function OmAssetMeterReadingsBlock({ projectId, assetId, enabled = true }: Props) {
  const qc = useQueryClient();
  const [meterType, setMeterType] = useState<AssetMeterTypeApi>("RUN_HOURS");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [label, setLabel] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: readings = [], isPending } = useQuery({
    queryKey: qk.omAssetMeterReadings(projectId, assetId),
    queryFn: () => fetchOmAssetMeterReadings(projectId, assetId),
    enabled: enabled && Boolean(assetId),
  });

  const recordMut = useMutation({
    mutationFn: () => {
      const num = parseFloat(value);
      if (!Number.isFinite(num)) throw new Error("Enter a valid reading value.");
      return postOmAssetMeterReading(projectId, assetId, {
        meterType,
        value: num,
        unit: unit.trim() || undefined,
        label: label.trim() || undefined,
      });
    },
    onSuccess: async (res) => {
      setValue("");
      setUnit("");
      setLabel("");
      setShowForm(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.omAssetMeterReadings(projectId, assetId) }),
        qc.invalidateQueries({ queryKey: qk.workOrders(projectId), exact: false }),
        qc.invalidateQueries({ queryKey: qk.omMaintenance(projectId) }),
      ]);
      if (res.workOrdersCreated > 0) {
        toast.success(
          `Reading saved. ${res.workOrdersCreated} work order${res.workOrdersCreated === 1 ? "" : "s"} created from meter thresholds.`,
        );
      } else if (res.triggeredSchedules.length > 0) {
        toast.success("Reading saved. Threshold reached — existing work order already open.");
      } else {
        toast.success("Meter reading recorded.");
      }
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro required." : e.message);
    },
  });

  if (!assetId) return null;

  return (
    <div className="space-y-3">
      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-[var(--enterprise-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading readings…
        </div>
      ) : readings.length === 0 ? (
        <p className="text-[13px] text-[var(--enterprise-text-muted)]">
          No meter readings yet. Record run hours, cycles, or other values to trigger meter-based
          PM.
        </p>
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto">
          {readings.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-baseline justify-between gap-x-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-[13px]"
            >
              <span className="font-medium text-[var(--enterprise-text)]">
                {ASSET_METER_TYPE_LABEL[r.meterType]}
                {r.label ? ` · ${r.label}` : ""}
              </span>
              <span className="tabular-nums text-[var(--enterprise-text)]">
                {r.value}
                {r.unit ? ` ${r.unit}` : ""}
              </span>
              <span className="w-full text-xs text-[var(--enterprise-text-muted)]">
                {new Date(r.recordedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form
          className="space-y-3 rounded-xl border border-[var(--enterprise-semantic-info-border)] bg-[var(--enterprise-semantic-info-bg)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            recordMut.mutate();
          }}
        >
          <div>
            <label htmlFor="meter-type" className={MOBILE_FIELD_LABEL}>
              Meter type
            </label>
            <select
              id="meter-type"
              value={meterType}
              onChange={(e) => setMeterType(e.target.value as AssetMeterTypeApi)}
              className={MOBILE_FIELD_SELECT}
            >
              {METER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ASSET_METER_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="meter-value" className={MOBILE_FIELD_LABEL}>
                Reading *
              </label>
              <input
                id="meter-value"
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={MOBILE_FIELD_INPUT}
                required
              />
            </div>
            <div>
              <label htmlFor="meter-unit" className={MOBILE_FIELD_LABEL}>
                Unit
              </label>
              <input
                id="meter-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="hrs, psi…"
                className={MOBILE_FIELD_INPUT}
              />
            </div>
          </div>
          <div>
            <label htmlFor="meter-label" className={MOBILE_FIELD_LABEL}>
              Label (optional)
            </label>
            <input
              id="meter-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Main compressor"
              className={MOBILE_FIELD_INPUT}
            />
          </div>
          <div className="flex gap-2">
            <EnterpriseButton
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setShowForm(false)}
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton type="submit" fullWidth loading={recordMut.isPending}>
              {recordMut.isPending ? "Saving…" : "Save reading"}
            </EnterpriseButton>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
        >
          <Plus className="h-4 w-4" />
          Record meter reading
        </button>
      )}

      <p className="flex items-start gap-1.5 text-xs leading-snug text-[var(--enterprise-text-muted)]">
        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        When a reading meets a PM schedule&apos;s meter threshold, a preventive work order is
        created automatically.
      </p>
    </div>
  );
}
