/** Matches backend `isWorkspacePro` — Pro APIs allow `active` or `trialing`. */
export function isWorkspaceProClient(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/** Whole days remaining in trial, clamped at 0. Returns null for invalid/missing dates. */
export function trialDaysLeft(currentPeriodEnd: string | Date | null | undefined): number | null {
  if (!currentPeriodEnd) return null;
  const endMs = new Date(currentPeriodEnd).getTime();
  if (!Number.isFinite(endMs)) return null;
  const diff = endMs - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}
