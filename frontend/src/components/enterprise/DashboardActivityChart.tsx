"use client";

import { useCallback, useId, useMemo, useState } from "react";

type Point = { date: string; count: number };

type Props = {
  data: Point[];
  className?: string;
  /** Defaults to workspace-oriented copy when omitted. */
  ariaLabel?: string;
  /** Shown in legend; omit to use default caption. */
  caption?: string;
  /** Shorter chart and tighter chrome (e.g. project dashboard beside overview). */
  compact?: boolean;
  /** Grow to fill a flex parent (chart area stretches vertically). */
  fillHeight?: boolean;
};

function formatDay(isoDate: string): string {
  try {
    const d = new Date(isoDate + "T12:00:00Z");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return isoDate;
  }
}

function formatDayLong(isoDate: string): string {
  try {
    const d = new Date(isoDate + "T12:00:00Z");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function rolling7Avg(data: Point[]): number[] {
  return data.map((_, i) => {
    const from = Math.max(0, i - 6);
    const slice = data.slice(from, i + 1);
    return slice.reduce((a, x) => a + x.count, 0) / slice.length;
  });
}

function axisCeiling(dataMax: number, avgMax: number): number {
  const raw = Math.max(1, dataMax, avgMax);
  const padded = raw + Math.max(1, raw * 0.1);
  const c = Math.ceil(padded);
  return Math.max(4, c);
}

export function DashboardActivityChart({
  data,
  className = "",
  ariaLabel = "14-day workspace activity chart",
  caption,
  compact = false,
  fillHeight = false,
}: Props) {
  const gradId = useId().replace(/:/g, "");
  const [hovered, setHovered] = useState<number | null>(null);

  const legendDaily =
    caption ?? "Daily events use your workspace primary color; the dashed line is a 7-day average.";

  const stats = useMemo(() => {
    if (!data.length) return null;
    const total = data.reduce((a, x) => a + x.count, 0);
    let peak = data[0]!;
    for (const x of data) {
      if (x.count > peak.count) peak = x;
    }
    const mid = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, mid).reduce((a, x) => a + x.count, 0);
    const secondHalf = data.slice(mid).reduce((a, x) => a + x.count, 0);
    const delta = secondHalf - firstHalf;
    return { total, peak, delta };
  }, [data]);

  const { lineD, avgD, areaD, points, avg, axisMax, yTicks, w, h, pad, innerW, innerH, labelIdx } =
    useMemo(() => {
      const w = 560;
      const h = compact ? 128 : 196;
      const pad = compact ? { l: 32, r: 8, t: 6, b: 26 } : { l: 40, r: 12, t: 16, b: 40 };
      const innerW = w - pad.l - pad.r;
      const innerH = h - pad.t - pad.b;
      const n = Math.max(1, data.length - 1);
      const avg = rolling7Avg(data);
      const dataMax = Math.max(0, ...data.map((d) => d.count));
      const avgMax = Math.max(0, ...avg);
      const axisMax = axisCeiling(dataMax, avgMax);

      const points = data.map((d, i) => {
        const x = pad.l + (i / n) * innerW;
        const y = pad.t + innerH - (d.count / axisMax) * innerH;
        return { x, y, ...d };
      });

      const avgPoints = avg.map((v, i) => {
        const x = pad.l + (i / n) * innerW;
        const y = pad.t + innerH - (v / axisMax) * innerH;
        return { x, y, v };
      });

      const lineD = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");
      const avgD = avgPoints
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");

      const areaD =
        points.length > 0
          ? `M ${points[0].x} ${pad.t + innerH} ` +
            points.map((p) => `L ${p.x} ${p.y}`).join(" ") +
            ` L ${points[points.length - 1].x} ${pad.t + innerH} Z`
          : "";

      const yTicks = [0, 0.5, 1].map((t) => ({
        key: String(t),
        t,
        value: Math.round(axisMax * (1 - t)),
        y: pad.t + t * innerH,
      }));

      const labelIdx =
        data.length <= 7
          ? data.map((_, i) => i)
          : [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
              (v, i, a) => a.indexOf(v) === i,
            );

      return {
        lineD,
        avgD,
        areaD,
        points,
        avg,
        axisMax,
        yTicks,
        w,
        h,
        pad,
        innerW,
        innerH,
        labelIdx,
      };
    }, [data, compact]);

  const clearHover = useCallback(() => setHovered(null), []);

  if (!data.length) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-4 text-center ${fillHeight ? "min-h-0 flex-1 py-6" : compact ? "min-h-36 py-8" : "min-h-44 py-8"} ${className}`}
      >
        <p className="text-sm font-medium text-[var(--enterprise-text)]">No activity yet</p>
        <p className="max-w-sm text-[13px] leading-relaxed text-[var(--enterprise-text-muted)]">
          Uploads, issues, invites, and other workspace events will appear here for the last 14
          days.
        </p>
      </div>
    );
  }

  const hi = hovered != null && data[hovered] ? hovered : null;
  const hiPoint = hi != null ? points[hi] : null;
  const hiAvg = hi != null ? avg[hi] : null;

  const outerLayout = fillHeight
    ? `flex h-full min-h-0 flex-1 flex-col ${compact ? "gap-2" : "gap-3"}`
    : compact
      ? "space-y-2"
      : "space-y-3";

  return (
    <div className={`${outerLayout} ${className}`.trim()}>
      {stats ? (
        <div
          className={`flex flex-wrap gap-x-6 gap-y-2 text-[var(--enterprise-text-muted)] ${fillHeight ? "shrink-0" : ""} ${compact ? "gap-x-4 text-[12px] leading-snug" : "text-[13px]"}`}
        >
          <span>
            <span className="font-semibold tabular-nums text-[var(--enterprise-text)]">
              {stats.total}
            </span>{" "}
            events (14 days)
          </span>
          <span>
            Busiest:{" "}
            <span className="font-semibold text-[var(--enterprise-text)]">
              {formatDay(stats.peak.date)}
            </span>{" "}
            <span className="tabular-nums">({stats.peak.count})</span>
          </span>
          {data.length > 3 ? (
            <span>
              vs first half:{" "}
              <span
                className={`font-semibold tabular-nums ${
                  stats.delta > 0
                    ? "text-[var(--enterprise-success)]"
                    : stats.delta < 0
                      ? "text-[var(--enterprise-text-muted)]"
                      : "text-[var(--enterprise-text)]"
                }`}
              >
                {stats.delta > 0 ? "+" : ""}
                {stats.delta}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className={`relative w-full ${fillHeight ? "min-h-0 flex-1" : ""}`}
        onPointerLeave={clearHover}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) clearHover();
        }}
      >
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          className={
            fillHeight
              ? "h-full min-h-[7rem] w-full touch-manipulation"
              : `h-auto w-full touch-manipulation ${compact ? "max-h-[148px]" : "max-h-[220px]"}`
          }
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>
          <defs>
            <linearGradient id={`${gradId}-dash-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--enterprise-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--enterprise-primary)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${gradId}-dash-line`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--enterprise-primary)" stopOpacity="0.75" />
              <stop offset="100%" stopColor="var(--enterprise-primary)" stopOpacity="1" />
            </linearGradient>
          </defs>

          {yTicks.map(({ key, t, value, y }) => (
            <g key={key}>
              <line
                x1={pad.l}
                y1={y}
                x2={w - pad.r}
                y2={y}
                stroke="var(--enterprise-border)"
                strokeWidth="1"
                strokeOpacity={t === 1 ? 0.45 : 0.14}
              />
              <text
                x={pad.l - 8}
                y={y + 4}
                textAnchor="end"
                fill="var(--enterprise-text-muted)"
                style={{
                  fontSize: compact ? "9px" : "10px",
                  fontVariantNumeric: "tabular-nums",
                }}
                pointerEvents="none"
              >
                {value}
              </text>
            </g>
          ))}

          <path d={areaD} fill={`url(#${gradId}-dash-area)`} pointerEvents="none" />

          <path
            d={lineD}
            fill="none"
            stroke={`url(#${gradId}-dash-line)`}
            strokeWidth={compact ? "2" : "2.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />

          <path
            d={avgD}
            fill="none"
            stroke="var(--enterprise-success)"
            strokeWidth={compact ? "1.5" : "2"}
            strokeDasharray="6 5"
            strokeLinecap="round"
            opacity={0.92}
            pointerEvents="none"
          />

          {hi != null && hiPoint ? (
            <line
              x1={hiPoint.x}
              y1={pad.t}
              x2={hiPoint.x}
              y2={pad.t + innerH}
              stroke="var(--enterprise-primary)"
              strokeWidth="1"
              strokeOpacity={0.35}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          ) : null}

          {points.map((p, i) => (
            <circle
              key={p.date}
              cx={p.x}
              cy={p.y}
              r={compact ? (hi === i ? 4.25 : 2.75) : hi === i ? 5.5 : 3.5}
              fill="var(--enterprise-surface)"
              stroke="var(--enterprise-primary)"
              strokeWidth={compact ? (hi === i ? 2 : 1.5) : hi === i ? 2.5 : 2}
              pointerEvents="none"
              className="transition-[r,stroke-width] duration-150 ease-out"
            />
          ))}

          {labelIdx.map((i) => {
            const x = points[i]?.x ?? pad.l;
            return (
              <text
                key={data[i].date}
                x={x}
                y={compact ? h - 7 : h - 10}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                fill="var(--enterprise-text-muted)"
                style={{ fontSize: compact ? "9px" : "10px" }}
                pointerEvents="none"
              >
                {formatDay(data[i].date)}
              </text>
            );
          })}

          {/* Hit targets on top for hover / touch */}
          {data.map((d, i) => {
            const x0 = i === 0 ? pad.l : (points[i - 1].x + points[i].x) / 2;
            const x1 = i === data.length - 1 ? w - pad.r : (points[i].x + points[i + 1].x) / 2;
            return (
              <rect
                key={`hit-${d.date}`}
                x={x0}
                y={pad.t}
                width={Math.max(4, x1 - x0)}
                height={innerH + pad.b}
                fill="transparent"
                className="cursor-crosshair"
                onPointerEnter={() => setHovered(i)}
                onPointerDown={() => setHovered(i)}
              />
            );
          })}
        </svg>

        {hi != null && hiPoint && data[hi] != null && hiAvg != null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[9.5rem] rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 shadow-[var(--enterprise-shadow-md)]"
            style={{
              left: `${(hiPoint.x / w) * 100}%`,
              top: "4px",
              transform: "translateX(-50%)",
            }}
            role="status"
            aria-live="polite"
          >
            <p className="text-[11px] font-semibold text-[var(--enterprise-text)]">
              {formatDayLong(data[hi].date)}
            </p>
            <p className="mt-1 text-[12px] tabular-nums text-[var(--enterprise-text-muted)]">
              <span className="font-semibold text-[var(--enterprise-primary)]">
                {data[hi].count}
              </span>{" "}
              events
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-[var(--enterprise-text-muted)]">
              7-day avg:{" "}
              <span className="font-medium text-[var(--enterprise-success)]">
                {hiAvg.toFixed(1)}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      <div
        className={`flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--enterprise-border)]/70 text-[11px] text-[var(--enterprise-text-muted)] ${fillHeight ? "shrink-0" : ""} ${compact ? "gap-x-4 pt-2" : "pt-3"}`}
      >
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2 w-5 shrink-0 rounded-full bg-[var(--enterprise-primary)]"
            aria-hidden
          />
          Daily count
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-0.5 w-5 border-t-2 border-dashed border-[var(--enterprise-success)]"
            aria-hidden
          />
          7-day average
        </span>
        <span className="min-w-0 text-[10px] leading-snug opacity-90">{legendDaily}</span>
      </div>
    </div>
  );
}
