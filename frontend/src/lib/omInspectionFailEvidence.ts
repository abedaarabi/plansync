export type OmInspectionFailEvidenceItem = {
  id: string;
  type: string;
};

export type OmInspectionFailEvidenceResult = {
  outcome: "pass" | "fail" | "na" | null;
  note: string;
  photoDataUrl?: string;
};

/** Fail items need photo + note when the template requires evidence. */
export function failEvidenceErrors(
  requireFailEvidence: boolean,
  checklist: OmInspectionFailEvidenceItem[],
  map: Record<string, OmInspectionFailEvidenceResult | undefined>,
): Record<string, string> {
  if (!requireFailEvidence) return {};
  const out: Record<string, string> = {};
  for (const it of checklist) {
    if (it.type === "text") continue;
    const r = map[it.id];
    if (r?.outcome !== "fail") continue;
    const missing: string[] = [];
    if (!r.photoDataUrl?.startsWith("data:image")) missing.push("photo");
    if (!r.note.trim()) missing.push("note");
    if (missing.length) {
      out[it.id] = `Fail requires ${missing.join(" and ")}.`;
    }
  }
  return out;
}
