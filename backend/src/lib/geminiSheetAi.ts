import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Env } from "./env.js";
import { resolveGeminiApiKey } from "./env.js";
import {
  assertImageSizeOk,
  parseTakeoffAssistResultLoose,
  sanitizeSheetSummaryResult,
  sanitizeTakeoffAssistResult,
  sheetSummaryResultSchema,
  takeoffAssistResultSchema,
  type SheetAiContextBundle,
  type SheetSummaryReadingRow,
  type SheetSummaryTocEntry,
  type SheetTakeoffDetectBody,
  type TakeoffAssistCacheEntry,
  uniqueTakeoffCategoriesInOrder,
} from "./sheetAiSchemas.js";

function stripDataUrlPrefix(b64: string): string {
  const m = /^data:image\/(?:png|jpeg);base64,(.+)$/i.exec(b64.trim());
  return m ? m[1]! : b64.replace(/\s/g, "");
}

function extractJsonObject(text: string): unknown {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  const body = fence ? fence[1]!.trim() : t;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model response");
  }
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

/**
 * Prefer the last ```json … ``` block (models often emit thinking, then a final JSON fence).
 */
function stripToJsonBody(modelText: string): string {
  const t = modelText.trim();
  let lastBlock: string | null = null;
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    lastBlock = m[1]!.trim();
  }
  if (lastBlock && (lastBlock.startsWith("{") || lastBlock.startsWith("["))) return lastBlock;
  const one = /^```(?:json)?\s*([\s\S]*?)```/m.exec(t);
  if (one && (one[1]!.trim().startsWith("{") || one[1]!.trim().startsWith("[")))
    return one[1]!.trim();
  return t;
}

/** From body[start]==="{", slice one balanced `{ ... }` (string-aware). */
function extractBalancedObject(body: string, start: number): string | null {
  if (body[start] !== "{") return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let quote: '"' | "'" | null = null;
  for (let i = start; i < body.length; i++) {
    const c = body[i]!;
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (quote && c === quote) {
        inStr = false;
        quote = null;
        continue;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c as '"' | "'";
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Recover JSON when the model prefixes thinking / prose (first `{` is not the payload).
 * Looks for an object that contains a top-level array keyed as items / detections / etc.
 */
function extractTakeoffStructuredJson(modelText: string): unknown {
  const body = stripToJsonBody(modelText);
  const trimmed = body.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr)) return { items: arr };
    } catch {
      /* fall through — model may have put prose before a real object */
    }
  }

  const arrayKeyPattern = /"(?:items|detections|boxes|regions|results|elements|annotations)"\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = arrayKeyPattern.exec(body)) !== null) {
    let open = match.index;
    while (open >= 0 && body[open] !== "{") open--;
    if (open < 0 || body[open] !== "{") continue;
    const chunk = extractBalancedObject(body, open);
    if (!chunk) continue;
    try {
      const o = JSON.parse(chunk) as unknown;
      if (o && typeof o === "object" && !Array.isArray(o)) return o;
    } catch {
      /* try next key occurrence */
    }
  }

  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(body.slice(start, end + 1)) as unknown;
  }
  throw new Error("No JSON object in model response");
}

function contextText(bundle: SheetAiContextBundle): string {
  const parts: string[] = [
    `Sheet page: zero-based index ${bundle.pageIndex} in the PDF.`,
    "The attached image is a full-page raster of that sheet. Normalized coordinates (0–1) use the image: (0,0) top-left, (1,1) bottom-right.",
  ];
  if (bundle.viewerSnapshot && Object.keys(bundle.viewerSnapshot).length > 0) {
    parts.push(`Viewer context (JSON): ${JSON.stringify(bundle.viewerSnapshot)}`);
  }
  if (bundle.pdfTextSnippet?.trim()) {
    parts.push(
      `Extracted PDF text (may be partial):\n---\n${bundle.pdfTextSnippet.slice(0, 24_000)}\n---`,
    );
  }
  return parts.join("\n\n");
}

export function geminiConfigured(env: Env): boolean {
  return Boolean(resolveGeminiApiKey(env));
}

async function runGemini(
  env: Env,
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
  generationConfig?: { maxOutputTokens: number },
): Promise<string> {
  const key = resolveGeminiApiKey(env);
  if (!key) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL.trim() || "gemini-2.5-flash",
    generationConfig: generationConfig
      ? { maxOutputTokens: generationConfig.maxOutputTokens, temperature: 0.35 }
      : { temperature: 0.35 },
  });

  const result = await model.generateContent(parts);
  const text = result.response.text();
  if (!text?.trim()) throw new EmptyModelResponseError();
  return text;
}

