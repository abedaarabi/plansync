"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { z } from "zod";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import {
  EnterpriseInput,
  EnterpriseSelect,
  EnterpriseTextarea,
} from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import type { BuildingInput, BuildingType } from "@/lib/api-client/locations";
import { BUILDING_TYPE_OPTIONS } from "@/lib/locations/buildingLabels";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
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

const buildingFormSchema = z.object({
  buildingType: z.union([
    z.literal(""),
    z.enum(["OFFICE", "RESIDENTIAL", "MIXED", "INDUSTRIAL", "OTHER"]),
  ]),
  code: z.string(),
  floorsApprox: z.string().refine(
    (value) => {
      const trimmed = value.trim();
      return (
        trimmed === "" ||
        (Number.isInteger(Number(trimmed)) && Number(trimmed) >= 0 && Number(trimmed) <= 300)
      );
    },
    { message: "Enter a whole number from 0 to 300." },
  ),
  name: z.string().trim().min(1, "Enter a building name."),
  notes: z.string(),
});

type BuildingFormValues = z.infer<typeof buildingFormSchema>;

const EMPTY_FORM: BuildingFormValues = {
  buildingType: "",
  code: "",
  floorsApprox: "",
  name: "",
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
  const form = useEnterpriseForm(buildingFormSchema, EMPTY_FORM);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPendingImage(null);
    setRemoveImage(false);
    if (mode === "edit" && initial) {
      form.reset({
        name: initial.name,
        code: initial.code ?? "",
        buildingType: initial.buildingType ?? "",
        floorsApprox: initial.floorsApprox != null ? String(initial.floorsApprox) : "",
        notes: initial.notes ?? "",
      });
    } else {
      form.reset(EMPTY_FORM);
    }
  }, [form, initial, mode, open]);

  const handleSubmit = (values: BuildingFormValues) => {
    const floors = values.floorsApprox.trim();
    onSubmit({
      name: values.name.trim(),
      code: values.code || null,
      buildingType: values.buildingType || null,
      floorsApprox: floors ? Number(floors) : null,
      notes: values.notes || null,
      pendingImage,
      removeImage,
    });
  };

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
          <EnterpriseButton
            type="submit"
            form="building-form"
            variant="primary"
            size="md"
            fullWidth
            loading={isSaving}
            className="max-lg:min-h-[52px] sm:w-auto"
          >
            {isSaving ? "Saving…" : mode === "create" ? "Create building" : "Save changes"}
          </EnterpriseButton>
          <EnterpriseButton
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            disabled={isSaving}
            onClick={onClose}
            className="max-lg:min-h-[52px] sm:w-auto"
          >
            Cancel
          </EnterpriseButton>
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

      <EnterpriseForm
        form={form}
        density="mobile"
        id="building-form"
        className="space-y-3"
        onSubmit={handleSubmit}
      >
        <EnterpriseFormField<BuildingFormValues> name="name" label="Building name" required>
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseInput
              {...field}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="e.g. Tower A"
              autoFocus
            />
          )}
        </EnterpriseFormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <EnterpriseFormField<BuildingFormValues> name="code" label="Code">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="e.g. A, B2"
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<BuildingFormValues> name="floorsApprox" label="Floors (approx)">
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                type="number"
                inputMode="numeric"
                placeholder="e.g. 12"
              />
            )}
          </EnterpriseFormField>
        </div>

        <EnterpriseFormField<BuildingFormValues> name="buildingType" label="Building type">
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseSelect
              {...field}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            >
              <option value="">Select type</option>
              {BUILDING_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </EnterpriseSelect>
          )}
        </EnterpriseFormField>

        <BuildingImageField
          buildingId={mode === "edit" ? initial?.id : undefined}
          hasExistingImage={Boolean(initial?.hasImage)}
          pendingFile={pendingImage}
          onPendingFileChange={setPendingImage}
          removeExisting={removeImage}
          onRemoveExistingChange={setRemoveImage}
          disabled={isSaving}
        />

        <EnterpriseFormField<BuildingFormValues> name="notes" label="Notes">
          {({ describedBy, field, id, invalid }) => (
            <EnterpriseTextarea
              {...field}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="Optional notes for the owner or team"
              rows={3}
            />
          )}
        </EnterpriseFormField>
      </EnterpriseForm>
    </EnterpriseResponsiveDialog>
  );
}
