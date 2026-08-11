"use client";

import { MapPin, Pencil } from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { ProjectLocationMap } from "@/components/enterprise/ProjectLocationMap";
import { ProjectWeatherAtLocation } from "@/components/enterprise/ProjectWeatherAtLocation";

type Props = {
  mapCoords: { lat: number; lng: number } | null;
  isApproximateLocation: boolean;
  locationText: string;
  savedCoords: { lat: number; lng: number } | null;
  projectMetaPending: boolean;
  geocodePending: boolean;
  onEdit: () => void;
};

export function ProjectHomeSiteSection({
  mapCoords,
  isApproximateLocation,
  locationText,
  savedCoords,
  projectMetaPending,
  geocodePending,
  onEdit,
}: Props) {
  return (
    <section className="enterprise-card min-w-0 overflow-hidden p-0">
      <div className="flex flex-col gap-2 border-b border-[var(--enterprise-border)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">
            Site map & weather
          </h2>
          <p className="enterprise-type-caption mt-0.5">
            Live pin and conditions. Set an exact location in project settings.
          </p>
        </div>
        <EnterpriseButton type="button" size="sm" variant="secondary" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Edit location
        </EnterpriseButton>
      </div>

      <div className="p-3.5 sm:p-4">
        {mapCoords ? (
          <div className="space-y-3">
            {isApproximateLocation ? (
              <p className="enterprise-alert-warning rounded-md px-3 py-2 text-xs leading-snug">
                Approximate position from location text. Open{" "}
                <span className="font-semibold">Edit location</span> and click the map to save an
                exact pin.
              </p>
            ) : null}
            <div className="grid min-w-0 gap-3 lg:grid-cols-5">
              <div className="min-h-[200px] min-w-0 overflow-hidden rounded-md border border-[var(--enterprise-border)] lg:col-span-3">
                <ProjectLocationMap
                  height={220}
                  latitude={mapCoords.lat}
                  longitude={mapCoords.lng}
                  zoom={14}
                />
              </div>
              <div className="flex flex-col justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 p-3.5 lg:col-span-2">
                <ProjectWeatherAtLocation latitude={mapCoords.lat} longitude={mapCoords.lng} />
              </div>
            </div>
          </div>
        ) : (locationText && !savedCoords && projectMetaPending) || geocodePending ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-10 text-center">
            <div className="enterprise-skeleton h-3 w-40 rounded" />
            <p className="enterprise-type-caption">Loading map and weather…</p>
          </div>
        ) : locationText && !savedCoords && !geocodePending ? (
          <EmptyLocation
            message="We couldn't place that address on the map. Set a pin in Edit project, or try a clearer city or address."
            cta="Edit location"
            onEdit={onEdit}
          />
        ) : (
          <EmptyLocation
            message="Add a location name or click the map in Edit project to set a site pin — then the map and weather appear here."
            cta="Set location"
            onEdit={onEdit}
          />
        )}
      </div>
    </section>
  );
}

function EmptyLocation({
  message,
  cta,
  onEdit,
}: {
  message: string;
  cta: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/40 px-4 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-text-muted)]">
        <MapPin className="h-5 w-5" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="max-w-sm text-sm text-[var(--enterprise-text-muted)]">{message}</p>
      <button
        type="button"
        onClick={onEdit}
        className="text-sm font-semibold text-[var(--enterprise-primary)] hover:underline"
      >
        {cta}
      </button>
    </div>
  );
}
