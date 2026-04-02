import type { MeResponse } from "@/types/enterprise";

/** Matches backend `isWorkspacePro` — active Stripe subscription or trial. */
export function isProSubscriptionStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/** Signed-in user with at least one workspace on Pro — local PDF open in the viewer is disallowed. */
export function meHasProWorkspace(me: MeResponse | null | undefined): boolean {
  if (!me?.workspaces?.length) return false;
  return me.workspaces.some((m) => isProSubscriptionStatus(m.workspace.subscriptionStatus));
}

/**
 * Sheet-level Pro features (issues, RFIs, quantity takeoff on the drawing, etc.) are only for users
 * on a Pro workspace **and** when the PDF is opened from cloud with a file revision id. Local/blob
 * opens never set `cloudFileVersionId`, so this stays false for the free local viewer.
 */
export function viewerHasProSheetFeatures(
  me: MeResponse | null | undefined,
  cloudFileVersionId: string | null | undefined,
): boolean {
  if (!cloudFileVersionId) return false;
  return meHasProWorkspace(me);
}
