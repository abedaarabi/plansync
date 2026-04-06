"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchOpenMeteoCurrent,
  wmoWeatherEmoji,
  wmoWeatherLabel,
  wmoWeatherVisualKind,
  type WeatherVisualKind,
} from "@/lib/openMeteoWeather";

type Props = { latitude: number; longitude: number };

/** Atmospheric mesh + accent for glass card (modern “weather UI” look). */
const SCENE: Record<WeatherVisualKind, { mesh: string; glow: string; accent: string }> = {
  clear: {
    mesh: "from-amber-300/40 via-orange-200/25 to-sky-200/30",
    glow: "bg-amber-400/25",
    accent: "text-amber-600",
  },
  partlyCloudy: {
    mesh: "from-sky-300/35 via-sky-100/25 to-indigo-100/25",
    glow: "bg-sky-400/20",
    accent: "text-sky-700",
  },
  overcast: {
    mesh: "from-slate-300/35 via-slate-200/20 to-zinc-200/25",
    glow: "bg-slate-400/15",
    accent: "text-slate-700",
  },
  fog: {
    mesh: "from-slate-300/30 via-slate-200/15 to-slate-100/20",
    glow: "bg-slate-400/15",
    accent: "text-slate-600",
  },
  drizzle: {
    mesh: "from-sky-400/30 via-blue-200/20 to-cyan-100/20",
    glow: "bg-sky-400/20",
    accent: "text-sky-700",
  },
  rain: {
    mesh: "from-blue-500/25 via-indigo-300/20 to-slate-200/20",
    glow: "bg-blue-500/20",
    accent: "text-blue-700",
  },
  freezingRain: {
    mesh: "from-cyan-400/25 via-slate-100/20 to-sky-200/20",
    glow: "bg-cyan-400/20",
    accent: "text-cyan-800",
  },
  snow: {
    mesh: "from-sky-200/40 via-slate-100/30 to-white/30",
    glow: "bg-sky-300/25",
    accent: "text-sky-800",
  },
  rainShowers: {
    mesh: "from-blue-400/30 via-sky-200/25 to-amber-100/15",
    glow: "bg-blue-400/20",
    accent: "text-blue-700",
  },
  snowShowers: {
    mesh: "from-sky-300/35 via-slate-200/25 to-white/20",
    glow: "bg-sky-300/20",
    accent: "text-sky-800",
  },
  storm: {
    mesh: "from-indigo-400/30 via-violet-300/20 to-indigo-200/25",
    glow: "bg-indigo-400/20",
    accent: "text-indigo-800",
  },
};

export function ProjectWeatherAtLocation({ latitude, longitude }: Props) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["openMeteoCurrent", latitude, longitude],
    queryFn: () => fetchOpenMeteoCurrent(latitude, longitude),
    staleTime: 10 * 60 * 1000,
  });

  const cur = data?.current;
  if (isPending) {
    return (
      <div
        className="animate-pulse rounded-3xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-6"
        aria-hidden
      >
        <div className="h-4 w-24 rounded-full bg-slate-200/90" />
        <div className="mt-4 h-14 w-40 rounded-2xl bg-slate-200/70" />
        <div className="mt-6 h-px w-full bg-[var(--enterprise-border)]" />
        <div className="mt-4 flex gap-6">
          <div className="h-4 w-20 rounded-full bg-slate-200/90" />
          <div className="h-4 w-20 rounded-full bg-slate-200/90" />
        </div>
      </div>
    );
  }
  if (isError || !cur) {
    return (
      <p className="text-sm text-[var(--enterprise-text-muted)]">Weather unavailable right now.</p>
    );
  }

  const temp = cur.temperature_2m;
  const tempUnit = data?.current_units?.temperature_2m ?? "°C";
  const code = cur.weather_code;
  const hum = cur.relative_humidity_2m;
  const wind = cur.wind_speed_10m;
  const windUnit = data?.current_units?.wind_speed_10m ?? "mph";

  const kind = wmoWeatherVisualKind(code);
  const scene = SCENE[kind];
  const emoji = wmoWeatherEmoji(code);
  const label = wmoWeatherLabel(code);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/90 shadow-[var(--enterprise-shadow-sm)] backdrop-blur-md">
      <div
        className={`pointer-events-none absolute -right-6 -top-10 h-44 w-44 rounded-full bg-gradient-to-br ${scene.mesh} blur-3xl`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full ${scene.glow} blur-3xl`}
        aria-hidden
      />
      <div className="relative p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${scene.accent}`}>
              Now
            </p>
            <h3 className="mt-1 text-[15px] font-semibold leading-snug tracking-tight text-[var(--enterprise-text)]">
              {label}
            </h3>
            <p
              className="mt-3 flex items-baseline gap-2 text-5xl font-extralight tracking-tighter text-[var(--enterprise-text)] tabular-nums"
              aria-label={
                typeof temp === "number"
                  ? `Temperature ${Math.round(temp)}${tempUnit.startsWith("°") ? tempUnit : ` ${tempUnit}`}`
                  : undefined
              }
            >
              {typeof temp === "number" ? (
                <>
                  <span>{Math.round(temp)}</span>
                  <span className="text-2xl font-light text-[var(--enterprise-text-muted)]">
                    {tempUnit.startsWith("°") ? tempUnit : ` ${tempUnit}`}
                  </span>
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div
            className="select-none text-6xl leading-none drop-shadow-sm sm:text-7xl"
            role="img"
            aria-label={label}
          >
            {emoji}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-[var(--enterprise-border)] pt-5 text-sm">
          {typeof hum === "number" ? (
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--enterprise-text-muted)]">
                Humidity
              </p>
              <p className="mt-0.5 font-semibold tabular-nums text-[var(--enterprise-text)]">
                {Math.round(hum)}%
              </p>
            </div>
          ) : null}
          {typeof wind === "number" ? (
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--enterprise-text-muted)]">
                Wind
              </p>
              <p className="mt-0.5 font-semibold tabular-nums text-[var(--enterprise-text)]">
                {Math.round(wind)} {windUnit}
              </p>
            </div>
          ) : null}
        </div>

        <p className="mt-5 text-[11px] text-[var(--enterprise-text-muted)]">
          Data via{" "}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--enterprise-primary)] underline underline-offset-2 transition hover:text-[var(--enterprise-primary-deep)]"
          >
            Open-Meteo
          </a>
        </p>
      </div>
    </div>
  );
}
