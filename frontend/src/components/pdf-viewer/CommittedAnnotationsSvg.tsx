"use client";

import type { ReactNode } from "react";
import { formatAngleDeg, formatAreaMm2, formatLengthMm, type MeasureUnit } from "@/lib/coords";
import { highlightStrokeWidthPx } from "@/lib/highlightStroke";
import { cloudRectPathD } from "@/lib/cloudPath";
import { dimensionPixelGeometry } from "@/lib/measureGeometry";
import { polygonCentroidNorm } from "@/lib/measureCompute";
import type { Annotation } from "@/store/viewerStore";
import { SheetLinkPin } from "@/components/pdf-viewer/sheetLinkPins";
import { textBoxLayoutPx, textBoxRectFillAttrs } from "@/lib/annotationResize";
import { computeRotationCenterPx } from "@/lib/annotationRotation";

const MEASURE_LABEL_CLASS = "font-mono";

/** Sheet AI lines are often thin in model output — keep them readable and easier to see at zoom. */
function markupStrokeWidthPx(a: Pick<Annotation, "strokeWidth" | "fromSheetAi">): number {
  if (!a.fromSheetAi) return a.strokeWidth;
  return Math.max(2.25, Math.min(8, a.strokeWidth));
}

function RotatedMarkupG({
  a,
  cssW,
  cssH,
  pageW,
  pageH,
  scale,
  children,
}: {
  a: Annotation;
  cssW: number;
  cssH: number;
  pageW: number;
  pageH: number;
  scale: number;
  children: ReactNode;
}) {
  const deg = a.rotationDeg ?? 0;
  if (deg === 0) return <g>{children}</g>;
  const c = computeRotationCenterPx(a, cssW, cssH, pageW, pageH, scale);
  if (!c) return <g>{children}</g>;
  return <g transform={`rotate(${deg} ${c.cx} ${c.cy})`}>{children}</g>;
}

function measureLabelStyle(a: Annotation) {
  return {
    fontSize: a.fontSize ?? 11,
    fill: a.textColor ?? "#3b82f6",
  };
}

function MeasurementDimensionSvg({
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
}: {
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
}) {
  const g = dimensionPixelGeometry(p1n, p2n, offsetPdf, pageW, pageH, scale);
  if (!g) return null;
  const labelPad = 10;
  const tx = g.mid.x + g.perpX * labelPad;
  const ty = g.mid.y + g.perpY * labelPad;
  const lf = labelFontSize ?? 11;
  const lfill = labelFill ?? "#3b82f6";
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
      <circle cx={g.p1.x} cy={g.p1.y} r={3} fill={color} />
      <circle cx={g.p2.x} cy={g.p2.y} r={3} fill={color} />
      <text
        x={tx}
        y={ty}
        fill={lfill}
        fontSize={lf}
        stroke="rgba(255,255,255,0.88)"
        strokeWidth={0.35}
        paintOrder="stroke fill"
        className={MEASURE_LABEL_CLASS}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {formatLengthMm(mm, measureUnit)}
      </text>
    </g>
  );
}

type Props = {
  annotations: Annotation[];
  cssW: number;
  cssH: number;
  pageW: number;
  pageH: number;
  /** PDF viewport scale used for this SVG (screen zoom or fixed print scale). */
  scale: number;
  measureUnit: MeasureUnit;
  arrowMarkerId: string;
};

