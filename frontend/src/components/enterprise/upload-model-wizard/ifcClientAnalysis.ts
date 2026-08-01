import { disciplineFromFileName, estimateGpuMb } from "./helpers";
import type { IfcClientAnalysis } from "./types";

const HEADER_BYTES = 768 * 1024;

/** IFC rooted entities: GlobalId, OwnerHistory, Name, … — prefer Name over GUID. */
function extractIfcName(entityArgs: string): string | null {
  const quotes = [...entityArgs.matchAll(/'([^']*)'/g)].map((m) => m[1] ?? "");
  if (quotes.length === 0) return null;
  // Skip GlobalId (22-char IFC GUID) when a later Name exists.
  const name =
    quotes.find((q, i) => i > 0 && q.trim().length > 0 && !/^[0-9A-Za-z_$]{22}$/.test(q)) ??
    quotes.find((q) => q.trim().length > 0 && !/^[0-9A-Za-z_$]{22}$/.test(q));
  return name?.trim() || null;
}

function normalizeSchema(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/['"\s]/g, "").toUpperCase();
  if (s.includes("IFC4X3")) return "IFC4x3";
  if (s.includes("IFC4")) return "IFC4";
  if (s.includes("IFC2X3") || s.includes("IFC2X")) return "IFC2x3";
  return raw.slice(0, 24);
}

/**
 * Best-effort local sniff of an IFC file header/body chunk.
 * Full geometry/index runs server-side after import — this is for trust UX only.
 */
// fallow-ignore-next-line complexity
export async function analyzeIfcClient(
  file: File,
  signal?: AbortSignal,
): Promise<IfcClientAnalysis> {
  const slice = file.slice(0, Math.min(file.size, HEADER_BYTES));
  const buf = await slice.arrayBuffer();
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const upper = text.toUpperCase();

  const schemaMatch =
    text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i) ?? text.match(/FILE_SCHEMA\s*\(\s*'([^']+)'/i);
  const schema = normalizeSchema(schemaMatch?.[1] ?? null);

  let projectName: string | null = null;
  let buildingName: string | null = null;
  const projectLine = text.match(/#\d+\s*=\s*IFCPROJECT\s*\(([^;]{0,800})\)/i);
  if (projectLine?.[1]) projectName = extractIfcName(projectLine[1]);
  const buildingLine = text.match(/#\d+\s*=\s*IFCBUILDING\s*\(([^;]{0,800})\)/i);
  if (buildingLine?.[1]) buildingName = extractIfcName(buildingLine[1]);

  const storeyMatches = upper.match(/IFCBUILDINGSTOREY\s*\(/g);
  const storeyCount = storeyMatches ? storeyMatches.length : null;

  const entityMatches = text.match(/#\d+\s*=\s*IFC[A-Z0-9]+/gi);
  const sampledEntities = entityMatches?.length ?? 0;
  const coverage = Math.min(1, HEADER_BYTES / Math.max(file.size, 1));
  const elementCountEstimate =
    sampledEntities > 0
      ? Math.max(sampledEntities, Math.round(sampledEntities / Math.max(coverage, 0.02)))
      : null;

  const disciplines = disciplineFromFileName(file.name);
  if (/\bIFCSPACE\b/i.test(text) && !disciplines.includes("Architecture")) {
    disciplines.push("Architecture");
  }
  if (/\bIFCBEAM\b|\bIFCCOLUMN\b|\bIFCSLAB\b/i.test(text) && !disciplines.includes("Structure")) {
    disciplines.push("Structure");
  }
  if (/\bIFCFLOWSEGMENT\b|\bIFCDUCTSEGMENT\b/i.test(text) && !disciplines.includes("HVAC")) {
    disciplines.push("HVAC");
  }
  if (/\bIFCPIPESEGMENT\b/i.test(text) && !disciplines.includes("Plumbing")) {
    disciplines.push("Plumbing");
  }
  if (/\bIFCCABLESEGMENT\b|\bIFCELECTRIC\b/i.test(text) && !disciplines.includes("Electrical")) {
    disciplines.push("Electrical");
  }

  let units: string | null = null;
  if (/IFCSIUNIT\s*\([^)]*\.METRE\./i.test(text) || /\.METRE\./i.test(text)) units = "Meters";
  else if (/IFCSIUNIT\s*\([^)]*\.FOOT\./i.test(text) || /\.FOOT\./i.test(text)) units = "Feet";
  else if (/LENGTHUNIT/i.test(text)) units = "Length units detected";

  const hasMaterials = /\bIFCMATERIAL\b/i.test(text) ? true : sampledEntities > 40 ? false : null;

  const guids = [...text.matchAll(/'[0-9A-Za-z_$]{22}'/g)].map((m) => m[0]);
  const seen = new Set<string>();
  let duplicateGuidSamples = 0;
  for (const g of guids) {
    if (seen.has(g)) duplicateGuidSamples += 1;
    else seen.add(g);
  }

  const warnings: string[] = [];
  if (hasMaterials === false) warnings.push("Missing materials in sampled header");
  if (duplicateGuidSamples > 0) {
    warnings.push(
      `${duplicateGuidSamples} duplicate GUID${duplicateGuidSamples === 1 ? "" : "s"} in sample`,
    );
  }
  if (storeyCount === 0) warnings.push("No building storeys detected in sample");
  if (!schema) warnings.push("Could not confirm IFC schema from header");

  const estimatedGpuMb = estimateGpuMb(file.size, elementCountEstimate);

  return {
    schema,
    projectName,
    buildingName,
    storeyCount,
    elementCountEstimate,
    disciplines: [...new Set(disciplines)],
    units,
    hasMaterials,
    duplicateGuidSamples,
    fileSizeBytes: file.size,
    estimatedGpuMb,
    warnings,
  };
}
