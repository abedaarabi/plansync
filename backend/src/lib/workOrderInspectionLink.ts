/** Resolve inspection run id from Issue.sourceInspectionRunId or description metadata. */
export function resolveSourceInspectionRunId(issue: {
  sourceInspectionRunId: string | null;
  description: string | null;
}): string | null {
  if (issue.sourceInspectionRunId?.trim()) return issue.sourceInspectionRunId.trim();
  const desc = issue.description ?? "";
  const m = desc.match(/Source inspection run:\s*([^\s\n]+)/i);
  return m?.[1]?.trim() || null;
}
