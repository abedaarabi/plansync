"use client";

import { useEffect } from "react";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import { EnterpriseInput } from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import { MOBILE_FORM_SECTION } from "@/lib/mobileFormStyles";
import { useCreateBuildingLevelMutation } from "@/lib/locations/useBuildingQueries";

type Props = {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  locationId: string;
};

const buildingLevelFormSchema = z.object({
  elevation: z.string().refine((value) => value.trim() === "" || Number.isFinite(Number(value)), {
    message: "Enter a valid number.",
  }),
  name: z.string().trim().min(1, "Enter a level name.").max(200, "Use 200 characters or fewer."),
});

type BuildingLevelFormValues = z.infer<typeof buildingLevelFormSchema>;

const EMPTY_FORM: BuildingLevelFormValues = { elevation: "", name: "" };

export function BuildingLevelFormSlideOver({ open, onClose, buildingId, locationId }: Props) {
  const form = useEnterpriseForm(buildingLevelFormSchema, EMPTY_FORM);
  const createMut = useCreateBuildingLevelMutation(buildingId, locationId);

  useEffect(() => {
    if (!open) {
      form.reset(EMPTY_FORM);
    }
  }, [form, open]);

  const handleClose = () => {
    if (createMut.isPending) return;
    onClose();
  };

  const handleSubmit = (values: BuildingLevelFormValues) => {
    const elevation = values.elevation.trim();
    const elevationValue = elevation === "" ? undefined : Number(elevation);
    const name = values.name.trim();
    createMut.mutate(
      {
        name,
        ...(elevationValue !== undefined ? { elevation: elevationValue } : {}),
      },
      {
        onSuccess: () => {
          toast.success(`Level “${name}” created`);
          onClose();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Could not create level.");
        },
      },
    );
  };

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={handleClose}
      form={{
        noValidate: true,
        onSubmit: form.handleSubmit(handleSubmit),
      }}
      ariaLabelledBy="building-level-create-title"
      header={
        <SlideOverHeader
          icon={Layers}
          titleId="building-level-create-title"
          title="Add level"
          description="Name the floor or storey. Assign PDF drawings next."
        />
      }
      footer={
        <>
          <EnterpriseButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClose}
            disabled={createMut.isPending}
          >
            Cancel
          </EnterpriseButton>
          <EnterpriseButton type="submit" size="sm" loading={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create level"}
          </EnterpriseButton>
        </>
      }
    >
      <EnterpriseForm
        form={form}
        formId="building-level-form"
        density="mobile"
        onSubmit={handleSubmit}
      >
        <div className={MOBILE_FORM_SECTION}>
          <EnterpriseFormField<BuildingLevelFormValues> name="name" label="Name" required>
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="Level 1"
                autoFocus
              />
            )}
          </EnterpriseFormField>
          <EnterpriseFormField<BuildingLevelFormValues>
            name="elevation"
            label="Elevation (m, optional)"
          >
            {({ describedBy, field, id, invalid }) => (
              <EnterpriseInput
                {...field}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                type="number"
                step="any"
                placeholder="0"
              />
            )}
          </EnterpriseFormField>
        </div>
      </EnterpriseForm>
    </EnterpriseSlideOver>
  );
}
