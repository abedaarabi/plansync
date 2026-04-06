"use client";

import { useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function MapClickLayer({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export type ProjectLocationMapInnerProps = {
  latitude: number;
  longitude: number;
  zoom?: number;
  height: number;
  className?: string;
  /** When false, no pin is drawn (e.g. before the user picks a location). */
  showMarker?: boolean;
  /** When set, map clicks move the pin (edit mode). */
  onPick?: (lat: number, lng: number) => void;
};

export function ProjectLocationMapInner({
  latitude,
  longitude,
  zoom = 14,
  height,
  className,
  showMarker = true,
  onPick,
}: ProjectLocationMapInnerProps) {
  const center = useMemo(() => [latitude, longitude] as [number, number], [latitude, longitude]);

  return (
    <MapContainer
      key={`${latitude.toFixed(5)}-${longitude.toFixed(5)}-${showMarker ? "1" : "0"}`}
      center={center}
      zoom={zoom}
      className={className}
      style={{ height, width: "100%" }}
      scrollWheelZoom={Boolean(onPick)}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onPick ? <MapClickLayer onPick={onPick} /> : null}
      {showMarker ? (
        <CircleMarker
          center={center}
          radius={9}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 1,
            weight: 2,
          }}
        />
      ) : null}
    </MapContainer>
  );
}
