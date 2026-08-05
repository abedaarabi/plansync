"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { fetchOmAssetImageReadUrl } from "@/lib/api-client";
import { referencePhotoContentType } from "@/lib/referencePhotoMime";
import { qk } from "@/lib/queryKeys";

const MAX_ASSET_IMAGE_BYTES = 15 * 1024 * 1024;

export type OmAssetImageFieldController = {
  cameraInputRef: RefObject<HTMLInputElement | null>;
  libraryInputRef: RefObject<HTMLInputElement | null>;
  previewUrl: string | null | undefined;
  hasPreview: boolean;
  existingPending: boolean;
  canRemove: boolean;
  handlePick: (file: File | undefined) => void;
  clearImage: () => void;
};

export function useOmAssetImageFieldController(opts: {
  projectId?: string;
  assetId?: string;
  hasExistingImage?: boolean;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  removeExisting?: boolean;
  onRemoveExistingChange?: (remove: boolean) => void;
  disabled?: boolean;
}): OmAssetImageFieldController {
  const {
    projectId,
    assetId,
    hasExistingImage = false,
    pendingFile,
    onPendingFileChange,
    removeExisting = false,
    onRemoveExistingChange,
    disabled = false,
  } = opts;

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const showExisting =
    hasExistingImage && Boolean(projectId) && Boolean(assetId) && !pendingFile && !removeExisting;

  const { data: existingUrl, isPending: existingPending } = useQuery({
    queryKey: qk.omAssetImageReadUrl(projectId ?? "", assetId ?? ""),
    queryFn: () => fetchOmAssetImageReadUrl(projectId!, assetId!),
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

  function resetInputs() {
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (libraryInputRef.current) libraryInputRef.current.value = "";
  }

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
    if (file.size > MAX_ASSET_IMAGE_BYTES) {
      toast.error("Image too large (max 15 MB).");
      return;
    }
    onPendingFileChange(file);
    onRemoveExistingChange?.(false);
    resetInputs();
  }

  function clearImage() {
    onPendingFileChange(null);
    if (hasExistingImage) onRemoveExistingChange?.(true);
    resetInputs();
  }

  return {
    cameraInputRef,
    libraryInputRef,
    previewUrl,
    hasPreview,
    existingPending,
    canRemove: Boolean(pendingFile || (hasExistingImage && !removeExisting)),
    handlePick,
    clearImage,
  };
}