export class EmptyModelResponseError extends Error {
  constructor() {
    super("Empty model response");
    this.name = "EmptyModelResponseError";
  }
}

export async function geminiSheetSummary(
  env: Env,
  bundle: SheetAiContextBundle,
): Promise<{
  summaryMarkdown: string;
  readingsTable: SheetSummaryReadingRow[];
  tableOfContents: SheetSummaryTocEntry[];
}> {
  const raw = stripDataUrlPrefix(bundle.imageBase64);
  const size = assertImageSizeOk(raw);
  if (!size.ok) throw new Error(size.error);

  const prompt = `You are a construction document assistant for construction drawings.

${contextText(bundle)}

Return ONLY a single JSON object (no markdown code fences) with this exact shape:
{
  "summaryMarkdown": "string — short markdown overview only: discipline, sheet name/number, what the sheet is for, and caveats (illegible areas). Do NOT duplicate row-by-row reads here — use readingsTable for those.",
  "readingsTable": [
    {
      "element": "short label for one distinct item (e.g. 'Wall type 7', 'RTU-01', 'Detail 5/A-501', 'General note 12')",
      "detail": "concrete readable content: dimensions, insulation layers, pipe size, spec ref, first line of note — quote or paraphrase visible text",
      "kind": "area" | "detail" | "note" | "schedule" | "title_block" | "legend" | "mep" | "envelope" | "structure" | "other"
    }
  ],
  "tableOfContents": [
    {
      "title": "short UI label (e.g. Kitchen, Detail 5/A-501, General notes 7–12, Door schedule)",
      "snippet": "optional — short quote or paraphrase of the readable text/symbol in that exact region (one line)",
      "kind": "area" | "detail" | "note" | "schedule" | "title_block" | "legend" | "mep" | "envelope" | "structure" | "other",
      "pageIndex": ${bundle.pageIndex},
      "minX": number 0-1,
      "minY": number 0-1,
      "maxX": number 0-1,
      "maxY": number 0-1
    }
  ]
}

Rules for readingsTable:
- One row per meaningful element you can read (wall types, MEP tags, detail keys, schedule headers, note topics, title block fields).
- "detail" must be specific; if unreadable write "Illegible" — do not invent numbers or specs.
- Aim for 10–40 rows on busy sheets; fewer on sparse sheets.
- "kind" is optional but preferred.

Rules for tableOfContents (user will click an entry to zoom and highlight that region):
- Use pageIndex exactly ${bundle.pageIndex} for every entry.
- Coordinates: normalized to the FULL sheet image (0,0) top-left, (1,1) bottom-right; use 3 decimal places.
- Include BOTH large zones AND construction-relevant regions: wall sections (insulation, stud layers), MEP (duct/pipe runs, equipment, diffusers, electrical/plumbing symbols), structural callouts, enlarged details, sections, notes, schedules, legends, title block.
- For each entry, the bounding box must TIGHTLY wrap only that item. Small callouts = small boxes (do not use huge boxes for a single note line).
- "snippet" should reflect what you actually read in that box (e.g. detail title, first line of a note, schedule column header).
- "kind": area=plan/room; detail=enlarged detail/section; note=general/spec; schedule=table; title_block; legend; mep=ducts/pipes/equipment/services; envelope=wall section, insulation, cladding, WRB; structure=structural plan/slab/framing; other.
- Aim for 8–28 entries when the sheet is busy; fewer on simple sheets. Omit regions you cannot locate confidently.
- Titles must be unique in the list.`;

  const text = await runGemini(
    env,
    [{ text: prompt }, { inlineData: { mimeType: bundle.mimeType, data: raw } }],
    { maxOutputTokens: 8192 },
  );

  try {
    const json = extractJsonObject(text);
    const parsed = sheetSummaryResultSchema.safeParse(json);
    if (!parsed.success) {
      return { summaryMarkdown: text.trim(), readingsTable: [], tableOfContents: [] };
    }
    return sanitizeSheetSummaryResult(parsed.data, bundle.pageIndex);
  } catch {
    return { summaryMarkdown: text.trim(), readingsTable: [], tableOfContents: [] };
  }
}

