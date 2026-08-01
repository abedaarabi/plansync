"use client";

import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import type { BuildingChecklist } from "@/lib/api-client/locations";
import { canPublishBuilding } from "@/lib/locations/buildingPublish";
import { usePublishBuildingMappingsMutation } from "@/lib/locations/useBuildingQueries";
import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_PRIMARY,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";
import { BuildingPublishChecklist } from "./BuildingPublishChecklist";

type Props = {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  locationId: string;
  checklist: BuildingChecklist;
  onPublished?: () => void;
};

export function BuildingPublishDialog({
  open,
  onClose,
  buildingId,
  locationId,
  checklist,
  onPublished,
}: Props) {
  const publishMut = usePublishBuildingMappingsMutation(buildingId, locationId);
  const canPublish = canPublishBuilding(checklist);
  const pending = publishMut.isPending;

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={pending ? () => undefined : onClose}
      ariaLabelledBy="publish-building-title"
      ariaDescribedBy="publish-building-desc"
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
      footer={
        <>
          <button
            type="button"
            disabled={!canPublish || pending}
            className={`${MOBILE_DIALOG_BTN_PRIMARY} enterprise-btn-primary disabled:opacity-50`}
            onClick={() => {
              publishMut.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Building published — Open 3D is ready");
                  onPublished?.();
                  onClose();
                },
                onError: (e: Error) => toast.error(e.message || "Could not publish"),
              });
            }}
          >
            {pending ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Publishing…
              </span>
            ) : (
              "Publish"
            )}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]`}
          >
            Cancel
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
            <Rocket className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2
              id="publish-building-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              Publish building
            </h2>
            <p
              id="publish-building-desc"
              className="mt-1 text-sm leading-relaxed text-[var(--enterprise-text-muted)]"
            >
              Confirm setup looks right, then hand off Open 3D. You can edit mappings anytime after.
            </p>
          </div>
        </div>
        <BuildingPublishChecklist checklist={checklist} />
        {!canPublish ? (
          <p className="text-xs text-[var(--enterprise-semantic-danger-text)]">
            Finish required items (IFC ready + at least one level) before publishing.
          </p>
        ) : checklist.unmappedPdfCount > 0 || checklist.levelsWithoutDrawing > 0 ? (
          <p className="text-xs text-[var(--enterprise-semantic-warning-text)]">
            You can publish with incomplete mappings — unfinished items stay editable.
          </p>
        ) : null}
      </div>
    </EnterpriseResponsiveDialog>
  );
}
