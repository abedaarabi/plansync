import { z } from "zod";

/** Normalized point 0–1 on the page image (full-page capture). */
export const normPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const sheetAiMimeSchema = z.enum(["image/png", "image/jpeg"]);

/** Max decoded image size (bytes). */
export const SHEET_AI_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const viewerSnapshotSchema = z.record(z.unknown()).optional();

export const sheetAiContextBundleSchema = z.object({
  pageIndex: z.number().int().min(0).max(10_000),
  /** Raw base64 without data URL prefix */
  imageBase64: z.string().min(16).max(12_000_000),
  mimeType: sheetAiMimeSchema,
  viewerSnapshot: viewerSnapshotSchema,
  pdfTextSnippet: z.string().max(120_000).optional(),
});

export type SheetAiContextBundle = z.infer<typeof sheetAiContextBundleSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "model"]),
  content: z.string().max(24_000),
});

export const sheetSummaryBodySchema = sheetAiContextBundleSchema;

export const sheetChatBodySchema = sheetAiContextBundleSchema.extend({
  messages: z.array(chatMessageSchema).min(1).max(48),
});

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function assertImageSizeOk(
  imageBase64: string,
): { ok: true } | { ok: false; error: string } {
  const len = imageBase64.length;
  const approxBytes = Math.floor((len * 3) / 4);
  if (approxBytes > SHEET_AI_MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image too large (max 8 MiB decoded)" };
  }
  return { ok: true };
}

export const sheetAiTocKindSchema = z.enum([
  "area",
  "detail",
  "note",
  "schedule",
  "title_block",
  "legend",
  "mep",
  "envelope",
  "structure",
  "other",
]);

const tocEntryRawSchema = z.object({
  title: z.string().min(1).max(200),
  /** Short quote or paraphrase of what is readable in that region (detail key, note line, spec ref). */
  snippet: z.string().max(500).optional(),
  kind: sheetAiTocKindSchema.optional(),
  pageIndex: z.number().int().min(0).max(10_000),
  minX: z.number().finite(),
  minY: z.number().finite(),
  maxX: z.number().finite(),
  maxY: z.number().finite(),
});

const readingRowRawSchema = z.object({
  /** Short label: wall type, equipment tag, detail key, note heading, etc. */
  element: z.string().min(1).max(200),
  /** What was read: dimensions, layers, spec line, visible text — be concrete. */
  detail: z.string().max(800),
  kind: sheetAiTocKindSchema.optional(),
});

/** One page’s persisted Sheet AI payload (`FileVersion.sheetAiCache.byPage`). */
export const sheetAiPageCacheEntrySchema = z.object({
  summaryMarkdown: z.string().max(100_000),
  readingsTable: z.array(readingRowRawSchema).max(50),
  tableOfContents: z.array(tocEntryRawSchema).max(45),
  chatMessages: z.array(chatMessageSchema).max(48).optional(),
  updatedAt: z.string().max(64),
});

export type SheetAiPageCacheEntry = z.infer<typeof sheetAiPageCacheEntrySchema>;

/** Parsed model output for sheet summary + clickable TOC regions. */
export const sheetSummaryResultSchema = z.object({
  /** Short overview only (discipline, sheet intent, caveats). Put itemized reads in readingsTable. */
  summaryMarkdown: z.string().max(80_000),
  /** Row per readable element on the sheet (for UI table). */
  readingsTable: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(readingRowRawSchema).max(45),
  ),
  tableOfContents: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(tocEntryRawSchema).max(40),
  ),
});

export type SheetAiTocKind = z.infer<typeof sheetAiTocKindSchema>;

export type SheetSummaryTocEntry = {
  title: string;
  snippet?: string;
  kind?: SheetAiTocKind;
  pageIndex: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type SheetSummaryReadingRow = {
  element: string;
  detail: string;
  kind?: SheetAiTocKind;
};

/** Only expand boxes that are unrealistically tiny (click target), not full detail callouts. */
const TOC_MIN_CLICK_SPAN = 0.014;

function ensureMinSpan1D(min: number, max: number): { min: number; max: number } {
  let a = clamp01(min);
  let b = clamp01(max);
  if (b < a) [a, b] = [b, a];
  const span = b - a;
  if (span >= TOC_MIN_CLICK_SPAN) return { min: a, max: b };
  const mid = (a + b) / 2;
  const half = TOC_MIN_CLICK_SPAN / 2;
  return {
    min: clamp01(mid - half),
    max: clamp01(mid + half),
  };
}

export function sanitizeSheetSummaryResult(
  parsed: z.infer<typeof sheetSummaryResultSchema>,
  expectedPageIndex0: number,
): {
  summaryMarkdown: string;
  readingsTable: SheetSummaryReadingRow[];
  tableOfContents: SheetSummaryTocEntry[];
} {
  const summaryMarkdown = parsed.summaryMarkdown.trim();
  const readingsTable: SheetSummaryReadingRow[] = parsed.readingsTable
    .map((r) => {
      const element = r.element.trim().slice(0, 200);
      const detail = r.detail.trim().slice(0, 800);
      const kindParsed = sheetAiTocKindSchema.safeParse(r.kind);
      if (!element) return null;
      return {
        element,
        detail,
        ...(kindParsed.success ? { kind: kindParsed.data } : {}),
      };
    })
    .filter((x): x is SheetSummaryReadingRow => x != null);

  const toc = parsed.tableOfContents
    .map((e) => {
      let minX = clamp01(e.minX);
      let minY = clamp01(e.minY);
      let maxX = clamp01(e.maxX);
      let maxY = clamp01(e.maxY);
      if (maxX < minX) [minX, maxX] = [maxX, minX];
      if (maxY < minY) [minY, maxY] = [maxY, minY];
      const xR = ensureMinSpan1D(minX, maxX);
      const yR = ensureMinSpan1D(minY, maxY);
      const snippet = e.snippet?.trim().slice(0, 500);
      const kindParsed = sheetAiTocKindSchema.safeParse(e.kind);
      return {
        title: e.title.trim().slice(0, 200),
        ...(snippet ? { snippet } : {}),
        ...(kindParsed.success ? { kind: kindParsed.data } : {}),
        pageIndex: expectedPageIndex0,
        minX: xR.min,
        minY: yR.min,
        maxX: xR.max,
        maxY: yR.max,
      };
    })
    .filter((e) => e.title.length > 0);
  return { summaryMarkdown, readingsTable, tableOfContents: toc };
}