export async function geminiTakeoffAssistDetect(
  env: Env,
  bundle: SheetTakeoffDetectBody,
): Promise<TakeoffAssistCacheEntry> {
  const raw = stripDataUrlPrefix(bundle.imageBase64);
  const size = assertImageSizeOk(raw);
  if (!size.ok) throw new Error(size.error);

  const categories = uniqueTakeoffCategoriesInOrder(bundle.categories);

  const catList = categories.join(", ");
  const prompt = `You are assisting with construction drawing takeoff (quantity estimates from one raster image only).

${contextText(bundle)}

The user selected these categories to detect on THIS sheet image: ${catList}.

Definitions:
- windows: window opening symbols, glazing tags, or window callouts visible on this view.
- doors: door swings, door tags, or door symbols.
- walls: visible wall graphic segments or wall runs you can separate (not linear feet — count distinct visible wall segments/symbols you can box).
- rooms: labeled or clearly bounded room/spaces on plans (one box per room when possible).

Return ONLY valid JSON (no markdown fences, no commentary). Use lowercase category strings exactly: "windows", "doors", "walls", or "rooms".

Example shape (replace with your real reads; coordinates must be decimals 0–1):
{
  "items": [
    {
      "category": "doors",
      "pageIndex": ${bundle.pageIndex},
      "minX": 0.12,
      "minY": 0.34,
      "maxX": 0.16,
      "maxY": 0.38,
      "label": "D-101"
    }
  ]
}

You may also include optional "counts": { "windows": 3, "doors": 2 } — counts must match the number of items you list per category when possible.

Rules:
- Only detect categories the user asked for: ${catList}.
- Use pageIndex exactly ${bundle.pageIndex} for every item.
- minX/minY/maxX/maxY are normalized to the FULL sheet image: (0,0) top-left, (1,1) bottom-right. Use decimal numbers (not strings).
- Prefer one box per instance you can see, up to 80 items total. If nothing is visible for a category, omit items for that category.
- Make your best estimate on real construction plans; return empty items only if the sheet truly has no detectable instances for the selected categories.`;

  const text = await runGemini(
    env,
    [{ text: prompt }, { inlineData: { mimeType: bundle.mimeType, data: raw } }],
    { maxOutputTokens: 8192 },
  );

  try {
    const json = extractTakeoffStructuredJson(text);
    const parsed = takeoffAssistResultSchema.safeParse(json);
    const loose = parseTakeoffAssistResultLoose(json);

    if (parsed.success && parsed.data.items.length > 0) {
      return sanitizeTakeoffAssistResult(parsed.data, bundle.pageIndex, categories);
    }
    if (loose && loose.items.length > 0) {
      return sanitizeTakeoffAssistResult(loose, bundle.pageIndex, categories);
    }
    if (parsed.success) {
      return sanitizeTakeoffAssistResult(parsed.data, bundle.pageIndex, categories);
    }
    return sanitizeTakeoffAssistResult({ items: [] }, bundle.pageIndex, categories);
  } catch {
    return sanitizeTakeoffAssistResult({ items: [] }, bundle.pageIndex, categories);
  }
}

export async function geminiSheetChat(
  env: Env,
  bundle: SheetAiContextBundle,
  messages: { role: "user" | "model"; content: string }[],
): Promise<{ reply: string }> {
  const raw = stripDataUrlPrefix(bundle.imageBase64);
  const size = assertImageSizeOk(raw);
  if (!size.ok) throw new Error(size.error);

  const system = `You help users read construction drawings (architecture, structure, envelope, MEP). The user sees the attached sheet image. ${contextText(bundle)}

Rules: Describe insulation layers, wall types, ducts, piping, and equipment when visible. Quote readable tags, dimensions, and detail references. Say where on the sheet (e.g. "wall section left", "ceiling MEP corridor"). If unreadable, say so. Short markdown. No legal advice.`;

  const historyText = messages
    .slice(0, -1)
    .map((m) => `**${m.role}**: ${m.content}`)
    .join("\n\n");
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") throw new Error("Last message must be from user");

  const prompt = `${system}

${historyText ? `Prior turns:\n${historyText}\n\n` : ""}**user**: ${last.content}`;

  const text = await runGemini(
    env,
    [{ text: prompt }, { inlineData: { mimeType: bundle.mimeType, data: raw } }],
    { maxOutputTokens: 2048 },
  );
  return { reply: text.trim() };
}
