import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";
import { focusBimMarkup } from "@/components/bim-viewer/BimMarkupOverlay";
import { useBimMarkupStore } from "@/store/bimMarkupStore";

const VIEWPORT_MARKUP_GUID = "viewport-markup";

/** Fly the camera to an issue's markups, element, or world position. */
// fallow-ignore-next-line complexity
export async function focusBimIssueInViewer(
  engine: BimEngine,
  issue: IssueRow,
  opts?: { retryMs?: number },
): Promise<boolean> {
  const markupIds = issue.attachedMarkupAnnotationIds ?? [];
  if (markupIds.length > 0) {
    const linked = useBimMarkupStore.getState().annotations.filter((a) => markupIds.includes(a.id));
    if (linked.length > 0) {
      const primary = linked.find((a) => a.snapshotDataUrl) ?? linked[0]!;
      await focusBimMarkup(engine, primary);
      useBimMarkupStore.getState().setSelectedIds(markupIds);
      return true;
    }
  }

  const guid = issue.bimAnchor?.ifcGuid?.trim();
  const pos = issue.bimAnchor?.position;
  const retryMs = opts?.retryMs ?? 0;

  if (guid && guid !== VIEWPORT_MARKUP_GUID) {
    const deadline = Date.now() + retryMs;
    do {
      await engine.selectByGuids([guid], false);
      if (engine.getSelectedGuids().includes(guid)) {
        await engine.zoomToSelection();
        return true;
      }
      if (retryMs > 0) {
        await new Promise<void>((r) => window.setTimeout(r, 350));
      }
    } while (Date.now() < deadline);
  }

  if (pos) {
    await engine.zoomToWorldPoints([pos]);
    return true;
  }

  await engine.fitToView();
  return false;
}
