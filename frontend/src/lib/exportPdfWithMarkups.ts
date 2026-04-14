import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { MeasureUnit } from "@/lib/coords";
import type { TakeoffItem, TakeoffZone } from "@/lib/takeoffTypes";
import type { Annotation } from "@/store/viewerStore";
import { buildAnnotationsSvgDocument } from "@/lib/annotationsSvgExport";
import { buildTakeoffExportSvgDocument } from "@/lib/takeoffOverlaySvg";

/** Raster multiplier vs PDF points — favors legibility on exported markups/text. */
const EXPORT_RENDER_SCALE = 4;

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas export failed"));
          return;
        }
        void blob
          .arrayBuffer()
          .then((buf) => resolve(new Uint8Array(buf)))
          .catch(reject);
      },
      "image/png",
      0.92,
    );
  });
}

function svgDataUrlToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(svg);
    const url = `data:image/svg+xml;charset=utf-8,${encoded}`;
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not rasterize markup overlay"));
    img.src = url;
  });
}

async function renderPageToPngBytes(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  pageAnnotations: Annotation[],
  measureUnit: MeasureUnit,
  takeoffComposite?: {
    takeoffItems: TakeoffItem[];
    takeoffZones: TakeoffZone[];
    includeTakeoff: boolean;
  },
): Promise<{ pngBytes: Uint8Array; widthPt: number; heightPt: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: EXPORT_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  const task = page.render({
    canvasContext: ctx,
    viewport: vp,
    canvas,
  });
  await task.promise;

  const cssW = vp.width;
  const cssH = vp.height;
  const pageW = base.width;
  const pageH = base.height;
  const scale = EXPORT_RENDER_SCALE;
  const arrowId = `m-${pageNumber}-${Math.random().toString(36).slice(2, 9)}`;
  const svg = buildAnnotationsSvgDocument(
    pageAnnotations,
    cssW,
    cssH,
    pageW,
    pageH,
    scale,
    measureUnit,
    arrowId,
  );
  if (pageAnnotations.length > 0) {
    const img = await svgDataUrlToImage(svg);
    ctx.drawImage(img, 0, 0, cssW, cssH);
  }

  const pageIdx0 = pageNumber - 1;
  if (takeoffComposite?.includeTakeoff && takeoffComposite.takeoffZones.length > 0) {
    const itemsById = new Map(takeoffComposite.takeoffItems.map((i) => [i.id, i]));
    const takeSvg = buildTakeoffExportSvgDocument(
      takeoffComposite.takeoffZones,
      itemsById,
      pageIdx0,
      cssW,
      cssH,
    );
    if (takeSvg) {
      const timg = await svgDataUrlToImage(takeSvg);
      ctx.drawImage(timg, 0, 0, cssW, cssH);
    }
  }

  const pngBytes = await canvasToPngBytes(canvas);
  return { pngBytes, widthPt: base.width, heightPt: base.height };
}

export type ExportPdfProgress = { done: number; total: number };

export async function exportPdfWithMarkups(options: {
  pdfDoc: PDFDocumentProxy;
  annotations: Annotation[];
  measureUnit: MeasureUnit;
  /** 1-based page numbers, unique, sorted */
  pageNumbers: number[];
  fileNameBase: string;
  onProgress?: (p: ExportPdfProgress) => void;
  takeoffItems?: TakeoffItem[];
  takeoffZones?: TakeoffZone[];
  /** When true, composites takeoff zones onto each exported page (Pro takeoff data). */
  includeTakeoff?: boolean;
}): Promise<void> {
  const {
    pdfDoc,
    annotations,
    measureUnit,
    pageNumbers,
    fileNameBase,
    onProgress,
    takeoffItems = [],
    takeoffZones = [],
    includeTakeoff = false,
  } = options;
  const takeoffComposite =
    includeTakeoff && takeoffZones.length > 0
      ? { takeoffItems, takeoffZones, includeTakeoff: true as const }
      : undefined;
  const out = await PDFDocument.create();
  const total = pageNumbers.length;
  let done = 0;
  for (const pn of pageNumbers) {
    const pageIdx0 = pn - 1;
    const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIdx0);
    const { pngBytes, widthPt, heightPt } = await renderPageToPngBytes(
      pdfDoc,
      pn,
      pageAnnotations,
      measureUnit,
      takeoffComposite,
    );
    const pngImage = await out.embedPng(pngBytes);
    const page = out.addPage([widthPt, heightPt]);
    page.drawImage(pngImage, { x: 0, y: 0, width: widthPt, height: heightPt });
    done += 1;
    onProgress?.({ done, total });
  }
  const bytes = await out.save();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const base = fileNameBase.replace(/\.pdf$/i, "") || "sheet";
  a.download = `${base}-marked.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export type PageListMode = "all" | "current" | "custom";

export function resolveExportPageNumbers(
  mode: PageListMode,
  numPages: number,
  currentPage: number,
  customRaw: string,
): { ok: true; pages: number[] } | { ok: false; error: string } {
  if (numPages < 1) return { ok: false, error: "No pages in document." };
  if (mode === "all") {
    return { ok: true, pages: Array.from({ length: numPages }, (_, i) => i + 1) };
  }
  if (mode === "current") {
    const p = Math.min(numPages, Math.max(1, currentPage));
    return { ok: true, pages: [p] };
  }
  const parts = customRaw.split(/[,;\s]+/).filter(Boolean);
  const set = new Set<number>();
  for (const p of parts) {
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let i = lo; i <= hi; i++) {
        if (i < 1 || i > numPages) {
          return { ok: false, error: `Page ${i} is out of range (1–${numPages}).` };
        }
        set.add(i);
      }
    } else {
      const n = parseInt(p, 10);
      if (Number.isNaN(n)) {
        return { ok: false, error: `Invalid page: "${p}"` };
      }
      if (n < 1 || n > numPages) {
        return { ok: false, error: `Page ${n} is out of range (1–${numPages}).` };
      }
      set.add(n);
    }
  }
  if (set.size === 0) {
    return { ok: false, error: "Enter page numbers or ranges (e.g. 1,3,5-7)." };
  }
  return { ok: true, pages: [...set].sort((a, b) => a - b) };
}
