/**
 * Open-Meteo geocoding (no API key). Used when the project has a location name
 * but no saved map pin — browser must be allowed to fetch this host (CORS).
 */
export async function geocodeLocationName(q: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;
  const u = new URL("https://geocoding-api.open-meteo.com/v1/search");
  u.searchParams.set("name", trimmed);
  u.searchParams.set("count", "1");
  u.searchParams.set("language", "en");
  const res = await fetch(u.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{ latitude: number; longitude: number }>;
  };
  const r = data.results?.[0];
  if (!r) return null;
  return { lat: r.latitude, lng: r.longitude };
}
