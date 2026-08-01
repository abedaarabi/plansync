import type { CanvasPoint } from "../CalibrationCanvas";

/** Numbered calibration point markers positioned by normalized (0–1) coords. */
export function PointMarkers({
  points,
  colors,
  /** Current pan/zoom or transform scale — markers counter-scale to stay screen-sized. */
  viewScale = 1,
}: {
  points: CanvasPoint[];
  colors: [string, string];
  viewScale?: number;
}) {
  const inv = viewScale > 0 ? 1 / viewScale : 1;

  return (
    <>
      {points.map((pt, i) => (
        <span
          key={i}
          className="pointer-events-none absolute z-20 flex h-5 w-5 items-center justify-center rounded-full border border-white text-[9px] font-bold leading-none text-white shadow-md ring-1 ring-black/20"
          style={{
            left: `${pt.x * 100}%`,
            top: `${pt.y * 100}%`,
            backgroundColor: colors[i] ?? colors[0],
            transform: `translate(-50%, -50%) scale(${inv})`,
          }}
        >
          {i + 1}
        </span>
      ))}
    </>
  );
}

export const PDF_MARKER_COLORS: [string, string] = ["#2563eb", "#dc2626"];
export const PLAN_MARKER_COLORS: [string, string] = ["#059669", "#d97706"];
