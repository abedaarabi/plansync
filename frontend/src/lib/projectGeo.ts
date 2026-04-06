/** Parse persisted WGS84 coords from API (number or occasional string). */
export function parseCoord(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parseProjectCoords(
  project:
    | {
        latitude?: unknown;
        longitude?: unknown;
      }
    | null
    | undefined,
): { lat: number; lng: number } | null {
  if (!project) return null;
  const lat = parseCoord(project.latitude);
  const lng = parseCoord(project.longitude);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}
