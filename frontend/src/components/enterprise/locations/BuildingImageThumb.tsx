"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { memo, useState } from "react";
import { fetchBuildingImageReadUrl } from "@/lib/api-client/locations";
import { qk } from "@/lib/queryKeys";

type Props = {
  buildingId: string;
  hasImage: boolean;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
};

export const BuildingImageThumb = memo(function BuildingImageThumb({
  buildingId,
  hasImage,
  alt = "",
  className = "h-full w-full object-cover object-center",
  fallbackClassName = "flex h-full w-full items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]",
}: Props) {
  const { data: url, isPending } = useQuery({
    queryKey: qk.buildingImageReadUrl(buildingId),
    queryFn: () => fetchBuildingImageReadUrl(buildingId),
    enabled: hasImage && Boolean(buildingId),
    staleTime: 4 * 60 * 1000,
  });

  const [failed, setFailed] = useState(false);

  if (!hasImage || failed) {
    return (
      <span className={fallbackClassName} aria-hidden>
        <Building2 className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
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
