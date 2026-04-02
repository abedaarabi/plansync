"use client";

import { useState } from "react";
import { FolderTree } from "lucide-react";

type Props = {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
  /** When true, show folder icon instead of letter if image fails or missing */
  fallbackIcon?: boolean;
};

/**
 * Project avatar: favicon when `logoUrl` loads, otherwise first letter or folder icon.
 */
export function ProjectLogo({
  name,
  logoUrl,
  size = 32,
  className = "",
  fallbackIcon = false,
}: Props) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";

  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external favicon URLs
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-lg border border-[var(--enterprise-border)]/80 bg-white object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  if (fallbackIcon) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)]/60 bg-[var(--enterprise-bg)] text-[var(--enterprise-primary)] ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <FolderTree className="h-[55%] w-[55%]" strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--enterprise-border)]/60 bg-[var(--enterprise-primary-soft)] text-[13px] font-semibold text-[var(--enterprise-primary)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
