import { GoogleGenerativeAI } from "@google/generative-ai";
import { resolveGeminiApiKey } from "./env.js";
import { assertImageSizeOk, sanitizeSheetSummaryResult, sheetSummaryResultSchema, } from "./sheetAiSchemas.js";
function stripDataUrlPrefix(b64) {
    const m = /^data:image\/(?:png|jpeg);base64,(.+)$/i.exec(b64.trim());
    return m ? m[1] : b64.replace(/\s/g, "");
}
function extractJsonObject(text) {
    const t = text.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
    const body = fence ? fence[1].trim() : t;
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("No JSON object in model response");
    }
    return JSON.parse(body.slice(start, end + 1));
}
function contextText(bundle) {
    const parts = [
        `Sheet page: zero-based index ${bundle.pageIndex} in the PDF.`,
        "The attached image is a full-page raster of that sheet. Normalized coordinates (0–1) use the image: (0,0) top-left, (1,1) bottom-right.",
    ];
    if (bundle.viewerSnapshot && Object.keys(bundle.viewerSnapshot).length > 0) {
        parts.push(`Viewer context (JSON): ${JSON.stringify(bundle.viewerSnapshot)}`);
    }
    if (bundle.pdfTextSnippet?.trim()) {
        parts.push(`Extracted PDF text (may be partial):\n---\n${bundle.pdfTextSnippet.slice(0, 24_000)}\n---`);
    }
    return parts.join("\n\n");
}
export function geminiConfigured(env) {
    return Boolean(resolveGeminiApiKey(env));
}
async function runGemini(env, parts, generationConfig) {
    const key = resolveGeminiApiKey(env);
    if (!key)
        throw new Error("Gemini API key not configured");
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
        model: env.GEMINI_MODEL.trim() || "gemini-2.5-flash",
        generationConfig: generationConfig
            ? { maxOutputTokens: generationConfig.maxOutputTokens, temperature: 0.35 }
            : { temperature: 0.35 },
    });
    const result = await model.generateContent(parts);
    const text = result.response.text();
    if (!text?.trim())
        throw new EmptyModelResponseError();
    return text;
}
export class EmptyModelResponseError extends Error {
    constructor() {
        super("Empty model response");
        this.name = "EmptyModelResponseError";
    }
}
export async function geminiSheetSummary(env, bundle) {
    const raw = stripDataUrlPrefix(bundle.imageBase64);
    const size = assertImageSizeOk(raw);
    if (!size.ok)
        throw new Error(size.error);
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
    const text = await runGemini(env, [{ text: prompt }, { inlineData: { mimeType: bundle.mimeType, data: raw } }], { maxOutputTokens: 8192 });
    try {
        const json = extractJsonObject(text);
        const parsed = sheetSummaryResultSchema.safeParse(json);
        if (!parsed.success) {
            return { summaryMarkdown: text.trim(), readingsTable: [], tableOfContents: [] };
        }
        return sanitizeSheetSummaryResult(parsed.data, bundle.pageIndex);
    }
    catch {
        return { summaryMarkdown: text.trim(), readingsTable: [], tableOfContents: [] };
    }
}
export async function geminiSheetChat(env, bundle, messages) {
    const raw = stripDataUrlPrefix(bundle.imageBase64);
    const size = assertImageSizeOk(raw);
    if (!size.ok)
        throw new Error(size.error);
    const system = `You help users read construction drawings (architecture, structure, envelope, MEP). The user sees the attached sheet image. ${contextText(bundle)}

Rules: Describe insulation layers, wall types, ducts, piping, and equipment when visible. Quote readable tags, dimensions, and detail references. Say where on the sheet (e.g. "wall section left", "ceiling MEP corridor"). If unreadable, say so. Short markdown. No legal advice.`;
    const historyText = messages
        .slice(0, -1)
        .map((m) => `**${m.role}**: ${m.content}`)
        .join("\n\n");
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user")
        throw new Error("Last message must be from user");
    const prompt = `${system}

${historyText ? `Prior turns:\n${historyText}\n\n` : ""}**user**: ${last.content}`;
    const text = await runGemini(env, [{ text: prompt }, { inlineData: { mimeType: bundle.mimeType, data: raw } }], { maxOutputTokens: 2048 });
    return { reply: text.trim() };
}
