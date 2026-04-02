import type { TakeoffItem, TakeoffZone } from "@/lib/takeoffTypes";

/**
 * Builds a standalone SVG document for one page’s takeoff zones, for compositing onto
 * export canvases (PDF/PNG). Geometry matches on-sheet TakeoffZonesSvg (non-selected styling).
 */
export function buildTakeoffExportSvgDocument(
  zones: TakeoffZone[],
  itemsById: Map<string, TakeoffItem>,
  pageIndex0: number,
  cssW: number,
  cssH: number,
): string {
  const pageZones = zones.filter((z) => z.pageIndex === pageIndex0);
  if (pageZones.length === 0) return "";

  const chunks: string[] = [];
  for (const z of pageZones) {
    const item = itemsById.get(z.itemId);
    const stroke = item?.color ?? "#64748b";
    const fillHex = `${stroke}70`;
    const op = 0.44;

    if (z.measurementType === "area" && z.points.length >= 3) {
      const d =
        z.points
          .map((p, i) => {
            const x = p.x * cssW;
            const y = p.y * cssH;
            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
          })
          .join(" ") + " Z";
      chunks.push(
        `<path d="${d}" fill="${fillHex}" stroke="${stroke}" stroke-width="1.5" opacity="${op}" vector-effect="non-scaling-stroke"/>`,
      );
    } else if (z.measurementType === "linear" && z.points.length >= 2) {
      for (let i = 0; i < z.points.length - 1; i++) {
        const a = z.points[i];
        const b = z.points[i + 1];
        chunks.push(
          `<line x1="${a.x * cssW}" y1="${a.y * cssH}" x2="${b.x * cssW}" y2="${b.y * cssH}" stroke="${stroke}" stroke-width="2.5" opacity="0.95" vector-effect="non-scaling-stroke"/>`,
        );
      }
    } else if (z.measurementType === "count") {
      const cOp = 0.44;
      for (let idx = 0; idx < z.points.length; idx++) {
        const p = z.points[idx];
        const cx = p.x * cssW;
        const cy = p.y * cssH;
        chunks.push(
          `<g opacity="${cOp + 0.08}">` +
            `<circle cx="${cx}" cy="${cy}" r="9" fill="${stroke}" fill-opacity="0.52" stroke="${stroke}" stroke-width="2" vector-effect="non-scaling-stroke"/>` +
            `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="#0f172a" font-size="10" font-weight="700">${idx + 1}</text>` +
            `</g>`,
        );
      }
    }
  }

  if (chunks.length === 0) return "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cssW}" height="${cssH}" viewBox="0 0 ${cssW} ${cssH}">${chunks.join("")}</svg>`;
}