/** Saved markups only (no drafts, selection, or snap overlays). */
export function CommittedAnnotationsSvg({
  annotations,
  cssW,
  cssH,
  pageW,
  pageH,
  scale,
  measureUnit,
  arrowMarkerId,
}: Props) {
  const markerUrl = `url(#${arrowMarkerId})`;
  const pinShadowId = `${arrowMarkerId}-issue-pin`;
  const pinShadowFilterUrl = `url(#${pinShadowId})`;

  return (
    <>
      <defs>
        <marker
          id={arrowMarkerId}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
        </marker>
        <filter id={pinShadowId} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow
            dx="0"
            dy="1.25"
            stdDeviation="0.9"
            floodColor="#0f172a"
            floodOpacity="0.22"
          />
        </filter>
      </defs>
      {annotations.map((a) => {
        if (a.points.length < 1) return null;
        const pts = a.points.map((p) => ({
          x: p.x * cssW,
          y: p.y * cssH,
        }));
        if (a.type === "polyline" && a.points.length >= 2) {
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          const sw = markupStrokeWidthPx(a);
          return (
            <RotatedMarkupG
              key={a.id}
              a={a}
              cssW={cssW}
              cssH={cssH}
              pageW={pageW}
              pageH={pageH}
              scale={scale}
            >
              {a.fromSheetAi ? (
                <path
                  d={d}
                  fill="none"
                  stroke={a.color}
                  strokeOpacity={0.22}
                  strokeWidth={sw + 3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <path
                d={d}
                fill="none"
                stroke={a.color}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect={a.fromSheetAi ? "non-scaling-stroke" : undefined}
              />
            </RotatedMarkupG>
          );
        }
        if (a.type === "highlight" && a.points.length >= 2) {
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          const hiSw = a.fromSheetAi
            ? Math.max(highlightStrokeWidthPx(markupStrokeWidthPx(a)), 10)
            : highlightStrokeWidthPx(a.strokeWidth);
          return (
            <RotatedMarkupG
              key={a.id}
              a={a}
              cssW={cssW}
              cssH={cssH}
              pageW={pageW}
              pageH={pageH}
              scale={scale}
            >
              <path
                d={d}
                fill="none"
                stroke={a.color}
                strokeWidth={hiSw}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={a.fromSheetAi ? 0.35 : 0.4}
                vectorEffect={a.fromSheetAi ? "non-scaling-stroke" : undefined}
              />
            </RotatedMarkupG>
          );
        }
        if (a.type === "line" && a.points.length === 2) {
          const [p1, p2] = pts;
          const lw = markupStrokeWidthPx(a);
          return (
            <RotatedMarkupG
              key={a.id}
              a={a}
              cssW={cssW}
              cssH={cssH}
              pageW={pageW}
              pageH={pageH}
              scale={scale}
            >
              <g style={a.arrowHead ? { color: a.color } : undefined}>
                {a.fromSheetAi ? (
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={a.color}
                    strokeOpacity={0.2}
                    strokeWidth={lw + 4}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={a.color}
                  strokeWidth={lw}
                  strokeLinecap="round"
                  markerEnd={a.arrowHead ? markerUrl : undefined}
                  vectorEffect={a.fromSheetAi ? "non-scaling-stroke" : undefined}
                />
              </g>
            </RotatedMarkupG>
          );
        }
        if (a.type === "rect" && a.points.length === 2) {
          const [p1, p2] = pts;
          const x = Math.min(p1.x, p2.x);
          const y = Math.min(p1.y, p2.y);
          const w = Math.abs(p2.x - p1.x);
          const h = Math.abs(p2.y - p1.y);
          const pin =
            Boolean(a.linkedIssueId) ||
            Boolean(a.issueDraft) ||
            Boolean(a.linkedOmAssetId) ||
            Boolean(a.omAssetDraft);
          if (pin) {
            const cx = x + w / 2;
            const cy = y + h / 2;
            return (
              <RotatedMarkupG
                key={a.id}
                a={a}
                cssW={cssW}
                cssH={cssH}
                pageW={pageW}
                pageH={pageH}
                scale={scale}
              >
                <SheetLinkPin
                  annotation={a}
                  cx={cx}
                  cy={cy}
                  cssW={cssW}
                  cssH={cssH}
                  pinShadowFilterUrl={pinShadowFilterUrl}
                />
              </RotatedMarkupG>
            );
          }
          return (
            <RotatedMarkupG
              key={a.id}
              a={a}
              cssW={cssW}
              cssH={cssH}
              pageW={pageW}
              pageH={pageH}
              scale={scale}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="none"
                stroke={a.color}
                strokeWidth={a.strokeWidth}
              />
            </RotatedMarkupG>
          );
        }
        if (a.type === "cloud" && a.points.length === 2) {
          const [p1, p2] = pts;
          const x = Math.min(p1.x, p2.x);
          const y = Math.min(p1.y, p2.y);
          const mx = Math.max(p1.x, p2.x);
          const my = Math.max(p1.y, p2.y);
          const d = cloudRectPathD(x, y, mx, my);
          if (!d) return null;
          const pinC =
            Boolean(a.linkedIssueId) ||
            Boolean(a.issueDraft) ||
            Boolean(a.linkedOmAssetId) ||
            Boolean(a.omAssetDraft);
          if (pinC) {
            const cx = (x + mx) / 2;
            const cy = (y + my) / 2;
            return (
              <RotatedMarkupG
                key={a.id}
                a={a}
                cssW={cssW}
                cssH={cssH}
                pageW={pageW}
                pageH={pageH}
                scale={scale}
              >
                <SheetLinkPin
                  annotation={a}
                  cx={cx}
                  cy={cy}
                  cssW={cssW}
                  cssH={cssH}
                  pinShadowFilterUrl={pinShadowFilterUrl}
                />
              </RotatedMarkupG>
            );
          }
          return (
            <RotatedMarkupG
              key={a.id}
              a={a}
              cssW={cssW}
              cssH={cssH}
              pageW={pageW}
              pageH={pageH}
              scale={scale}
            >
              <path
                d={d}
                fill="none"
                stroke={a.color}
                strokeWidth={a.strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </RotatedMarkupG>
          );
        }
        if (a.type === "ellipse" && a.points.length === 2) {
          const [p1, p2] = pts;
          const x = Math.min(p1.x, p2.x);
          const y = Math.min(p1.y, p2.y);
          const w = Math.abs(p2.x - p1.x);
          const h = Math.abs(p2.y - p1.y);
          const rx = w / 2;
          const ry = h / 2;
          const pin =
            Boolean(a.linkedIssueId) ||
            Boolean(a.issueDraft) ||
            Boolean(a.linkedOmAssetId) ||
            Boolean(a.omAssetDraft);
          if (pin) {
            const cx = x + rx;
            const cy = y + ry;
            return (
              <RotatedMarkupG
                key={a.id}
                a={a}
                cssW={cssW}
                cssH={cssH}
                pageW={pageW}
                pageH={pageH}
                scale={scale}
              >
                <SheetLinkPin
                  annotation={a}
                  cx={cx}
                  cy={cy}
                  cssW={cssW}
                  cssH={cssH}
                  pinShadowFilterUrl={pinShadowFilterUrl}
                />
              </RotatedMarkupG>
            );
          }
          return (
            <RotatedMarkupG
              key={a.id}
              a={a}
              cssW={cssW}
              cssH={cssH}
              pageW={pageW}
              pageH={pageH}
              scale={scale}
            >
              <ellipse
                cx={x + rx}
                cy={y + ry}
                rx={rx}
                ry={ry}
                fill="none"
                stroke={a.color}
                strokeWidth={a.strokeWidth}
              />
            </RotatedMarkupG>
          );
        }
        if (a.type === "cross" && a.points.length === 2) {
          const [p1, p2] = pts;
          const x1 = Math.min(p1.x, p2.x);
          const y1 = Math.min(p1.y, p2.y);
          const x2 = Math.max(p1.x, p2.x);
          const y2 = Math.max(p1.y, p2.y);
          return (
            <RotatedMarkupG
              key={a.id}
              a={a}
              cssW={cssW}
              cssH={cssH}
              pageW={pageW}
              pageH={pageH}
              scale={scale}
            >
              <g>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={a.color}
                  strokeWidth={a.strokeWidth}
                />
                <line
                  x1={x1}
                  y1={y2}
                  x2={x2}
                  y2={y1}
                  stroke={a.color}
                  strokeWidth={a.strokeWidth}
                />
              </g>
            </RotatedMarkupG>
          );
        }
        if (a.type === "diamond" && a.points.length >= 4) {
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          return (
            <RotatedMarkupG
              key={a.id}
              a={a}
              cssW={cssW}
              cssH={cssH}
              pageW={pageW}
              pageH={pageH}
              scale={scale}
            >
              <path
                d={d}
                fill="none"
                stroke={a.color}
                strokeWidth={a.strokeWidth}
                strokeLinejoin="round"
              />
            </RotatedMarkupG>
          );
        }
        if (a.type === "polygon" && a.points.length >= 3) {
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          const psw = markupStrokeWidthPx(a);
          return (
            <RotatedMarkupG
              key={a.id}
              a={a}
              cssW={cssW}
              cssH={cssH}
              pageW={pageW}
              pageH={pageH}
              scale={scale}
            >
              {a.fromSheetAi ? (
                <path
                  d={d}
                  fill="none"
                  stroke={a.color}
                  strokeOpacity={0.18}
                  strokeWidth={psw + 3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <path
                d={d}
                fill="none"
                stroke={a.color}
                strokeWidth={psw}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect={a.fromSheetAi ? "non-scaling-stroke" : undefined}
              />
            </RotatedMarkupG>
          );
        }
        if (a.type === "text" && a.points.length >= 1 && (a.text ?? "").length > 0) {
          const t = textBoxLayoutPx(a, cssW, cssH);
          const lines = a.text!.split("\n");
          const x0 = t.px - t.pad;
          const y0 = t.py - t.pad;
          const boxFill = textBoxRectFillAttrs(a);
          return (
            <RotatedMarkupG
              key={a.id}
              a={a}
              cssW={cssW}
              cssH={cssH}
              pageW={pageW}
              pageH={pageH}
              scale={scale}
            >
              <g>
                <rect
                  x={x0}
                  y={y0}
                  width={t.boxW}
                  height={t.boxH}
                  rx={4}
                  fill={boxFill.fill}
                  fillOpacity={boxFill.fillOpacity}
                  stroke={a.color}
                  strokeWidth={a.strokeWidth}
                />
                <text
                  x={t.px}
                  y={t.py + Math.round(t.fontSize * 0.28)}
                  fill={a.textColor ?? "#0f172a"}
                  fontSize={t.fontSize}
                  className="font-sans"
                  dominantBaseline="hanging"
                >
                  {lines.map((line, i) => (
                    <tspan key={i} x={t.px} dy={i === 0 ? 0 : t.lh}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            </RotatedMarkupG>
          );
        }
        if (a.type === "measurement") {
          const mk = a.measurementKind ?? "line";
          const col = a.color;
          const sw = a.strokeWidth;
          const dimLabel = measureLabelStyle(a);
          if (mk === "line" && a.points.length === 2) {
            const [p1n, p2n] = a.points;
            const mm = a.lengthMm ?? 0;
            return (
              <MeasurementDimensionSvg
                key={a.id}
                p1n={p1n}
                p2n={p2n}
                offsetPdf={a.dimensionOffsetPdf ?? 0}
                pageW={pageW}
                pageH={pageH}
                scale={scale}
                color={col}
                strokeWidth={sw}
                mm={mm}
                measureUnit={measureUnit}
                labelFontSize={dimLabel.fontSize}
                labelFill={dimLabel.fill}
              />
            );
          }
          if (mk === "area" && a.points.length >= 3) {
            const pts = a.points.map((p) => ({ x: p.x * cssW, y: p.y * cssH }));
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
            const c = polygonCentroidNorm(a.points);
            const mm2 = a.areaMm2 ?? 0;
            return (
              <g key={a.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={col}
                  strokeWidth={sw}
                  strokeLinejoin="round"
                  opacity={0.92}
                />
                <text
                  x={c.x * cssW}
                  y={c.y * cssH}
                  fill={dimLabel.fill}
                  fontSize={dimLabel.fontSize}
                  stroke="rgba(255,255,255,0.88)"
                  strokeWidth={0.35}
                  paintOrder="stroke fill"
                  className={MEASURE_LABEL_CLASS}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {formatAreaMm2(mm2, measureUnit)}
                </text>
              </g>
            );
          }
          if (mk === "angle" && a.points.length === 3) {
            const [v, p1, p2] = a.points;
            const vx = v.x * cssW;
            const vy = v.y * cssH;
            const x1 = p1.x * cssW;
            const y1 = p1.y * cssH;
            const x2 = p2.x * cssW;
            const y2 = p2.y * cssH;
            const deg = a.angleDeg ?? 0;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const tx = vx + (mx - vx) * 0.35;
            const ty = vy + (my - vy) * 0.35;
            return (
              <g key={a.id}>
                <line
                  x1={vx}
                  y1={vy}
                  x2={x1}
                  y2={y1}
                  stroke={col}
                  strokeWidth={sw}
                  opacity={0.92}
                />
                <line
                  x1={vx}
                  y1={vy}
                  x2={x2}
                  y2={y2}
                  stroke={col}
                  strokeWidth={sw}
                  opacity={0.92}
                />
                <circle cx={vx} cy={vy} r={2.5} fill={col} />
                <text
                  x={tx}
                  y={ty}
                  fill={dimLabel.fill}
                  fontSize={dimLabel.fontSize}
                  stroke="rgba(255,255,255,0.88)"
                  strokeWidth={0.35}
                  paintOrder="stroke fill"
                  className={MEASURE_LABEL_CLASS}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {formatAngleDeg(deg)}
                </text>
              </g>
            );
          }
          if (mk === "perimeter" && a.points.length >= 2) {
            const pts = a.points.map((p) => ({ x: p.x * cssW, y: p.y * cssH }));
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
            const p0 = a.points[0];
            const p1 = a.points[1];
            const lx = ((p0.x + p1.x) / 2) * cssW;
            const ly = ((p0.y + p1.y) / 2) * cssH;
            const mm = a.lengthMm ?? 0;
            return (
              <g key={a.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={col}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.92}
                />
                <text
                  x={lx}
                  y={ly}
                  fill={dimLabel.fill}
                  fontSize={dimLabel.fontSize}
                  stroke="rgba(255,255,255,0.88)"
                  strokeWidth={0.35}
                  paintOrder="stroke fill"
                  className={MEASURE_LABEL_CLASS}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {formatLengthMm(mm, measureUnit)}
                </text>
              </g>
            );
          }
        }
        return null;
      })}
    </>
  );
}
