"use client";

import { mapNavigatorMetrics, MAP_NAV_COLORS } from "@/lib/bim/bimMapNavigator";

type Props = {
  norm: { x: number; y: number };
  headingRad: number;
  canvasWidth: number;
  canvasHeight: number;
  fovHalfRad?: number;
  interactive?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGElement>) => void;
};

export function BimMapNavigatorMarker({
  norm,
  headingRad,
  canvasWidth,
  canvasHeight,
  fovHalfRad = Math.PI / 5.5,
  interactive = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  const x = norm.x * canvasWidth;
  const y = norm.y * canvasHeight;
  const { centerR, beamLen } = mapNavigatorMetrics(canvasWidth, canvasHeight);
  const headingDeg = (headingRad * 180) / Math.PI;

  const beamPath = (() => {
    const x1 = -Math.sin(fovHalfRad) * beamLen;
    const y1 = -Math.cos(fovHalfRad) * beamLen;
    const x2 = Math.sin(fovHalfRad) * beamLen;
    const y2 = -Math.cos(fovHalfRad) * beamLen;
    return `M 0 0 L ${x1} ${y1} A ${beamLen} ${beamLen} 0 0 1 ${x2} ${y2} Z`;
  })();

  return (
    <svg
      className={`absolute left-0 top-0 h-full w-full overflow-visible ${interactive ? "pointer-events-auto touch-none" : "pointer-events-none"}`}
      aria-hidden={!interactive}
      aria-label={interactive ? "Map navigator — drag to move, drag ring to rotate" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <filter id="bim-nav-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="rgba(15,23,42,0.28)" />
        </filter>
        <linearGradient id="bim-nav-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(66,133,244,0.42)" />
          <stop offset="100%" stopColor="rgba(66,133,244,0.08)" />
        </linearGradient>
      </defs>
      <g transform={`translate(${x} ${y}) rotate(${headingDeg})`}>
        <path
          d={beamPath}
          fill="url(#bim-nav-beam)"
          stroke={MAP_NAV_COLORS.beamStroke}
          strokeWidth={1}
        />
        <circle
          r={centerR + 3}
          fill={MAP_NAV_COLORS.dotStroke}
          filter="url(#bim-nav-shadow)"
          className={interactive ? "cursor-grab active:cursor-grabbing" : undefined}
        />
        <circle
          r={centerR}
          fill={MAP_NAV_COLORS.dot}
          stroke={MAP_NAV_COLORS.dotStroke}
          strokeWidth={2.5}
        />
        <path
          d={`M 0 ${-centerR * 0.45} L ${centerR * 0.38} ${centerR * 0.42} L ${-centerR * 0.38} ${centerR * 0.42} Z`}
          fill={MAP_NAV_COLORS.dotStroke}
        />
        {interactive ? (
          <circle r={beamLen + 8} fill="transparent" className="cursor-crosshair" />
        ) : null}
      </g>
    </svg>
  );
}
