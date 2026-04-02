import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Env } from "./env.js";
import { resolveGeminiApiKey } from "./env.js";
import {
  assertImageSizeOk,
  proposeActionsResultSchema,
  sanitizeProposeResult,
  sanitizeSheetSummaryResult,
  sheetSummaryResultSchema,
  type SheetAiContextBundle,
  type SheetSummaryTocEntry,
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
      `Extracted PDF text (may be partial):\n---\n${bundle.pdfTextSnippet.slice(0, 80_000)}\n---`,
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
): Promise<string> {
  const key = resolveGeminiApiKey(env);
  if (!key) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL.trim() || "gemini-2.5-pro",
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
): Promise<{ summaryMarkdown: string; tableOfContents: SheetSummaryTocEntry[] }> {
  const raw = stripDataUrlPrefix(bundle.imageBase64);
  const size = assertImageSizeOk(raw);
  if (!size.ok) throw new Error(size.error);

  const prompt = `You are a construction document assistant for construction drawings.

${contextText(bundle)}

Return ONLY a single JSON object (no markdown code fences) with this exact shape:
{
  "summaryMarkdown": "string — markdown: discipline, sheet id, architectural zones, STRUCTURAL (slabs, framing), ENVELOPE (wall sections, insulation layers, WRB, cladding), MEP (ducts, piping, diffusers, equipment tags, risers, ceiling services), and readable text (dimensions, detail refs, specs). If illegible, say so. Do not invent numbers.",
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

Rules for tableOfContents (user will click an entry to zoom and highlight that region):
- Use pageIndex exactly ${bundle.pageIndex} for every entry.
- Coordinates: normalized to the FULL sheet image (0,0) top-left, (1,1) bottom-right; use 3 decimal places.
- Include BOTH large zones AND construction-relevant regions: wall sections (insulation, stud layers), MEP (duct/pipe runs, equipment, diffusers, electrical/plumbing symbols), structural callouts, enlarged details, sections, notes, schedules, legends, title block.
- For each entry, the bounding box must TIGHTLY wrap only that item. Small callouts = small boxes (do not use huge boxes for a single note line).
- "snippet" should reflect what you actually read in that box (e.g. detail title, first line of a note, schedule column header).
- "kind": area=plan/room; detail=enlarged detail/section; note=general/spec; schedule=table; title_block; legend; mep=ducts/pipes/equipment/services; envelope=wall section, insulation, cladding, WRB; structure=structural plan/slab/framing; other.
- Aim for 8–28 entries when the sheet is busy; fewer on simple sheets. Omit regions you cannot locate confidently.
- Titles must be unique in the list.`;

  const text = await runGemini(env, [
    { text: prompt },
    { inlineData: { mimeType: bundle.mimeType, data: raw } },
  ]);

  try {
    const json = extractJsonObject(text);
    const parsed = sheetSummaryResultSchema.safeParse(json);
    if (!parsed.success) {
      return { summaryMarkdown: text.trim(), tableOfContents: [] };
    }
    return sanitizeSheetSummaryResult(parsed.data, bundle.pageIndex);
  } catch {
    return { summaryMarkdown: text.trim(), tableOfContents: [] };
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

  const text = await runGemini(env, [
    { text: prompt },
    { inlineData: { mimeType: bundle.mimeType, data: raw } },
  ]);
  return { reply: text.trim() };
}

export async function geminiProposeActions(
  env: Env,
  bundle: SheetAiContextBundle,
  userPrompt?: string,
): Promise<{ proposals: ReturnType<typeof sanitizeProposeResult> }> {
  const raw = stripDataUrlPrefix(bundle.imageBase64);
  const size = assertImageSizeOk(raw);
  if (!size.ok) throw new Error(size.error);

  const schemaHint = `Return ONLY a single JSON object (no markdown fences) with this shape:
{
  "takeoffZones": [ { "suggestedItemName": string (optional), "measurementType": "area"|"linear"|"count", "points": [{"x":0-1,"y":0-1}, ...], "notes": string (optional) } ],
  "issueDrafts": [ { "title": string, "description": string (optional), "pageNumber": number optional 1-based, "pinNorm": {"x":0-1,"y":0-1} optional } ],
  "markups": [ { "type": "rect"|"ellipse"|"cloud"|"highlight"|"line"|"text"|"polygon", "color": "#RRGGBB" optional, "strokeWidth": number optional, "points": [...], "text": string for type text optional } ]
}

Rules:
- Coordinates are normalized to the FULL sheet image (0-1).
- area: at least 3 points (closed polygon vertices in order).
- linear: at least 2 points along the path.
- count: one point per counted item OR one point if unclear.
- rect/ellipse/cloud/highlight: two points = opposite corners of bounding box.
- line: two endpoints.
- polygon: at least 3 vertices.
- text: one anchor point (x,y); put label in "text".
- Prefer a small number of high-confidence items over many guesses.
`;

  const prompt = `You propose takeoff zones, issue pins, and markups from a construction sheet. Include envelope/MEP where relevant: insulation boundaries, duct/pipe centerlines, equipment pads, layered wall sections in details.

${contextText(bundle)}

${userPrompt?.trim() ? `User request: ${userPrompt.trim()}\n\n` : ""}${schemaHint}`;

  const text = await runGemini(env, [
    { text: prompt },
    { inlineData: { mimeType: bundle.mimeType, data: raw } },
  ]);

  let parsed: unknown;
  try {
    parsed = extractJsonObject(text);
  } catch {
    throw new Error("Model did not return valid JSON");
  }

  const validated = proposeActionsResultSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("Model JSON failed validation");
  }

  return { proposals: sanitizeProposeResult(validated.data) };
}
