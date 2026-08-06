import type { MeResponse } from "@/types/enterprise";
import {
  isWorkspaceProClient,
  isWorkspaceProPlusClient,
  type WorkspaceProFields,
} from "@/lib/workspaceSubscription";

/** Signed-in user with at least one paid cloud workspace — local PDF open in the viewer is disallowed. */
export function meHasProWorkspace(me: MeResponse | null | undefined): boolean {
  if (!me?.workspaces?.length) return false;
  return me.workspaces.some((m) => isWorkspaceProClient(m.workspace));
}

/** At least one workspace on Pro or Enterprise (not Team-only). */
function meHasProPlusWorkspace(me: MeResponse | null | undefined): boolean {
  if (!me?.workspaces?.length) return false;
  return me.workspaces.some((m) => isWorkspaceProPlusClient(m.workspace));
}

/**
 * Sheet-level Team+ features (issues, RFIs, collab) when the PDF is opened from cloud.
 * Local/blob opens never set `cloudFileVersionId`, so this stays false for the free local viewer.
 */
export function viewerHasProSheetFeatures(
  me: MeResponse | null | undefined,
  cloudFileVersionId: string | null | undefined,
): boolean {
  if (!cloudFileVersionId) return false;
  return meHasProWorkspace(me);
}

/**
 * Sheet takeoff (and similar Pro+ tools) — requires Pro/Enterprise, not Team.
 */
export function viewerHasProPlusSheetFeatures(
  me: MeResponse | null | undefined,
  cloudFileVersionId: string | null | undefined,
): boolean {
  if (!cloudFileVersionId) return false;
  return meHasProPlusWorkspace(me);
}
