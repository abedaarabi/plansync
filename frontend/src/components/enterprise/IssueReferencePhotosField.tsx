"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IssueReferenceLiveCapture } from "@/components/pdf-viewer/IssueReferenceLiveCapture";
import {
  patchIssue,
  presignReadIssueReferencePhoto,
  uploadIssueReferencePhotoFile,
  type IssueReferencePhotoRow,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

export type IssuePendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

type Props = {
  /** When null, files are queued locally until the issue is saved. */
  issueId: string | null;
  photos: IssueReferencePhotoRow[];
  onPhotosChange: (photos: IssueReferencePhotoRow[]) => void;
  pendingPhotos?: IssuePendingPhoto[];
  onPendingPhotosChange?: (photos: IssuePendingPhoto[]) => void;
  disabled?: boolean;
  hint?: string;
};

function SavedPhotoThumb({ issueId, photo }: { issueId: string; photo: IssueReferencePhotoRow }) {
  const { data: url, isPending } = useQuery({
    queryKey: qk.issueRefPhotoReadUrl(issueId, photo.id),
    queryFn: () => presignReadIssueReferencePhoto(issueId, photo.id),
    staleTime: 60_000,
  });
  if (isPending || !url) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--enterprise-text-muted)]" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
    <img
      src={url}
      alt=""
      className="h-14 w-14 shrink-0 rounded-lg border border-[var(--enterprise-border)] object-cover"
    />
  );
}

const pickBtnClass =
  "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:pointer-events-none disabled:opacity-50";

export function IssueReferencePhotosField({
  issueId,
  photos,
  onPhotosChange,
  pendingPhotos = [],
  onPendingPhotosChange,
  disabled = false,
  hint,
}: Props) {
  const [liveCaptureOpen, setLiveCaptureOpen] = useState(false);
  const isPendingMode = !issueId;

  const canLiveCapture = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      typeof window !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      (window.isSecureContext === true ||
        window.location.protocol === "https:" ||
        window.location.hostname === "localhost"),
    [],
  );

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadIssueReferencePhotoFile(issueId!, file),
    onSuccess: (row) => {
      onPhotosChange(row.referencePhotos ?? []);
      toast.success("Photo attached");
    },
    onError: (e: Error) => toast.error(e.message || "Could not attach photo."),
  });

  const removeMut = useMutation({
    mutationFn: (next: IssueReferencePhotoRow[]) => patchIssue(issueId!, { referencePhotos: next }),
    onSuccess: (row) => {
      onPhotosChange(row.referencePhotos ?? []);
      toast.success("Photo removed");
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove photo."),
  });

  const busy = disabled || uploadMut.isPending || removeMut.isPending;

  const queuePendingFile = useCallback(
    (file: File) => {
      if (!onPendingPhotosChange) return;
      const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      onPendingPhotosChange([...pendingPhotos, { id, file, previewUrl }]);
    },
    [onPendingPhotosChange, pendingPhotos],
  );

  const handlePick = useCallback(
    (file: File | undefined) => {
      if (!file || busy) return;
      if (isPendingMode) queuePendingFile(file);
      else uploadMut.mutate(file);
    },
    [busy, isPendingMode, queuePendingFile, uploadMut],
  );

  const removePending = useCallback(
    (id: string) => {
      if (!onPendingPhotosChange) return;
      const hit = pendingPhotos.find((p) => p.id === id);
      if (hit) URL.revokeObjectURL(hit.previewUrl);
      onPendingPhotosChange(pendingPhotos.filter((p) => p.id !== id));
    },
    [onPendingPhotosChange, pendingPhotos],
  );

  return (
    <div className="space-y-3">
      <div>
        <p className={MOBILE_FIELD_LABEL}>Photos</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
          {hint ??
            (isPendingMode
              ? "Add photos now — they upload when you create the issue."
              : "Attach site photos from your camera or photo library.")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className={pickBtnClass}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              handlePick(f);
            }}
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
            disabled={busy}
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
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
            disabled={busy}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              handlePick(f);
            }}
          />
          <ImagePlus
            className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)]"
            strokeWidth={1.75}
          />
          From library
        </label>
      </div>

      {uploadMut.isPending ? (
        <p className="flex items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Uploading…
        </p>
      ) : null}

      {photos.length === 0 && pendingPhotos.length === 0 ? (
        <p className="text-xs text-[var(--enterprise-text-muted)]">No photos yet.</p>
      ) : (
        <ul className="space-y-2">
          {photos.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2"
            >
              {issueId ? <SavedPhotoThumb issueId={issueId} photo={p} /> : null}
              <span
                className="min-w-0 flex-1 truncate text-sm text-[var(--enterprise-text)]"
                title={p.fileName}
              >
                {p.fileName}
              </span>
              <button
                type="button"
                disabled={busy || !issueId}
                onClick={() => removeMut.mutate(photos.filter((q) => q.id !== p.id))}
                className="shrink-0 rounded-lg border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--enterprise-semantic-danger-text)] disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
          {pendingPhotos.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-3 py-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
              <img
                src={p.previewUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg border border-[var(--enterprise-border)] object-cover"
              />
              <span
                className="min-w-0 flex-1 truncate text-sm text-[var(--enterprise-text)]"
                title={p.file.name}
              >
                {p.file.name}
              </span>
              <span className="shrink-0 rounded-md bg-[var(--enterprise-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-primary)]">
                Queued
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => removePending(p.id)}
                className="shrink-0 rounded-lg border border-[var(--enterprise-border)] px-2.5 py-1 text-xs font-semibold text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <IssueReferenceLiveCapture
        open={liveCaptureOpen}
        onClose={() => setLiveCaptureOpen(false)}
        onCapture={(file) => handlePick(file)}
      />
    </div>
  );
}

const MOBILE_FIELD_LABEL =
  "mb-1.5 block text-sm font-medium leading-snug text-[var(--enterprise-text)]";
