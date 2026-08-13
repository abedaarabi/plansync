"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Building2, MapPin } from "lucide-react";
import {
  fetchBuildingLevels,
  fetchLocationDetail,
  fetchLocations,
  type LocationBuildingRow,
} from "@/lib/api-client/locations";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FORM_SECTION,
} from "@/lib/mobileFormStyles";
import { projectScopedHref } from "@/lib/projectScopedPath";
import { qk } from "@/lib/queryKeys";

export type WorkOrderLocationValue = {
  buildingId: string;
  levelId: string;
  location: string;
};

type Props = {
  projectId: string;
  workspaceId?: string;
  value: WorkOrderLocationValue;
  onChange: (next: WorkOrderLocationValue) => void;
  /** When true, room/zone text was edited by the user (parent tracks prefill rules). */
  onLocationTextChange?: (text: string) => void;
  idPrefix?: string;
  disabled?: boolean;
};

type BuildingOption = LocationBuildingRow & { locationName: string };

export function WorkOrderLocationFields({
  projectId,
  workspaceId,
  value,
  onChange,
  onLocationTextChange,
  idPrefix = "wo-loc",
  disabled,
}: Props) {
  const locationsHref = projectScopedHref(projectId, "/locations", workspaceId);

  const { data: locations = [], isPending: locationsPending } = useQuery({
    queryKey: qk.locations(projectId),
    queryFn: () => fetchLocations(projectId),
  });

  const locationDetails = useQueries({
    queries: locations.map((loc) => ({
      queryKey: qk.locationDetail(loc.id),
      queryFn: () => fetchLocationDetail(loc.id),
      enabled: locations.length > 0,
      staleTime: 60_000,
    })),
  });

  const buildings = useMemo(() => {
    const out: BuildingOption[] = [];
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i]!;
      const detail = locationDetails[i]?.data;
      if (!detail?.buildings) continue;
      for (const b of detail.buildings) {
        out.push({ ...b, locationName: loc.name });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, locationDetails]);

  const detailsPending = locationDetails.some((q) => q.isPending);
  const buildingsReady = !locationsPending && !detailsPending;

  const { data: levels = [], isPending: levelsPending } = useQuery({
    queryKey: qk.buildingLevels(value.buildingId),
    queryFn: () => fetchBuildingLevels(value.buildingId),
    enabled: Boolean(value.buildingId),
  });

  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [levels],
  );

  if (buildingsReady && buildings.length === 0) {
    return (
      <div className={MOBILE_FORM_SECTION}>
        <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Location</p>
        <div className="rounded-md border border-dashed border-[var(--enterprise-border)] px-3 py-4 text-center">
          <Building2
            className="mx-auto h-7 w-7 text-[var(--enterprise-text-muted)]"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-2 text-sm font-medium text-[var(--enterprise-text)]">
            No buildings set up yet
          </p>
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
            Add a site and building under Locations so work orders can track building and level.
          </p>
          <Link
            href={locationsHref}
            className="mt-2 inline-block text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
          >
            Open Locations
          </Link>
        </div>
        <div className="mt-3">
          <label htmlFor={`${idPrefix}-room`} className={MOBILE_FIELD_LABEL}>
            Room / zone
          </label>
          <input
            id={`${idPrefix}-room`}
            value={value.location}
            disabled={disabled}
            onChange={(e) => {
              onChange({ ...value, location: e.target.value });
              onLocationTextChange?.(e.target.value);
            }}
            className={MOBILE_FIELD_INPUT}
            placeholder="Optional free-text location"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={MOBILE_FORM_SECTION}>
      <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Location</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-building`} className={MOBILE_FIELD_LABEL}>
            Building
          </label>
          <select
            id={`${idPrefix}-building`}
            value={value.buildingId}
            disabled={disabled || !buildingsReady}
            onChange={(e) => {
              const buildingId = e.target.value;
              onChange({ buildingId, levelId: "", location: value.location });
            }}
            className={MOBILE_FIELD_SELECT}
          >
            <option value="">{buildingsReady ? "Select building…" : "Loading buildings…"}</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.code ? ` (${b.code})` : ""}
                {b.locationName ? ` · ${b.locationName}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-level`} className={MOBILE_FIELD_LABEL}>
            Level
          </label>
          <select
            id={`${idPrefix}-level`}
            value={value.levelId}
            disabled={disabled || !value.buildingId || levelsPending}
            onChange={(e) => onChange({ ...value, levelId: e.target.value })}
            className={MOBILE_FIELD_SELECT}
          >
            <option value="">
              {!value.buildingId
                ? "Select building first"
                : levelsPending
                  ? "Loading levels…"
                  : "Any / whole building"}
            </option>
            {sortedLevels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-room`} className={MOBILE_FIELD_LABEL}>
            Room / zone
          </label>
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
              aria-hidden
            />
            <input
              id={`${idPrefix}-room`}
              value={value.location}
              disabled={disabled}
              onChange={(e) => {
                onChange({ ...value, location: e.target.value });
                onLocationTextChange?.(e.target.value);
              }}
              className={`${MOBILE_FIELD_INPUT} enterprise-field-input--icon`}
              placeholder="Room, grid, zone…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
