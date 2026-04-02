import { createTakeoffLine, ProRequiredError } from "@/lib/api-client";
import type { TakeoffItem, TakeoffZone } from "@/lib/takeoffTypes";
import { useViewerStore } from "@/store/viewerStore";
import { toast } from "sonner";

/** Same tab / other tabs: enterprise takeoff list uses a different React Query tree than the viewer. */
export const PROJECT_TAKEOFF_INVALIDATE_CHANNEL = "plansync-invalidate-project-takeoff";

function notifyProjectTakeoffCaches(projectId: string | null) {
  if (!projectId || typeof BroadcastChannel === "undefined") return;
  try {
    const bc = new BroadcastChannel(PROJECT_TAKEOFF_INVALIDATE_CHANNEL);
    bc.postMessage({ projectId });
    bc.close();
  } catch {
    /* ignore */
  }
}

/** Push one zone row to project takeoff lines (upserts by sourceZoneId). Fire-and-forget. */
export function publishTakeoffZoneToProjectLine(
  fileVersionId: string,
  item: TakeoffItem,
  zone: TakeoffZone,
): void {
  void createTakeoffLine(fileVersionId, {
    label: item.name,
    quantity: zone.computedQuantity,
    unit: item.unit,
    notes: zone.notes?.trim() || item.notes?.trim() || undefined,
    materialId: item.materialId ?? undefined,
    sourceZoneId: zone.id,
    tags: zone.tags?.length ? zone.tags : undefined,
  })
    .then(() => {
      notifyProjectTakeoffCaches(useViewerStore.getState().viewerProjectId);
    })
    .catch((err) => {
      if (err instanceof ProRequiredError) return;
      const msg = err instanceof Error ? err.message : "Could not sync line to project takeoff.";
      toast.error(msg.includes("locked") ? "Sheet is locked by another user." : msg);
    });
}
