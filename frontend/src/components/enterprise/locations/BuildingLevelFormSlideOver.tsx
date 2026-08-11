"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import { useCreateBuildingLevelMutation } from "@/lib/locations/useBuildingQueries";

type Props = {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  locationId: string;
};

export function BuildingLevelFormSlideOver({ open, onClose, buildingId, locationId }: Props) {
  const [name, setName] = useState("");
  const [elevation, setElevation] = useState("");
  const createMut = useCreateBuildingLevelMutation(buildingId, locationId);

  useEffect(() => {
    if (!open) {
      setName("");
      setElevation("");
    }
  }, [open]);

  const handleClose = () => {
    if (createMut.isPending) return;
    onClose();
  };

  const elevNum = elevation.trim() === "" ? undefined : Number(elevation);
  const elevValid = elevNum === undefined || Number.isFinite(elevNum);

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={handleClose}
      form={{
        onSubmit: (e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed || !elevValid) return;
          createMut.mutate(
            {
              name: trimmed,
              ...(elevNum !== undefined ? { elevation: elevNum } : {}),
            },
            {
              onSuccess: () => {
                toast.success(`Level “${trimmed}” created`);
                onClose();
              },
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : "Could not create level.");
              },
            },
          );
        },
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
          <EnterpriseButton
            type="submit"
            size="sm"
            loading={createMut.isPending}
            disabled={!name.trim() || !elevValid}
          >
            {createMut.isPending ? "Creating…" : "Create level"}
          </EnterpriseButton>
        </>
      }
    >
      <div className={MOBILE_FORM_SECTION}>
        <div>
          <label htmlFor="building-level-name" className={MOBILE_FIELD_LABEL}>
            Name *
          </label>
          <input
            id="building-level-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={MOBILE_FIELD_INPUT}
            required
            maxLength={200}
            placeholder="Level 1"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="building-level-elevation" className={MOBILE_FIELD_LABEL}>
            Elevation (m, optional)
          </label>
          <input
            id="building-level-elevation"
            type="number"
            step="any"
            value={elevation}
            onChange={(e) => setElevation(e.target.value)}
            className={MOBILE_FIELD_INPUT}
            placeholder="0"
          />
          {!elevValid ? (
            <p className="mt-1 text-xs text-[var(--enterprise-error)]">Enter a valid number.</p>
          ) : null}
        </div>
      </div>
    </EnterpriseSlideOver>
  );
}
