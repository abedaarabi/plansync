import { buildAnnotationsSvgDocument } from "@/lib/annotationsSvgExport";
import type { TakeoffItem, TakeoffZone } from "@/lib/takeoffTypes";
import type { Annotation, Calibration } from "@/store/viewerStore";
import type { MeasureUnit } from "@/lib/coords";
import { buildTakeoffExportSvgDocument } from "@/lib/takeoffOverlaySvg";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadMarkupJson(
  fileName: string,
  annotations: Annotation[],
  calibrationByPage: Record<number, Calibration>,
) {
  const base = fileName.replace(/\.pdf$/i, "") || "sheet";
  const payload = {
    exportedAt: new Date().toISOString(),
    annotations,
    calibrationByPage: Object.fromEntries(
      Object.entries(calibrationByPage).map(([k, v]) => [String(k), v]),
    ),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `${base}-markups.json`);
}

function svgDataUrlToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(svg);
    const url = `data:image/svg+xml;charset=utf-8,${encoded}`;
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG raster failed"));
    img.src = url;
  });
}

export type CanvasPngOverlayOptions = {
  pageAnnotations: Annotation[];
  pageW: number;
  pageH: number;
  measureUnit: MeasureUnit;
};

export type CanvasPngTakeoffOptions = {
  takeoffItems: TakeoffItem[];
  takeoffZones: TakeoffZone[];
  pageIndex0: number;
  includeTakeoff: boolean;
};

/**
 * Raster PNG of the PDF canvas plus committed markups and measures (same geometry as on screen).
 * Optional takeoff layer composites quantity zones when enabled.
 */
export async function downloadCanvasPng(
  canvas: HTMLCanvasElement | null,
  fileName: string,
  overlay?: CanvasPngOverlayOptions | null,
  takeoff?: CanvasPngTakeoffOptions | null,
): Promise<void> {
  if (!canvas || canvas.width < 2 || canvas.height < 2) return;
  const base = fileName.replace(/\.pdf$/i, "") || "sheet";

  const cssW = canvas.width;
  const cssH = canvas.height;

  const hasAnn = Boolean(
    overlay && overlay.pageAnnotations.length > 0 && overlay.pageW > 0 && overlay.pageH > 0,
  );

  const takeoffSvg =
    takeoff?.includeTakeoff && takeoff.takeoffZones.length > 0
      ? buildTakeoffExportSvgDocument(
          takeoff.takeoffZones,
          new Map(takeoff.takeoffItems.map((i) => [i.id, i])),
          takeoff.pageIndex0,
          cssW,
          cssH,
        )
      : "";
  const hasTakeoff = Boolean(takeoffSvg);

  if (!hasAnn && !hasTakeoff) {
    canvas.toBlob(
      (blob) => {
        if (blob) triggerDownload(blob, `${base}-page.png`);
      },
      "image/png",
      0.92,
    );
    return;
  }

  const pageAnnotations = overlay?.pageAnnotations ?? [];
  const pageW = overlay?.pageW ?? 0;
  const pageH = overlay?.pageH ?? 0;
  const measureUnit = overlay?.measureUnit ?? ("mm" as MeasureUnit);
  const scale = pageW > 0 ? cssW / pageW : 1;
  const arrowId = `png-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const svg =
    hasAnn && pageW > 0 && pageH > 0
      ? buildAnnotationsSvgDocument(
          pageAnnotations,
          cssW,
          cssH,
          pageW,
          pageH,
          scale,
          measureUnit,
          arrowId,
        )
      : "";

  try {
    const out = document.createElement("canvas");
    out.width = cssW;
    out.height = cssH;
    const ctx = out.getContext("2d");
    if (!ctx) {
      canvas.toBlob(
        (blob) => {
          if (blob) triggerDownload(blob, `${base}-page.png`);
        },
        "image/png",
        0.92,
      );
      return;
    }
    ctx.drawImage(canvas, 0, 0);
    if (hasAnn && svg) {
      const img = await svgDataUrlToImage(svg);
      ctx.drawImage(img, 0, 0, cssW, cssH);
    }
    if (hasTakeoff && takeoffSvg) {
      const timg = await svgDataUrlToImage(takeoffSvg);
      ctx.drawImage(timg, 0, 0, cssW, cssH);
    }
    out.toBlob(
      (blob) => {
        if (blob) triggerDownload(blob, `${base}-page.png`);
      },
      "image/png",
      0.92,
    );
  } catch {
    canvas.toBlob(
      (blob) => {
        if (blob) triggerDownload(blob, `${base}-page.png`);
      },
      "image/png",
      0.92,
    );
  }
}
