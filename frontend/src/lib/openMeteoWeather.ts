/** Open-Meteo (https://open-meteo.com/) — free, no API key. */

export type OpenMeteoCurrentResponse = {
  current?: {
    time: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  current_units?: {
    temperature_2m?: string;
    relative_humidity_2m?: string;
    wind_speed_10m?: string;
  };
};

export function wmoWeatherLabel(code: number | undefined): string {
  if (code == null || Number.isNaN(code)) return "—";
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 86) return "Showers";
  if (code <= 99) return "Storm";
  return "—";
}

/** Maps WMO code to a visual bucket for icon + background (Open-Meteo WMO interpretation). */
export type WeatherVisualKind =
  | "clear"
  | "partlyCloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "freezingRain"
  | "snow"
  | "rainShowers"
  | "snowShowers"
  | "storm";

export function wmoWeatherVisualKind(code: number | undefined): WeatherVisualKind {
  if (code == null || Number.isNaN(code)) return "partlyCloudy";
  const c = code;
  if (c === 0) return "clear";
  if (c <= 2) return "partlyCloudy";
  if (c === 3) return "overcast";
  if (c <= 48) return "fog";
  if (c <= 57) return "drizzle";
  if (c <= 65) return "rain";
  if (c <= 67) return "freezingRain";
  if (c <= 77) return "snow";
  if (c <= 82) return "rainShowers";
  if (c <= 86) return "snowShowers";
  if (c <= 99) return "storm";
  return "partlyCloudy";
}

/** One emoji per visual bucket (system emoji rendering). */
export function wmoWeatherEmoji(code: number | undefined): string {
  const k = wmoWeatherVisualKind(code);
  const map: Record<WeatherVisualKind, string> = {
    clear: "☀️",
    partlyCloudy: "🌤️",
    overcast: "☁️",
    fog: "🌫️",
    drizzle: "🌦️",
    rain: "🌧️",
    freezingRain: "🌨️",
    snow: "❄️",
    rainShowers: "🌦️",
    snowShowers: "🌨️",
    storm: "⛈️",
  };
  return map[k];
}

export async function fetchOpenMeteoCurrent(
  latitude: number,
  longitude: number,
): Promise<OpenMeteoCurrentResponse> {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(latitude));
  u.searchParams.set("longitude", String(longitude));
  u.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m");
  u.searchParams.set("wind_speed_unit", "mph");
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error("Weather request failed");
  return res.json() as Promise<OpenMeteoCurrentResponse>;
}
