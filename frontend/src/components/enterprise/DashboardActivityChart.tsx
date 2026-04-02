"use client";

import { useMemo } from "react";

type Point = { date: string; count: number };

type Props = {
  data: Point[];
  className?: string;
};

function formatDay(isoDate: string): string {
  try {
    const d = new Date(isoDate + "T12:00:00Z");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

export function DashboardActivityChart({ data, className = "" }: Props) {
  const { lineD, avgD, areaD, points, w, h, pad } = useMemo(() => {
    const w = 520;
    const h = 168;
    const pad = { l: 36, r: 14, t: 20, b: 34 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const n = Math.max(1, data.length - 1);
    const avg = rolling7Avg(data);
    const maxC = Math.max(1, ...data.map((d) => d.count), ...avg);

    const points = data.map((d, i) => {
      const x = pad.l + (i / n) * innerW;
      const y = pad.t + innerH - (d.count / maxC) * innerH;
      return { x, y, ...d };
    });

    const avgPoints = avg.map((v, i) => {
      const x = pad.l + (i / n) * innerW;
      const y = pad.t + innerH - (v / maxC) * innerH;
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

    return { lineD, avgD, areaD, points, w, h, pad };
  }, [data]);

  if (!data.length) {
    return (
      <div
        className={`flex h-44 items-center justify-center rounded-lg border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-sm text-[var(--enterprise-text-muted)] ${className}`}
      >
        No activity in the last 14 days yet.
      </div>
    );
  }

  const labelIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="max-h-[200px] h-auto w-full text-[var(--enterprise-primary)]"
        role="img"
        aria-label="14-day workspace activity chart"
      >
        <defs>
          <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(37 99 235)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="rgb(37 99 235)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dash-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(96 165 250)" />
            <stop offset="100%" stopColor="rgb(37 99 235)" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t) => {
          const y = pad.t + (1 - t) * (h - pad.t - pad.b);
          return (
            <line
              key={t}
              x1={pad.l}
              y1={y}
              x2={w - pad.r}
              y2={y}
              stroke="var(--enterprise-border)"
              strokeWidth="1"
              strokeOpacity={t === 1 ? 0.4 : 0.18}
            />
          );
        })}

        <path d={areaD} fill="url(#dash-area)" />

        <path
          d={lineD}
          fill="none"
          stroke="url(#dash-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d={avgD}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth="2"
          strokeDasharray="6 5"
          strokeLinecap="round"
          opacity={0.9}
        />

        {points.map((p) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r="3.5"
            fill="var(--enterprise-surface)"
            stroke="rgb(37 99 235)"
            strokeWidth="2"
          />
        ))}

        {labelIdx.map((i) => {
          const x = points[i]?.x ?? pad.l;
          return (
            <text
              key={data[i].date}
              x={x}
              y={h - 8}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              fill="var(--enterprise-text-muted)"
              style={{ fontSize: "10px" }}
            >
              {formatDay(data[i].date)}
            </text>
          );
        })}

        <text x={pad.l} y={14} fill="var(--enterprise-text-muted)" style={{ fontSize: "10px" }}>
          Daily events (blue) · 7-day average (green)
        </text>
      </svg>
    </div>
  );
}
