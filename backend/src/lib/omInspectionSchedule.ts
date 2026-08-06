/** Map display frequency labels to interval days for inspection templates. */
export function inspectionFrequencyToIntervalDays(
  frequency: string | null | undefined,
): number | null {
  const f = (frequency ?? "").trim().toLowerCase();
  if (!f) return null;
  if (f === "daily") return 1;
  if (f === "weekly") return 7;
  if (f === "biweekly" || f === "bi-weekly") return 14;
  if (f === "monthly") return 30;
  if (f === "quarterly") return 90;
  if (f === "bi-annual" || f === "semiannual" || f === "semi-annual") return 182;
  if (f === "annual" || f === "yearly") return 365;
  return null;
}

export function addUtcDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export type InspectionFailEvidenceIssue = {
  itemId: string;
  label: string;
  missing: ("photo" | "note")[];
};

/** Fail items must have photo + note when requireFailEvidence is on. */
export function validateFailEvidence(opts: {
  requireFailEvidence: boolean;
  checklist: Array<{ id: string; label?: string; type?: string }>;
  results: Array<{
    itemId?: string;
    outcome?: string;
    note?: string;
    photoDataUrl?: string;
  }>;
}): InspectionFailEvidenceIssue[] {
  if (!opts.requireFailEvidence) return [];
  const issues: InspectionFailEvidenceIssue[] = [];
  for (const item of opts.checklist) {
    if (item.type === "text") continue;
    const res = opts.results.find((r) => r.itemId === item.id);
    if ((res?.outcome ?? "").toLowerCase() !== "fail") continue;
    const missing: ("photo" | "note")[] = [];
    if (!res?.photoDataUrl?.startsWith("data:image")) missing.push("photo");
    if (!res?.note?.trim()) missing.push("note");
    if (missing.length) {
      issues.push({ itemId: item.id, label: item.label?.trim() || item.id, missing });
    }
  }
  return issues;
}
