"use client";

import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { IssueReferenceLiveCapture } from "@/components/pdf-viewer/IssueReferenceLiveCapture";
import { canLiveCameraCapture } from "@/lib/canLiveCameraCapture";
import { useOmAssetImageFieldController } from "@/lib/omAssetImageFieldController";
import { MOBILE_FIELD_LABEL } from "@/lib/mobileFormStyles";

const pickBtnClass =
  "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:pointer-events-none disabled:opacity-50";

type Props = {
  projectId?: string;
  assetId?: string;
  hasExistingImage?: boolean;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  removeExisting?: boolean;
  onRemoveExistingChange?: (remove: boolean) => void;
  disabled?: boolean;
  /** Hide title when nested inside a form section. */
  embedded?: boolean;
};

export function OmAssetImageField({
  projectId,
  assetId,
  hasExistingImage = false,
  pendingFile,
  onPendingFileChange,
  removeExisting = false,
  onRemoveExistingChange,
  disabled = false,
  embedded = false,
}: Props) {
  const [liveCaptureOpen, setLiveCaptureOpen] = useState(false);
  const {
    cameraInputRef,
    libraryInputRef,
    previewUrl,
    hasPreview,
    existingPending,
    canRemove,
    handlePick,
    clearImage,
  } = useOmAssetImageFieldController({
    projectId,
    assetId,
    hasExistingImage,
    pendingFile,
    onPendingFileChange,
    removeExisting,
    onRemoveExistingChange,
    disabled,
  });

  const canLiveCapture = canLiveCameraCapture();

  return (
    <div className="sm:col-span-2">
      {!embedded ? (
        <>
          <p className={`${MOBILE_FIELD_LABEL} mb-2`}>Photo (optional)</p>
          <p className="mb-3 text-xs text-[var(--enterprise-text-muted)]">
            Take a photo with your camera or pick from your library — JPEG, PNG, WebP, GIF, or HEIC,
            up to 15 MB.
          </p>
        </>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]">
          {hasPreview ? (
            existingPending && !previewUrl ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2
                  className="h-5 w-5 animate-spin text-[var(--enterprise-text-muted)]"
                  strokeWidth={2}
                />
              </div>
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob or presigned URL
              <img src={previewUrl} alt="" className="h-full w-full object-cover object-center" />
            ) : null
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-[var(--enterprise-text-muted)]">
              <ImagePlus className="h-6 w-6" strokeWidth={1.5} />
              <span className="text-[10px] font-medium">No photo</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label className={pickBtnClass}>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                disabled={disabled}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                onChange={(e) => handlePick(e.target.files?.[0])}
              />
              <Camera
                className="h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
                strokeWidth={1.75}
              />
              Take photo
            </label>
            {canLiveCapture ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setLiveCaptureOpen(true)}
                className={pickBtnClass}
              >
                <Camera
                  className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                  strokeWidth={1.75}
                />
                Web camera
              </button>
            ) : null}
            <label className={pickBtnClass}>
              <input
                ref={libraryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                disabled={disabled}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                onChange={(e) => handlePick(e.target.files?.[0])}
              />
              <ImagePlus
                className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
                strokeWidth={1.75}
              />
              From library
            </label>
          </div>
          {canRemove ? (
            <button
              type="button"
              disabled={disabled}
              onClick={clearImage}
              className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
              Remove photo
            </button>
          ) : null}
        </div>
      </div>

      <IssueReferenceLiveCapture
        open={liveCaptureOpen}
        onClose={() => setLiveCaptureOpen(false)}
        onCapture={(file) => handlePick(file)}
      />
    </div>
  );
}
