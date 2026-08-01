"use client";

import type { ProcessingStatus } from "@/lib/api-client/locations";

const STATUS_CLASS: Record<ProcessingStatus, string> = {
  PENDING: "enterprise-badge-neutral",
  PROCESSING: "enterprise-badge-warning",
  READY: "enterprise-badge-success",
  FAILED: "enterprise-badge-danger",
};

const STATUS_LABEL: Record<ProcessingStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
};

export function ProcessingStatusPill({ status }: { status: ProcessingStatus }) {
  return (
    <span
      className={`enterprise-badge ${STATUS_CLASS[status]} inline-flex items-center gap-1 px-2 py-0.5 text-xs`}
    >
      {status === "PROCESSING" ? (
        <span
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current"
          aria-hidden
        />
      ) : null}
      {STATUS_LABEL[status]}
    </span>
  );
}
