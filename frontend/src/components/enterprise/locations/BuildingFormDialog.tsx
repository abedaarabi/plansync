"use client";

import { useEffect, useState } from "react";
import { Building2, Hash, Layers, StickyNote } from "lucide-react";
import type { BuildingInput, BuildingType } from "@/lib/api-client/locations";
import { BUILDING_TYPE_OPTIONS } from "@/lib/locations/buildingLabels";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FIELD_TEXTAREA,
} from "@/lib/mobileFormStyles";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";
import { BuildingImageField } from "./BuildingImageField";

type Initial = {
  id?: string;
  name: string;
  code?: string | null;
  buildingType?: BuildingType | null;
  floorsApprox?: number | null;
  notes?: string | null;
  hasImage?: boolean;
};

export type BuildingFormSubmit = BuildingInput & {
  pendingImage: File | null;
  removeImage: boolean;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Initial | null;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (input: BuildingFormSubmit) => void;
};

type FormState = {
  name: string;
  code: string;
  buildingType: BuildingType | "";
  floorsApprox: string;
  notes: string;
};

const empty: FormState = {
  name: "",
  code: "",
  buildingType: "",
  floorsApprox: "",
  notes: "",
};

export function BuildingFormDialog({
  open,
  mode,
  initial,
  isSaving = false,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPendingImage(null);
    setRemoveImage(false);
    if (mode === "edit" && initial) {
      setForm({
        name: initial.name,
        code: initial.code ?? "",
        buildingType: initial.buildingType ?? "",
        floorsApprox: initial.floorsApprox != null ? String(initial.floorsApprox) : "",
        notes: initial.notes ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [open, mode, initial]);

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isSaving ? () => {} : onClose}
      ariaLabelledBy="building-form-title"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      panelClassName="max-w-lg"
      footer={
        <>
          <button
            type="submit"
            form="building-form"
            disabled={isSaving || !form.name.trim()}
            className={`${MOBILE_DIALOG_BTN_PRIMARY} enterprise-btn-primary`}
          >
            {isSaving ? "Saving…" : mode === "create" ? "Create building" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)]`}
          >
            Cancel
          </button>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)]">
          <Building2 className="h-5 w-5 text-[var(--enterprise-primary)]" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2
            id="building-form-title"
            className="text-lg font-semibold text-[var(--enterprise-text)]"
          >
            {mode === "create" ? "Add building" : "Edit building"}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--enterprise-text-muted)]">
            Owner details for this building — upload IFC and drawings after create.
          </p>
        </div>
      </div>

      <form
        id="building-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return;
          const floors = form.floorsApprox.trim();
          onSubmit({
            name: form.name.trim(),
            code: form.code || null,
            buildingType: form.buildingType || null,
            floorsApprox: floors ? Number(floors) : null,
            notes: form.notes || null,
            pendingImage,
            removeImage,
          });
        }}
      >
        <label className="block">
          <span className={MOBILE_FIELD_LABEL}>Building name *</span>
          <input
            className={MOBILE_FIELD_INPUT}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Tower A"
            required
            autoFocus
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={`${MOBILE_FIELD_LABEL} inline-flex items-center gap-1.5`}>
              <Hash className="h-3.5 w-3.5" aria-hidden />
              Code
            </span>
            <input
              className={MOBILE_FIELD_INPUT}
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="e.g. A, B2"
            />
          </label>
          <label className="block">
            <span className={`${MOBILE_FIELD_LABEL} inline-flex items-center gap-1.5`}>
              <Layers className="h-3.5 w-3.5" aria-hidden />
              Floors (approx)
            </span>
            <input
              className={MOBILE_FIELD_INPUT}
              type="number"
              min={0}
              max={300}
              inputMode="numeric"
              value={form.floorsApprox}
              onChange={(e) => setForm((p) => ({ ...p, floorsApprox: e.target.value }))}
              placeholder="e.g. 12"
            />
          </label>
        </div>

        <label className="block">
          <span className={MOBILE_FIELD_LABEL}>Building type</span>
          <select
            className={MOBILE_FIELD_SELECT}
            value={form.buildingType}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                buildingType: e.target.value as BuildingType | "",
              }))
            }
          >
            <option value="">Select type</option>
            {BUILDING_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <BuildingImageField
          buildingId={mode === "edit" ? initial?.id : undefined}
          hasExistingImage={Boolean(initial?.hasImage)}
          pendingFile={pendingImage}
          onPendingFileChange={setPendingImage}
          removeExisting={removeImage}
          onRemoveExistingChange={setRemoveImage}
          disabled={isSaving}
        />

        <label className="block">
          <span className={`${MOBILE_FIELD_LABEL} inline-flex items-center gap-1.5`}>
            <StickyNote className="h-3.5 w-3.5" aria-hidden />
            Notes
          </span>
          <textarea
            className={MOBILE_FIELD_TEXTAREA}
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Optional notes for the owner or team"
            rows={3}
          />
        </label>
      </form>
    </EnterpriseResponsiveDialog>
  );
}
