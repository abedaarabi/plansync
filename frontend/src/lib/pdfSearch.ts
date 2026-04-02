import type { PDFDocumentProxy } from "pdfjs-dist";
import { Util } from "pdfjs-dist";

/** Minimal text item shape from {@link PDFPageProxy.getTextContent}. */
type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

export type SearchHit = {
  pageNumber: number;
  snippet: string;
  /**
   * Match region in normalized page coordinates (0–1), top-left origin,
   * same basis as {@link scrollViewportToNorm} in viewScroll.ts.
   */
  rectNorm: { x: number; y: number; w: number; h: number };
};

const MAX_PAGES = 400;
const SNIPPET_LEN = 120;
/** Minimum normalized size so zoom doesn’t explode on tiny glyphs */
const MIN_NORM = 0.06;

function unionRect(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
) {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Text item bounds in viewport space (scale 1), top-left origin. */
function itemViewportBounds(
  item: PdfTextItem,
  viewportTransform: number[],
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const m = Util.transform(viewportTransform, item.transform);
  const w = item.width;
  const h = item.height || Math.max(Math.abs(m[3]), 1e-6);
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [tx, ty] of corners) {
    const x = m[0] * tx + m[2] * ty + m[4];
    const y = m[1] * tx + m[3] * ty + m[5];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function toNormRect(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  vpW: number,
  vpH: number,
): { x: number; y: number; w: number; h: number } {
  const x = bounds.minX / vpW;
  const y = bounds.minY / vpH;
  let w = (bounds.maxX - bounds.minX) / vpW;
  let h = (bounds.maxY - bounds.minY) / vpH;
  w = Math.max(w, MIN_NORM);
  h = Math.max(h, MIN_NORM);
  return {
    x: Math.min(1 - w, Math.max(0, x)),
    y: Math.min(1 - h, Math.max(0, y)),
    w: Math.min(1, w),
    h: Math.min(1, h),
  };
}

/** Case-insensitive substring search across visible text; includes bounds per hit. */
export async function searchPdfText(
  doc: PDFDocumentProxy,
  query: string,
  maxResults = 80,
): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];
  const n = Math.min(doc.numPages, MAX_PAGES);

  for (let p = 1; p <= n && hits.length < maxResults; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const vt = viewport.transform;

    const textItems: PdfTextItem[] = [];
    for (const raw of tc.items) {
      if (!("str" in raw) || typeof (raw as PdfTextItem).str !== "string") continue;
      textItems.push(raw as PdfTextItem);
    }

    let fullText = "";
    const ranges: { start: number; end: number; itemIndex: number }[] = [];
    for (let i = 0; i < textItems.length; i++) {
      const item = textItems[i];
      const start = fullText.length;
      fullText += item.str;
      const end = fullText.length;
      ranges.push({ start, end, itemIndex: i });
      if (i < textItems.length - 1) fullText += " ";
    }

    const lower = fullText.toLowerCase();
    let idx = 0;
    while (idx < lower.length && hits.length < maxResults) {
      const found = lower.indexOf(q, idx);
      if (found === -1) break;
      const matchEnd = found + q.length;
      const start = Math.max(0, found - 24);
      const slice = fullText.slice(start, start + SNIPPET_LEN);

      let union: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
      for (const r of ranges) {
        if (r.end <= found || r.start >= matchEnd) continue;
        const b = itemViewportBounds(textItems[r.itemIndex], vt);
        union = union ? unionRect(union, b) : b;
      }

      const rectNorm = union
        ? toNormRect(union, viewport.width, viewport.height)
        : {
            x: 0.25,
            y: 0.25,
            w: 0.5,
            h: 0.5,
          };

      hits.push({
        pageNumber: p,
        snippet: slice.trim(),
        rectNorm,
      });
      idx = found + q.length;
    }
  }

  return hits;
}
