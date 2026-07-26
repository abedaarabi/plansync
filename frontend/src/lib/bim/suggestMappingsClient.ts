import type {
  BimModelLevelDraft,
  DrawingSheetOption,
  SuggestedDrawingMap,
} from "@/lib/api-client/bim-publish";

const LEVEL_PATTERNS = [
  /\bL(?:EVEL)?[\s_-]*0*(\d+)\b/i,
  /\bL(\d{2})\b/i,
  /\b(B\d+|B\d+\.\d+)\b/i,
  /\b(GROUND|BASEMENT|ROOF|PENTHOUSE)\b/i,
  /\b(FIRST|SECOND|THIRD|FOURTH|FIFTH)\b/i,
];

const FLOOR_WORDS: Record<string, number> = {
  basement: -1,
  ground: 0,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  roof: 99,
  penthouse: 98,
};

// fallow-ignore-next-line complexity
function parseLevelHint(text: string): number | null {
  const t = text.toUpperCase();
  for (const re of LEVEL_PATTERNS) {
    const m = t.match(re);
    if (!m) continue;
    const token = (m[1] ?? m[0]).toLowerCase();
    if (token in FLOOR_WORDS) return FLOOR_WORDS[token]!;
    const n = Number.parseInt(token.replace(/\D/g, ""), 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function elevationFromText(text: string): number | null {
  const m = text.match(/(?:EL\.?|ELEV\.?|@)\s*([+-]?\d+(?:\.\d+)?)\s*(?:M|MTR|METERS?)?/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

function levelOrder(level: BimModelLevelDraft): number {
  return level.sortOrder;
}

function fuzzyElevationMatch(
  sheetElev: number | null,
  level: BimModelLevelDraft,
): { score: number; reason: string } | null {
  if (sheetElev == null || level.elevationMeters == null) return null;
  const diff = Math.abs(sheetElev - level.elevationMeters);
  if (diff > 2.5) return null;
  const score = Math.max(0.35, 1 - diff / 2.5);
  return { score, reason: `Elevation ~${level.elevationMeters.toFixed(2)} m` };
}

// fallow-ignore-next-line complexity
function filenameScore(
  sheet: DrawingSheetOption,
  pageIndex: number,
  level: BimModelLevelDraft,
  levelIndex: number,
): { score: number; reason: string } | null {
  const label = `${sheet.name} page ${pageIndex + 1} ${sheet.folderPath ?? ""}`;
  const hint = parseLevelHint(label);
  if (hint == null) return null;

  const levelHint =
    parseLevelHint(level.displayName) ?? parseLevelHint(level.sourceName) ?? levelIndex;

  if (hint === levelHint) {
    return { score: 0.85, reason: `Filename level hint (${hint})` };
  }
  if (Math.abs(hint - levelHint) === 1) {
    return { score: 0.55, reason: "Adjacent level in filename" };
  }
  return null;
}

// fallow-ignore-next-line complexity
function summaryKeywordScore(
  sheet: DrawingSheetOption,
  level: BimModelLevelDraft,
): { score: number; reason: string } | null {
  const summary = sheet.summaryByPage?.join(" ") ?? "";
  if (!summary.trim()) return null;
  const upper = summary.toUpperCase();
  const tokens = [level.displayName, level.sourceName, `LEVEL ${level.sortOrder + 1}`].filter(
    Boolean,
  );
  for (const token of tokens) {
    if (token && upper.includes(token.toUpperCase())) {
      return { score: 0.75, reason: `Sheet summary mentions "${token}"` };
    }
  }
  const hint = parseLevelHint(upper);
  const levelHint = parseLevelHint(level.displayName) ?? parseLevelHint(level.sourceName);
  if (hint != null && levelHint != null && hint === levelHint) {
    return { score: 0.7, reason: "Summary level keyword match" };
  }
  return null;
}

// fallow-ignore-next-line complexity
function pageOrderHeuristic(
  pageIndex: number,
  levelIndex: number,
  totalPages: number,
  totalLevels: number,
): { score: number; reason: string } | null {
  if (totalPages <= 1 || totalLevels <= 1) return null;
  const expected = Math.round((pageIndex / Math.max(totalPages - 1, 1)) * (totalLevels - 1));
  if (expected === levelIndex) {
    return { score: 0.45, reason: "Page order matches level order" };
  }
  if (Math.abs(expected - levelIndex) === 1) {
    return { score: 0.3, reason: "Page order near level order" };
  }
  return null;
}

/** Client-side auto-suggest when server helper is unavailable or as a fast pre-fill. */
// fallow-ignore-next-line complexity
export function suggestDrawingMappingsClient(input: {
  levels: BimModelLevelDraft[];
  sheets: DrawingSheetOption[];
  minConfidence?: number;
}): SuggestedDrawingMap[] {
  const minConfidence = input.minConfidence ?? 0.4;
  const sortedLevels = [...input.levels].sort((a, b) => a.sortOrder - b.sortOrder);
  const out: SuggestedDrawingMap[] = [];

  for (const sheet of input.sheets) {
    const pageCount = Math.max(sheet.pageCount, 1);
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const label = `${sheet.name} p${pageIndex + 1}`;
      const sheetElev = elevationFromText(label) ?? elevationFromText(sheet.name);

      for (let li = 0; li < sortedLevels.length; li += 1) {
        const level = sortedLevels[li]!;
        const candidates: { score: number; reason: string }[] = [];

        const fn = filenameScore(sheet, pageIndex, level, li);
        if (fn) candidates.push(fn);

        const kw = summaryKeywordScore(sheet, level);
        if (kw) candidates.push(kw);

        const elev = fuzzyElevationMatch(sheetElev, level);
        if (elev) candidates.push(elev);

        const order = pageOrderHeuristic(pageIndex, li, pageCount, sortedLevels.length);
        if (order) candidates.push(order);

        if (candidates.length === 0) continue;

        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0]!;
        if (best.score < minConfidence) continue;

        out.push({
          pdfFileId: sheet.fileId,
          pdfFileVersionId: sheet.latestFileVersionId,
          pageIndex,
          bimModelLevelId: level.clientId ?? level.sourceName,
          confidence: best.score,
          reason: best.reason,
        });
      }
    }
  }

  // Keep highest-confidence suggestion per level+page slot
  const byKey = new Map<string, SuggestedDrawingMap>();
  for (const row of out) {
    const key = `${row.bimModelLevelId}:${row.pdfFileId}:${row.pageIndex}`;
    const prev = byKey.get(key);
    if (!prev || row.confidence > prev.confidence) byKey.set(key, row);
  }

  // One primary sheet per level — keep best per level
  const byLevel = new Map<string, SuggestedDrawingMap>();
  for (const row of byKey.values()) {
    const prev = byLevel.get(row.bimModelLevelId);
    if (!prev || row.confidence > prev.confidence) byLevel.set(row.bimModelLevelId, row);
  }

  return [...byLevel.values()].sort((a, b) => b.confidence - a.confidence);
}
