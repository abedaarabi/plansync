"use client";

import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { presignReadIssueReferencePhoto, type IssueReferencePhotoRow } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

/** Compact first-reference-photo thumbnail for issue lists. */
export function IssueReferencePhotoThumb(props: {
  issueId: string;
  photo: IssueReferencePhotoRow;
  /** Extra photos beyond the first (shown as a small badge). */
  extraCount?: number;
  className?: string;
}) {
  const { data: url, isPending } = useQuery({
    queryKey: qk.issueRefPhotoReadUrl(props.issueId, props.photo.id),
    queryFn: () => presignReadIssueReferencePhoto(props.issueId, props.photo.id),
    staleTime: 60_000,
  });

  const extra = props.extraCount ?? 0;

  return (
    <span
      className={`relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] ${props.className ?? ""}`}
      title={props.photo.fileName}
    >
      {isPending || !url ? (
        <span className="flex h-full w-full items-center justify-center bg-[var(--enterprise-border)]/40">
          <Camera className="h-3.5 w-3.5 text-[var(--enterprise-text-muted)]" aria-hidden />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      )}
      {extra > 0 ? (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-[var(--enterprise-surface)]/95 px-1 text-[9px] font-semibold tabular-nums text-[var(--enterprise-text)]">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
