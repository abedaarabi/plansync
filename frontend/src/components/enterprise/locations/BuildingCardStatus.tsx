"use client";

import type { BuildingPublishStatus, LocationBuildingRow } from "@/lib/api-client/locations";
import { buildingStatusLabel } from "@/lib/locations/buildingPublish";

type BuildingCardStatusKind =
  | "processing"
  | "failed"
  | "setup"
  | "ready"
  | "needs_update"
  | "empty";

function resolveBuildingCardStatus(building: LocationBuildingRow): BuildingCardStatusKind {
  if (building.hasProcessing) return "processing";
  if (building.hasFailed && building.ifcCount > 0 && building.publishStatus === "setup") {
    return "failed";
  }
  if (building.ifcCount === 0 && building.pdfCount === 0) return "empty";
  return building.publishStatus;
}

const STATUS_CLASS: Record<BuildingCardStatusKind, string> = {
  processing: "enterprise-badge-warning",
  failed: "enterprise-badge-danger",
  setup: "enterprise-badge-neutral",
  ready: "enterprise-badge-success",
  needs_update: "enterprise-badge-warning",
  empty: "enterprise-badge-neutral",
};

function statusLabel(kind: BuildingCardStatusKind, publishStatus: BuildingPublishStatus): string {
  if (kind === "processing") return "Processing";
  if (kind === "failed") return "Failed";
  if (kind === "empty") return "No files";
  return buildingStatusLabel(publishStatus);
}

type Props = {
  building: LocationBuildingRow;
};

export function BuildingCardStatus({ building }: Props) {
  const kind = resolveBuildingCardStatus(building);
  return (
    <span
      className={`${STATUS_CLASS[kind]} inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold`}
    >
      {kind === "processing" ? (
        <span
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current"
          aria-hidden
        />
      ) : null}
      {statusLabel(kind, building.publishStatus)}
    </span>
  );
}
