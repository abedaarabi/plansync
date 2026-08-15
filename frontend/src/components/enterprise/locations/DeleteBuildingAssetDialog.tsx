"use client";

import { AlertTriangle } from "lucide-react";
import type { BuildingAsset } from "@/lib/api-client/locations";
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { ConfirmDialogActions } from "@/components/enterprise/ConfirmDialogActions";

type Props = {
  open: boolean;
  asset: BuildingAsset | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

export function DeleteBuildingAssetDialog({
  open,
  asset,
  onConfirm,
  onCancel,
  isDeleting = false,
}: Props) {
  const isIfc = asset?.type === "IFC";
  const isMappedPdf = asset?.type === "PDF" && Boolean(asset.mappingId);

  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      role="alertdialog"
      ariaLabelledBy="delete-building-asset-title"
      ariaDescribedBy="delete-building-asset-desc"
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      footer={
        <ConfirmDialogActions
          confirmLabel={isIfc ? "Remove model" : "Remove drawing"}
          confirmingLabel="Removing…"
          isPending={isDeleting}
          confirmDisabled={!asset}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      }
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600">
          <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="delete-building-asset-title"
            className="text-balance text-lg font-semibold text-[var(--enterprise-text)]"
          >
            {isIfc ? "Remove IFC model?" : "Remove drawing?"}
          </h2>
          <p
            id="delete-building-asset-desc"
            className="mt-2 text-base leading-relaxed text-[var(--enterprise-text-muted)]"
          >
            {isIfc ? (
              <>
                <span className="font-medium text-[var(--enterprise-text)]">{asset?.fileName}</span>{" "}
                will be removed from this building. Levels and drawing mappings tied to this model
                may break, and Open 3D can become unavailable until you upload another IFC.
              </>
            ) : isMappedPdf ? (
              <>
                <span className="font-medium text-[var(--enterprise-text)]">{asset?.fileName}</span>{" "}
                will be removed from this building and{" "}
                <span className="font-medium text-[var(--enterprise-text)]">
                  unmapped from its matched floor plan
                </span>
                . Linked project files are only detached, not deleted from the project library.
              </>
            ) : (
              <>
                <span className="font-medium text-[var(--enterprise-text)]">{asset?.fileName}</span>{" "}
                will be removed from this building. Linked project files are only detached, not
                deleted from the project library.
              </>
            )}
          </p>
        </div>
      </div>
    </EnterpriseResponsiveDialog>
  );
}
