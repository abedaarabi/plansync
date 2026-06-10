"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";
import { memo, useState } from "react";
import { fetchOmAssetImageReadUrl } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";

type Props = {
  projectId: string;
  assetId: string;
  hasImage: boolean;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
};

export const OmAssetImageThumb = memo(function OmAssetImageThumb({
  projectId,
  assetId,
  hasImage,
  alt = "",
  className = "h-full w-full object-cover object-center",
  fallbackClassName = "flex h-full w-full items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]",
}: Props) {
  const { data: url, isPending } = useQuery({
    queryKey: qk.omAssetImageReadUrl(projectId, assetId),
    queryFn: () => fetchOmAssetImageReadUrl(projectId, assetId),
    enabled: hasImage && Boolean(projectId) && Boolean(assetId),
    staleTime: 4 * 60 * 1000,
  });

  const [failed, setFailed] = useState(false);

  if (!hasImage) {
    return (
      <span className={fallbackClassName} aria-hidden>
        <Package className="h-4 w-4 text-[var(--enterprise-primary)]" strokeWidth={2} />
      </span>
    );
  }

  if (isPending || !url) {
    return (
      <span className={fallbackClassName} aria-hidden>
        <Loader2
          className="h-4 w-4 animate-spin text-[var(--enterprise-text-muted)]"
          strokeWidth={2}
        />
      </span>
    );
  }

  if (failed) {
    return (
      <span className={fallbackClassName} aria-hidden>
        <Package className="h-4 w-4 text-[var(--enterprise-primary)]" strokeWidth={2} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
});
