/**
 * Standalone SVG markup for committed annotations (matches CommittedAnnotationsSvg).
 * Used for PDF export raster composite — no React.
 */
import { formatAngleDeg, formatAreaMm2, formatLengthMm, type MeasureUnit } from "@/lib/coords";
import { highlightStrokeWidthPx } from "@/lib/highlightStroke";
import { polygonCentroidNorm } from "@/lib/measureCompute";
import { cloudRectPathD } from "@/lib/cloudPath";
import { dimensionPixelGeometry } from "@/lib/measureGeometry";
import type { Annotation } from "@/store/viewerStore";
import { textBoxLayoutPx, textBoxRectFillAttrs } from "@/lib/annotationResize";
import { computeRotationCenterPx } from "@/lib/annotationRotation";

function wrapSvgRotation(
  a: Annotation,
  cssW: number,
  cssH: number,
  pageW: number,
  pageH: number,
  scale: number,
  inner: string,
): string {
  const deg = a.rotationDeg ?? 0;
  if (deg === 0 || a.type === "measurement") return inner;
  const c = computeRotationCenterPx(a, cssW, cssH, pageW, pageH, scale);
  if (!c) return inner;
  return `<g transform="rotate(${deg} ${c.cx} ${c.cy})">${inner}</g>`;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function measureLabelAttrs(a: Annotation) {
  return {
    fontSize: a.fontSize ?? 11,
    fill: a.textColor ?? "#3b82f6",
  };
}

function measurementDimensionXml(
  p1n: { x: number; y: number },
  p2n: { x: number; y: number },
  offsetPdf: number,
  pageW: number,
  pageH: number,
  scale: number,
  color: string,
  strokeWidth: number,
  mm: number,
  measureUnit: MeasureUnit,
  _arrowMarkerId: string,
  labelFontSize: number,
  labelFill: string,
): string {
  const g = dimensionPixelGeometry(p1n, p2n, offsetPdf, pageW, pageH, scale);
  if (!g) return "";
  const labelPad = 10;
  const tx = g.mid.x + g.perpX * labelPad;
  const ty = g.mid.y + g.perpY * labelPad;
  const label = escapeXml(formatLengthMm(mm, measureUnit));
  return `<g>
<line x1="${g.p1.x}" y1="${g.p1.y}" x2="${g.d1.x}" y2="${g.d1.y}" stroke="${color}" stroke-width="1" stroke-dasharray="4 3" opacity="0.85"/>
<line x1="${g.p2.x}" y1="${g.p2.y}" x2="${g.d2.x}" y2="${g.d2.y}" stroke="${color}" stroke-width="1" stroke-dasharray="4 3" opacity="0.85"/>
<line x1="${g.d1.x}" y1="${g.d1.y}" x2="${g.d2.x}" y2="${g.d2.y}" stroke="${color}" stroke-width="${strokeWidth}"/>
<circle cx="${g.p1.x}" cy="${g.p1.y}" r="3" fill="${color}"/>
<circle cx="${g.p2.x}" cy="${g.p2.y}" r="3" fill="${color}"/>
<text x="${tx}" y="${ty}" fill="${labelFill}" font-size="${labelFontSize}" stroke="rgba(255,255,255,0.88)" stroke-width="0.35" paint-order="stroke fill" font-family="ui-monospace, monospace" text-anchor="middle" dominant-baseline="middle">${label}</text>
</g>`;
}

/**
 * Full SVG document (with xmlns) for overlaying PDF canvas at export resolution.
 */
export function buildAnnotationsSvgDocument(
  annotations: Annotation[],
  cssW: number,
  cssH: number,
  pageW: number,
  pageH: number,
  scale: number,
  measureUnit: MeasureUnit,
  arrowMarkerId: string,
): string {
  const defs = `<defs>
<marker id="${arrowMarkerId}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
<polygon points="0 0, 10 3.5, 0 7" fill="currentColor"/>
</marker>
</defs>`;

  const parts: string[] = [];
  for (const a of annotations) {
    if (a.points.length < 1) continue;
    const pts = a.points.map((p) => ({
      x: p.x * cssW,
      y: p.y * cssH,
    }));

    if (a.type === "polyline" && a.points.length >= 2) {
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      parts.push(
        wrapSvgRotation(
          a,
          cssW,
          cssH,
          pageW,
          pageH,
          scale,
          `<path d="${d}" fill="none" stroke="${a.color}" stroke-width="${a.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
        ),
      );
    } else if (a.type === "highlight" && a.points.length >= 2) {
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      const hw = highlightStrokeWidthPx(a.strokeWidth);
      parts.push(
        wrapSvgRotation(
          a,
          cssW,
          cssH,
          pageW,
          pageH,
          scale,
          `<path d="${d}" fill="none" stroke="${a.color}" stroke-width="${hw}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.4"/>`,
        ),
      );
    } else if (a.type === "line" && a.points.length === 2) {
      const [p1, p2] = pts;
      const marker = a.arrowHead ? ` marker-end="url(#${arrowMarkerId})"` : "";
      const style = a.arrowHead ? ` style="color:${a.color}"` : "";
      parts.push(
        wrapSvgRotation(
          a,
          cssW,
          cssH,
          pageW,
          pageH,
          scale,
          `<g${style}><line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${a.color}" stroke-width="${a.strokeWidth}"${marker}/></g>`,
        ),
      );
    } else if (a.type === "rect" && a.points.length === 2) {
      const [p1, p2] = pts;
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      parts.push(
        wrapSvgRotation(
          a,
          cssW,
          cssH,
          pageW,
          pageH,
          scale,
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${a.color}" stroke-width="${a.strokeWidth}"/>`,
        ),
      );
    } else if (a.type === "cloud" && a.points.length === 2) {
      const [p1, p2] = pts;
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const mx = Math.max(p1.x, p2.x);
      const my = Math.max(p1.y, p2.y);
      const d = cloudRectPathD(x, y, mx, my);
      if (d) {
        parts.push(
          wrapSvgRotation(
            a,
            cssW,
            cssH,
            pageW,
            pageH,
            scale,
            `<path d="${d}" fill="none" stroke="${a.color}" stroke-width="${a.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>`,
          ),
        );
      }
    } else if (a.type === "ellipse" && a.points.length === 2) {
      const [p1, p2] = pts;
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      const rx = w / 2;
      const ry = h / 2;
      parts.push(
        wrapSvgRotation(
          a,
          cssW,
          cssH,
          pageW,
          pageH,
          scale,
          `<ellipse cx="${x + rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" fill="none" stroke="${a.color}" stroke-width="${a.strokeWidth}"/>`,
        ),
      );
    } else if (a.type === "cross" && a.points.length === 2) {
      const [p1, p2] = pts;
      const x1 = Math.min(p1.x, p2.x);
      const y1 = Math.min(p1.y, p2.y);
      const x2 = Math.max(p1.x, p2.x);
      const y2 = Math.max(p1.y, p2.y);
      parts.push(
        wrapSvgRotation(
          a,
          cssW,
          cssH,
          pageW,
          pageH,
          scale,
          `<g><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${a.color}" stroke-width="${a.strokeWidth}"/><line x1="${x1}" y1="${y2}" x2="${x2}" y2="${y1}" stroke="${a.color}" stroke-width="${a.strokeWidth}"/></g>`,
        ),
      );
    } else if (a.type === "diamond" && a.points.length >= 4) {
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
      parts.push(
        wrapSvgRotation(
          a,
          cssW,
          cssH,
          pageW,
          pageH,
          scale,
          `<path d="${d}" fill="none" stroke="${a.color}" stroke-width="${a.strokeWidth}" stroke-linejoin="round"/>`,
        ),
      );
    } else if (a.type === "polygon" && a.points.length >= 3) {
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
      parts.push(
        wrapSvgRotation(
          a,
          cssW,
          cssH,
          pageW,
          pageH,
          scale,
          `<path d="${d}" fill="none" stroke="${a.color}" stroke-width="${a.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>`,
        ),
      );
    } else if (a.type === "text" && a.points.length >= 1 && (a.text ?? "").length > 0) {
      const t = textBoxLayoutPx(a, cssW, cssH);
      const lines = a.text!.split("\n");
      const x0 = t.px - t.pad;
      const y0 = t.py - t.pad;
      const textColor = a.textColor ?? "#0f172a";
      const boxFill = textBoxRectFillAttrs(a);
      const tspans = lines
        .map(
          (line, i) => `<tspan x="${t.px}" dy="${i === 0 ? 0 : t.lh}">${escapeXml(line)}</tspan>`,
        )
        .join("");
      parts.push(
        wrapSvgRotation(
          a,
          cssW,
          cssH,
          pageW,
          pageH,
          scale,
          `<g>
<rect x="${x0}" y="${y0}" width="${t.boxW}" height="${t.boxH}" rx="4" fill="${boxFill.fill}" fill-opacity="${boxFill.fillOpacity}" stroke="${a.color}" stroke-width="${a.strokeWidth}"/>
<text x="${t.px}" y="${t.py + Math.round(t.fontSize * 0.28)}" fill="${textColor}" font-size="${t.fontSize}" font-family="ui-sans-serif, system-ui, sans-serif" dominant-baseline="hanging">${tspans}</text>
</g>`,
        ),
      );
    } else if (a.type === "measurement") {
      const mk = a.measurementKind ?? "line";
      const col = a.color;
      const sw = a.strokeWidth;
      const dim = measureLabelAttrs(a);
      if (mk === "line" && a.points.length === 2) {
        const [p1n, p2n] = a.points;
        const mm = a.lengthMm ?? 0;
        parts.push(
          measurementDimensionXml(
            p1n,
            p2n,
            a.dimensionOffsetPdf ?? 0,
            pageW,
            pageH,
            scale,
            col,
            sw,
            mm,
            measureUnit,
            arrowMarkerId,
            dim.fontSize,
            dim.fill,
          ),
        );
      } else if (mk === "area" && a.points.length >= 3) {
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
        const c = polygonCentroidNorm(a.points);
        const mm2 = a.areaMm2 ?? 0;
        const lab = escapeXml(formatAreaMm2(mm2, measureUnit));
        parts.push(
          `<g><path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round" opacity="0.92"/>
<text x="${c.x * cssW}" y="${c.y * cssH}" fill="${dim.fill}" font-size="${dim.fontSize}" stroke="rgba(255,255,255,0.88)" stroke-width="0.35" paint-order="stroke fill" font-family="ui-monospace, monospace" text-anchor="middle" dominant-baseline="middle">${lab}</text></g>`,
        );
      } else if (mk === "angle" && a.points.length === 3) {
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
        const lab = escapeXml(formatAngleDeg(deg));
        parts.push(
          `<g><line x1="${vx}" y1="${vy}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${sw}" opacity="0.92"/>
<line x1="${vx}" y1="${vy}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}" opacity="0.92"/>
<circle cx="${vx}" cy="${vy}" r="2.5" fill="${col}"/>
<text x="${tx}" y="${ty}" fill="${dim.fill}" font-size="${dim.fontSize}" stroke="rgba(255,255,255,0.88)" stroke-width="0.35" paint-order="stroke fill" font-family="ui-monospace, monospace" text-anchor="middle" dominant-baseline="middle">${lab}</text></g>`,
        );
      } else if (mk === "perimeter" && a.points.length >= 2) {
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        const p0 = a.points[0];
        const p1 = a.points[1];
        const lx = ((p0.x + p1.x) / 2) * cssW;
        const ly = ((p0.y + p1.y) / 2) * cssH;
        const mm = a.lengthMm ?? 0;
        const lab = escapeXml(formatLengthMm(mm, measureUnit));
        parts.push(
          `<g><path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>
<text x="${lx}" y="${ly}" fill="${dim.fill}" font-size="${dim.fontSize}" stroke="rgba(255,255,255,0.88)" stroke-width="0.35" paint-order="stroke fill" font-family="ui-monospace, monospace" text-anchor="middle" dominant-baseline="middle">${lab}</text></g>`,
        );
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cssW}" height="${cssH}" viewBox="0 0 ${cssW} ${cssH}">${defs}${parts.join("")}</svg>`;
}
