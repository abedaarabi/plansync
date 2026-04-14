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

/** Takeoff Assist — countable drawing categories (vision estimates). */
export const takeoffAssistCategorySchema = z.enum(["windows", "doors", "walls", "rooms"]);
export type TakeoffAssistCategory = z.infer<typeof takeoffAssistCategorySchema>;

export const sheetTakeoffDetectBodySchema = sheetAiContextBundleSchema.extend({
  categories: z.array(takeoffAssistCategorySchema).min(1).max(4),
});

export type SheetTakeoffDetectBody = z.infer<typeof sheetTakeoffDetectBodySchema>;

const TAKEOFF_CATEGORY_ORDER = [
  "windows",
  "doors",
  "walls",
  "rooms",
] as const satisfies readonly TakeoffAssistCategory[];

/** Dedupe and stable-order categories from the request body. */
export function uniqueTakeoffCategoriesInOrder(
  cats: TakeoffAssistCategory[],
): TakeoffAssistCategory[] {
  const seen = new Set<string>();
  const out: TakeoffAssistCategory[] = [];
  for (const k of TAKEOFF_CATEGORY_ORDER) {
    if (cats.includes(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

const TAKEOFF_ASSIST_MAX_ITEMS = 80;
const TAKEOFF_ASSIST_MIN_CLICK_SPAN = 0.014;

function ensureMinSpanTakeoff1D(min: number, max: number): { min: number; max: number } {
  let a = clamp01(min);
  let b = clamp01(max);
  if (b < a) [a, b] = [b, a];
  const span = b - a;
  if (span >= TAKEOFF_ASSIST_MIN_CLICK_SPAN) return { min: a, max: b };
  const mid = (a + b) / 2;
  const half = TAKEOFF_ASSIST_MIN_CLICK_SPAN / 2;
  return {
    min: clamp01(mid - half),
    max: clamp01(mid + half),
  };
}

const takeoffAssistItemPersistSchema = z.object({
  category: takeoffAssistCategorySchema,
  pageIndex: z.number().int().min(0).max(10_000),
  minX: z.number().finite(),
  minY: z.number().finite(),
  maxX: z.number().finite(),
  maxY: z.number().finite(),
  label: z.string().max(120).optional(),
});

export const takeoffAssistCacheEntrySchema = z.object({
  categories: z.array(takeoffAssistCategorySchema).min(1).max(4),
  counts: z.object({
    windows: z.number().int().min(0).max(50_000).optional(),
    doors: z.number().int().min(0).max(50_000).optional(),
    walls: z.number().int().min(0).max(50_000).optional(),
    rooms: z.number().int().min(0).max(50_000).optional(),
  }),
  items: z.array(takeoffAssistItemPersistSchema).max(TAKEOFF_ASSIST_MAX_ITEMS),
});

export type TakeoffAssistCacheEntry = z.infer<typeof takeoffAssistCacheEntrySchema>;
export type TakeoffAssistItem = z.infer<typeof takeoffAssistItemPersistSchema>;

/** Raw model JSON for takeoff detect (before sanitize). */
const takeoffCategoryPreprocess = z.preprocess((v: unknown) => {
  const t = String(v ?? "")
    .toLowerCase()
    .trim();
  if (t === "window" || t === "win") return "windows";
  if (t === "door") return "doors";
  if (t === "wall") return "walls";
  if (t === "room" || t === "space" || t === "spaces") return "rooms";
  return t;
}, takeoffAssistCategorySchema);

export const takeoffAssistResultSchema = z.object({
  counts: z
    .object({
      windows: z.coerce.number().int().optional(),
      doors: z.coerce.number().int().optional(),
      walls: z.coerce.number().int().optional(),
      rooms: z.coerce.number().int().optional(),
    })
    .optional(),
  items: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z
      .array(
        z.object({
          category: takeoffCategoryPreprocess,
          pageIndex: z.coerce.number().int().min(0).max(10_000).optional(),
          minX: z.coerce.number().finite(),
          minY: z.coerce.number().finite(),
          maxX: z.coerce.number().finite(),
          maxY: z.coerce.number().finite(),
          label: z
            .union([z.string(), z.number(), z.boolean()])
            .optional()
            .transform((v) => {
              if (v === undefined || v === null) return undefined;
              const s = String(v).trim();
              return s.length === 0 ? undefined : s.slice(0, 120);
            }),
        }),
      )
      .max(120),
  ),
});

function asFiniteNumberLoose(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Map common model variants to our enum (Gemini often returns Title Case or synonyms). */
export function normalizeTakeoffCategoryLoose(v: unknown): TakeoffAssistCategory | null {
  const s = String(v ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  if (s === "window" || s === "windows" || s === "win" || s === "w") return "windows";
  if (s === "door" || s === "doors" || s === "d") return "doors";
  if (s === "wall" || s === "walls") return "walls";
  if (s === "room" || s === "rooms" || s === "space" || s === "spaces") return "rooms";
  const p = takeoffAssistCategorySchema.safeParse(s);
  return p.success ? p.data : null;
}

function extractItemsArrayLoose(obj: Record<string, unknown>): unknown[] {
  const keys = [
    "items",
    "detections",
    "boxes",
    "regions",
    "objects",
    "annotations",
    "data",
    "results",
    "elements",
  ] as const;
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

/**
 * When strict Zod fails (wrong key names, stringy numbers, alternate category strings),
 * still recover whatever rows we can so takeoff is not stuck at zero.
 */
export function parseTakeoffAssistResultLoose(
  raw: unknown,
): z.infer<typeof takeoffAssistResultSchema> | null {
  let obj: Record<string, unknown> | null = null;
  let rows: unknown[] | null = null;

  if (Array.isArray(raw)) {
    rows = raw;
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
    rows = extractItemsArrayLoose(obj);
  } else {
    return null;
  }

  type ItemRow = z.infer<typeof takeoffAssistResultSchema>["items"][number];
  const items: ItemRow[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const category = normalizeTakeoffCategoryLoose(r.category ?? r.type ?? r.kind ?? r.class);
    if (!category) continue;

    const bbox =
      r.bbox && typeof r.bbox === "object" && !Array.isArray(r.bbox)
        ? (r.bbox as Record<string, unknown>)
        : null;

    const x0 = asFiniteNumberLoose(r.x0 ?? r.minX ?? r.left ?? bbox?.minX ?? bbox?.x ?? bbox?.left);
    const y0 = asFiniteNumberLoose(r.y0 ?? r.minY ?? r.top ?? bbox?.minY ?? bbox?.y ?? bbox?.top);
    const x1 = asFiniteNumberLoose(r.x1 ?? r.maxX ?? r.right ?? bbox?.maxX ?? bbox?.right);
    const y1 = asFiniteNumberLoose(r.y1 ?? r.maxY ?? r.bottom ?? bbox?.maxY ?? bbox?.bottom);

    let minX = x0;
    let minY = y0;
    let maxX = x1;
    let maxY = y1;

    if (minX != null && maxX != null && minX > maxX) [minX, maxX] = [maxX, minX];
    if (minY != null && maxY != null && minY > maxY) [minY, maxY] = [maxY, minY];

    const w = asFiniteNumberLoose(r.width ?? bbox?.width);
    const h = asFiniteNumberLoose(r.height ?? bbox?.height);
    if (minX != null && maxX == null && w != null) maxX = minX + Math.abs(w);
    if (minY != null && maxY == null && h != null) maxY = minY + Math.abs(h);

    if (minX == null && x0 != null && x1 != null) {
      minX = Math.min(x0, x1);
      maxX = Math.max(x0, x1);
    }
    if (minY == null && y0 != null && y1 != null) {
      minY = Math.min(y0, y1);
      maxY = Math.max(y0, y1);
    }

    if (minX == null || minY == null || maxX == null || maxY == null) continue;

    const pageParsed = z
      .number()
      .int()
      .min(0)
      .max(10_000)
      .safeParse(r.pageIndex ?? r.page);
    const pageIndex = pageParsed.success ? pageParsed.data : undefined;

    const labelRaw = r.label ?? r.name ?? r.text ?? r.title;
    const label =
      typeof labelRaw === "string" && labelRaw.trim().length > 0
        ? labelRaw.trim().slice(0, 120)
        : undefined;

    items.push({
      category,
      ...(pageIndex !== undefined ? { pageIndex } : {}),
      minX,
      minY,
      maxX,
      maxY,
      ...(label ? { label } : {}),
    });
  }

  let counts: z.infer<typeof takeoffAssistResultSchema>["counts"];
  if (obj?.counts && typeof obj.counts === "object" && !Array.isArray(obj.counts)) {
    const c = obj.counts as Record<string, unknown>;
    const pick = (k: string) => {
      const n = asFiniteNumberLoose(c[k]);
      if (n == null || !Number.isFinite(n)) return undefined;
      return Math.round(n);
    };
    counts = {
      windows: pick("windows"),
      doors: pick("doors"),
      walls: pick("walls"),
      rooms: pick("rooms"),
    };
  }

  return { ...(counts ? { counts } : {}), items };
}

/** Models sometimes return 0–100 instead of 0–1; normalize before clamping. */
function normalizeTakeoffCoordsToUnit(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const hi = Math.max(minX, minY, maxX, maxY);
  if (hi > 1 + 1e-6 && hi <= 100 + 1e-6) {
    const s = 1 / 100;
    return { minX: minX * s, minY: minY * s, maxX: maxX * s, maxY: maxY * s };
  }
  return { minX, minY, maxX, maxY };
}

export function sanitizeTakeoffAssistResult(
  parsed: z.infer<typeof takeoffAssistResultSchema>,
  expectedPageIndex0: number,
  allowedCategories: TakeoffAssistCategory[],
): TakeoffAssistCacheEntry {
  const allow = new Set(allowedCategories);
  const itemsIn: TakeoffAssistItem[] = [];
  for (const it of parsed.items.slice(0, TAKEOFF_ASSIST_MAX_ITEMS)) {
    if (!allow.has(it.category)) continue;
    const n = normalizeTakeoffCoordsToUnit(it.minX, it.minY, it.maxX, it.maxY);
    let minX = clamp01(n.minX);
    let minY = clamp01(n.minY);
    let maxX = clamp01(n.maxX);
    let maxY = clamp01(n.maxY);
    if (maxX < minX) [minX, maxX] = [maxX, minX];
    if (maxY < minY) [minY, maxY] = [maxY, minY];
    const xR = ensureMinSpanTakeoff1D(minX, maxX);
    const yR = ensureMinSpanTakeoff1D(minY, maxY);
    const label = it.label?.trim().slice(0, 120);
    itemsIn.push({
      category: it.category,
      pageIndex: expectedPageIndex0,
      minX: xR.min,
      minY: yR.min,
      maxX: xR.max,
      maxY: yR.max,
      ...(label ? { label } : {}),
    });
  }

  const counts: TakeoffAssistCacheEntry["counts"] = {};
  for (const c of allowedCategories) {
    counts[c] = itemsIn.filter((x) => x.category === c).length;
  }

  return {
    categories: [...allowedCategories],
    counts,
    items: itemsIn,
  };
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
  takeoffAssist: takeoffAssistCacheEntrySchema.optional(),
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
