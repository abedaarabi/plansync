"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  assetDraftFromRow,
  assetDraftToCorePatchBody,
  assetDraftToCreateBody,
  type AssetFormDraft,
} from "@/components/enterprise/OmAssetFormFields";
import {
  createOmAsset,
  deleteOmAssetImage,
  patchOmAsset,
  uploadOmAssetImageFile,
  type OmAssetBimAnchor,
  type OmAssetRow,
} from "@/lib/api-client/operations-maintenance-assets";
import { ProRequiredError } from "@/lib/api-client/errors";
import { qk } from "@/lib/queryKeys";
import { BimAssetFormFields } from "./BimAssetFormFields";
import { BimGlassDock } from "./BimGlassDock";

type SharedProps = {
  open: boolean;
  projectId: string;
  modelName: string;
  onClose: () => void;
};

type CreateProps = SharedProps & {
  mode: "create";
  fileId: string;
  fileVersionId: string;
  bimAnchor: OmAssetBimAnchor;
  initialDraft: AssetFormDraft;
  pendingPhoto?: File;
  onCreated: (asset: OmAssetRow) => void;
};

type EditProps = SharedProps & {
  mode: "edit";
  asset: OmAssetRow;
  onSaved: (asset: OmAssetRow) => void;
};

// fallow-ignore-next-line complexity
export function BimAssetFormSlider(props: CreateProps | EditProps) {
  const isEdit = props.mode === "edit";
  const bimAnchor = isEdit ? props.asset.bimAnchor : props.bimAnchor;
  const seedDraft = isEdit ? assetDraftFromRow(props.asset) : props.initialDraft;
  const createPendingPhoto = !isEdit ? (props.pendingPhoto ?? null) : null;
  const qc = useQueryClient();

  const [draft, setDraft] = useState(seedDraft);
  const [pendingImage, setPendingImage] = useState<File | null>(createPendingPhoto);
  const [removeImage, setRemoveImage] = useState(false);

  const editAsset = props.mode === "edit" ? props.asset : null;
  const createInitialDraft = props.mode === "create" ? props.initialDraft : null;

  useEffect(() => {
    if (!props.open) return;
    if (editAsset) {
      setDraft(assetDraftFromRow(editAsset));
      setPendingImage(null);
      setRemoveImage(false);
      return;
    }
    if (createInitialDraft) {
      setDraft(createInitialDraft);
      setPendingImage(createPendingPhoto);
      setRemoveImage(false);
    }
  }, [props.open, editAsset, createInitialDraft, createPendingPhoto]);

  const level = bimAnchor?.spatialPath?.[0] ?? draft.locationLabel;
  const linkedLabel = bimAnchor?.name || bimAnchor?.ifcType || "element";
  const capturedHint =
    !isEdit && pendingImage && createPendingPhoto && pendingImage === createPendingPhoto
      ? "Captured from the 3D view — replace or remove if needed."
      : null;

  const createMut = useMutation({
    mutationFn: async () => {
      if (props.mode !== "create") throw new Error("Not in create mode");
      const base = assetDraftToCreateBody(draft);
      const row = await createOmAsset(props.projectId, {
        ...base,
        fileId: props.fileId,
        fileVersionId: props.fileVersionId,
        pageNumber: null,
        annotationId: null,
        bimAnchor: props.bimAnchor,
      });
      if (pendingImage) {
        return uploadOmAssetImageFile(props.projectId, row.id, pendingImage);
      }
      return row;
    },
    onSuccess: (row) => {
      toast.success("Asset created and linked to this element.");
      if (props.mode === "create") props.onCreated(row);
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (props.mode !== "edit") throw new Error("Not in edit mode");
      let row = await patchOmAsset(
        props.projectId,
        props.asset.id,
        assetDraftToCorePatchBody(draft),
      );
      if (removeImage && props.asset.hasImage) {
        row = await deleteOmAssetImage(props.projectId, props.asset.id);
      }
      if (pendingImage) {
        row = await uploadOmAssetImageFile(props.projectId, props.asset.id, pendingImage);
      }
      return row;
    },
    onSuccess: (row) => {
      if (props.mode === "edit") {
        qc.removeQueries({
          queryKey: qk.omAssetImageReadUrl(props.projectId, props.asset.id),
        });
        props.onSaved(row);
      }
      toast.success("Asset updated.");
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  const busy = createMut.isPending || updateMut.isPending;
  const canSave = draft.tag.trim().length > 0 && draft.name.trim().length > 0 && !busy;

  return (
    <BimGlassDock
      side="right"
      open={props.open}
      title={isEdit ? "Edit asset" : "New asset"}
      subtitle={`Linked to ${linkedLabel}${level ? ` · ${level}` : ""} · ${props.modelName}`}
      icon={Wrench}
      onClose={props.onClose}
      closeOnOutsideClick={false}
    >
      <div className="flex h-full min-h-0 flex-col">
        <BimAssetFormFields
          draft={draft}
          onChange={setDraft}
          bimAnchor={bimAnchor}
          level={level}
          projectId={props.projectId}
          editAssetId={isEdit ? props.asset.id : undefined}
          hasExistingImage={isEdit ? props.asset.hasImage : false}
          pendingImage={pendingImage}
          onPendingImageChange={setPendingImage}
          removeImage={removeImage}
          onRemoveImageChange={setRemoveImage}
          imageHint={capturedHint}
          busy={busy}
          showDocuments={isEdit}
        />

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--bim-chrome-border)] px-3 py-2.5">
          <button
            type="button"
            onClick={props.onClose}
            disabled={busy}
            className="bim-focus-ring rounded-lg px-3 py-1.5 text-[12px] font-medium text-[var(--bim-text-muted)] transition hover:bg-[color-mix(in_srgb,var(--bim-panel)_70%,transparent)] hover:text-[var(--bim-text)] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => (isEdit ? updateMut.mutate() : createMut.mutate())}
            disabled={!canSave}
            className="bim-focus-ring rounded-lg bg-[var(--bim-accent)] px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create asset"}
          </button>
        </footer>
      </div>
    </BimGlassDock>
  );
}
