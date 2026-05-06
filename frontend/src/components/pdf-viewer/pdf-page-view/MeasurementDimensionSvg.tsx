import { formatLengthMm, type MeasureUnit } from "@/lib/coords";
import { dimensionPixelGeometry } from "@/lib/measureGeometry";

export type MeasurementDimensionSvgProps = {
  p1n: { x: number; y: number };
  p2n: { x: number; y: number };
  offsetPdf: number;
  pageW: number;
  pageH: number;
  scale: number;
  color: string;
  strokeWidth: number;
  mm: number;
  measureUnit: MeasureUnit;
  labelFontSize?: number;
  labelFill?: string;
  /** Only the dimension text — no extension lines (use with an existing chord overlay). */
  labelOnly?: boolean;
  /** Second line (e.g. calibration Δ vs target). */
  subtitle?: string | null;
};

/** Renders extension lines + dimension string for the measure tool (SVG overlay space). */
export function MeasurementDimensionSvg({
  p1n,
  p2n,
  offsetPdf,
  pageW,
  pageH,
  scale,
  color,
  strokeWidth: sw,
  mm,
  measureUnit,
  labelFontSize,
  labelFill,
  labelOnly,
  subtitle,
}: MeasurementDimensionSvgProps) {
  const g = dimensionPixelGeometry(p1n, p2n, offsetPdf, pageW, pageH, scale);
  if (!g) return null;
  const labelPad = 10;
  const tx = g.mid.x + g.perpX * labelPad;
  const ty = g.mid.y + g.perpY * labelPad;
  const lf = labelFontSize ?? 11;
  const lfill = labelFill ?? "#3b82f6";
  const label = formatLengthMm(mm, measureUnit);
  if (labelOnly) {
    const subFs = Math.max(8, lf - 1.5);
    return (
      <g>
        <text
          x={tx}
          y={ty}
          fill={lfill}
          fontSize={lf}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={0.35}
          paintOrder="stroke fill"
          className="font-mono"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label}
        </text>
        {subtitle ? (
          <text
            x={tx}
            y={ty + lf * 0.85 + subFs * 0.5}
            fill={lfill}
            fontSize={subFs}
            opacity={0.92}
            stroke="rgba(255,255,255,0.75)"
            strokeWidth={0.25}
            paintOrder="stroke fill"
            className="font-mono"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {subtitle}
          </text>
        ) : null}
      </g>
    );
  }
  return (
    <g>
      <line
        x1={g.p1.x}
        y1={g.p1.y}
        x2={g.d1.x}
        y2={g.d1.y}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="2 4"
        strokeLinecap="round"
        opacity={0.88}
      />
      <line
        x1={g.p2.x}
        y1={g.p2.y}
        x2={g.d2.x}
        y2={g.d2.y}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="2 4"
        strokeLinecap="round"
        opacity={0.88}
      />
      <line x1={g.d1.x} y1={g.d1.y} x2={g.d2.x} y2={g.d2.y} stroke={color} strokeWidth={sw} />
      <circle cx={g.p1.x} cy={g.p1.y} r={3.5} fill={color} />
      <circle cx={g.p2.x} cy={g.p2.y} r={3.5} fill={color} />
      <text
        x={tx}
        y={ty}
        fill={lfill}
        fontSize={lf}
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={0.35}
        paintOrder="stroke fill"
        className="font-mono"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {label}
      </text>
    </g>
  );
}
