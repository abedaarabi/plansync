"use client";

import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useOmAssetImageFieldController } from "@/lib/omAssetImageFieldController";

const pickBtnClass =
  "bim-focus-ring relative inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_55%,transparent)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--bim-text)] transition hover:bg-[color-mix(in_srgb,var(--bim-panel)_75%,transparent)] disabled:pointer-events-none disabled:opacity-40";

export function BimAssetImageField(props: {
  projectId?: string;
  assetId?: string;
  hasExistingImage?: boolean;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  removeExisting?: boolean;
  onRemoveExistingChange?: (remove: boolean) => void;
  disabled?: boolean;
  /** Caption under the preview (e.g. captured from 3D). */
  hint?: string | null;
}) {
  const {
    cameraInputRef,
    libraryInputRef,
    previewUrl,
    hasPreview,
    existingPending,
    canRemove,
    handlePick,
    clearImage,
  } = useOmAssetImageFieldController(props);

  return (
    <section className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
        Equipment photo
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start">
        <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_40%,transparent)] sm:h-24 sm:w-28">
          {hasPreview ? (
            existingPending && !previewUrl ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2
                  className="h-5 w-5 animate-spin text-[var(--bim-text-muted)]"
                  strokeWidth={2}
                />
              </div>
            ) : previewUrl ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover object-center" />
            ) : null
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-[var(--bim-text-muted)]">
              <ImagePlus className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-[10px] font-medium">No photo</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <label className={pickBtnClass}>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                disabled={props.disabled}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                onChange={(e) => handlePick(e.target.files?.[0])}
              />
              <Camera
                className="h-3.5 w-3.5 shrink-0 text-[var(--bim-accent)]"
                strokeWidth={1.75}
              />
              Take photo
            </label>
            <label className={pickBtnClass}>
              <input
                ref={libraryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                disabled={props.disabled}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                onChange={(e) => handlePick(e.target.files?.[0])}
              />
              <ImagePlus
                className="h-3.5 w-3.5 shrink-0 text-[var(--bim-text-muted)]"
                strokeWidth={1.75}
              />
              From library
            </label>
          </div>
          {canRemove ? (
            <button
              type="button"
              disabled={props.disabled}
              onClick={clearImage}
              className="bim-focus-ring inline-flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-[color-mix(in_srgb,var(--bim-panel)_70%,transparent)] disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              Remove photo
            </button>
          ) : null}
          {props.hint ? (
            <p className="text-[10px] text-[var(--bim-text-muted)]">{props.hint}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
