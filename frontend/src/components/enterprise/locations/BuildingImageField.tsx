"use client";

import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchBuildingImageReadUrl } from "@/lib/api-client/locations";
import { referencePhotoContentType } from "@/lib/referencePhotoMime";
import { MOBILE_FIELD_LABEL } from "@/lib/mobileFormStyles";
import { qk } from "@/lib/queryKeys";

const MAX_BYTES = 15 * 1024 * 1024;

const pickBtnClass =
  "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:pointer-events-none disabled:opacity-50";

type Props = {
  buildingId?: string;
  hasExistingImage?: boolean;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  removeExisting?: boolean;
  onRemoveExistingChange?: (remove: boolean) => void;
  disabled?: boolean;
};

// fallow-ignore-next-line complexity
export function BuildingImageField({
  buildingId,
  hasExistingImage = false,
  pendingFile,
  onPendingFileChange,
  removeExisting = false,
  onRemoveExistingChange,
  disabled = false,
}: Props) {
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const showExisting = hasExistingImage && Boolean(buildingId) && !pendingFile && !removeExisting;

  const { data: existingUrl, isPending: existingPending } = useQuery({
    queryKey: qk.buildingImageReadUrl(buildingId ?? ""),
    queryFn: () => fetchBuildingImageReadUrl(buildingId!),
    enabled: showExisting,
    staleTime: 4 * 60 * 1000,
  });

  useEffect(() => {
    if (!pendingFile) {
      setLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const previewUrl = pendingFile ? localPreviewUrl : showExisting ? existingUrl : null;
  const hasPreview = Boolean(previewUrl) || (showExisting && existingPending);
  const canRemove = Boolean(pendingFile || (hasExistingImage && !removeExisting));

  function handlePick(file: File | undefined) {
    if (!file || disabled) return;
    const ct = referencePhotoContentType(file);
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif",
    ]);
    if (!allowed.has(ct)) {
      toast.error("Use a JPEG, PNG, WebP, GIF, or HEIC image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large (max 15 MB).");
      return;
    }
    onPendingFileChange(file);
    onRemoveExistingChange?.(false);
    if (libraryInputRef.current) libraryInputRef.current.value = "";
  }

  function clearImage() {
    onPendingFileChange(null);
    if (hasExistingImage) onRemoveExistingChange?.(true);
    if (libraryInputRef.current) libraryInputRef.current.value = "";
  }

  return (
    <div>
      <p className={`${MOBILE_FIELD_LABEL} mb-2`}>Building photo (optional)</p>
      <p className="mb-3 text-xs text-[var(--enterprise-text-muted)]">
        JPEG, PNG, WebP, GIF, or HEIC — up to 15 MB.
      </p>
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
              <span className="text-xs font-medium">No photo</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
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
            Choose image
          </label>
          {canRemove ? (
            <button
              type="button"
              disabled={disabled}
              onClick={clearImage}
              className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg px-3 text-sm font-medium text-[var(--enterprise-semantic-danger-text)] hover:bg-[var(--enterprise-semantic-danger-bg)] disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
              Remove photo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
