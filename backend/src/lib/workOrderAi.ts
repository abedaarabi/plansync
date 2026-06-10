import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Env } from "./env.js";
import { resolveGeminiApiKey } from "./env.js";

export type WorkOrderAiTroubleshootInput = {
  assetTag: string;
  assetName: string;
  category: string | null;
  manufacturer: string | null;
  model: string | null;
  workOrderTitle: string;
  workOrderDescription: string | null;
  documentLabels: string[];
};

export type WorkOrderAiTroubleshootResult = {
  summary: string;
  suggestedSteps: string[];
  safetyNotes: string[];
};

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

export async function troubleshootWorkOrderWithAi(
  env: Env,
  input: WorkOrderAiTroubleshootInput,
): Promise<WorkOrderAiTroubleshootResult> {
  const apiKey = resolveGeminiApiKey(env);
  if (!apiKey) {
    throw new Error("AI troubleshooting is not configured (GEMINI_API_KEY).");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are a facilities maintenance expert. A technician needs help with equipment maintenance.

Equipment:
- Tag: ${input.assetTag}
- Name: ${input.assetName}
- Category: ${input.category ?? "unknown"}
- Manufacturer: ${input.manufacturer ?? "unknown"}
- Model: ${input.model ?? "unknown"}

Work order:
- Title: ${input.workOrderTitle}
- Description: ${input.workOrderDescription?.trim() || "(none)"}

Available manuals/documents on file: ${input.documentLabels.length ? input.documentLabels.join(", ") : "none listed"}

Respond with JSON only:
{
  "summary": "2-3 sentence diagnosis guidance",
  "suggestedSteps": ["step 1", "step 2", ...],
  "safetyNotes": ["note 1", ...]
}
Keep steps practical for a frontline technician. Max 6 steps and 4 safety notes.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const raw = extractJsonObject(text) as Record<string, unknown>;

  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const suggestedSteps = Array.isArray(raw.suggestedSteps)
    ? raw.suggestedSteps.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  const safetyNotes = Array.isArray(raw.safetyNotes)
    ? raw.safetyNotes.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];

  if (!summary) throw new Error("AI returned an empty summary.");

  return {
    summary: summary.slice(0, 2000),
    suggestedSteps: suggestedSteps.slice(0, 8),
    safetyNotes: safetyNotes.slice(0, 6),
  };
}
