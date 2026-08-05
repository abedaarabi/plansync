import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";
import { focusBimMarkup } from "@/components/bim-viewer/BimMarkupOverlay";
import { useBimMarkupStore } from "@/store/bimMarkupStore";

const VIEWPORT_MARKUP_GUID = "viewport-markup";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

/** Ghost the model and color clash pair green/red from stored bimAnchor guids. */
async function presentStoredClashPair(
  engine: BimEngine,
  issue: IssueRow,
  retryMs: number,
): Promise<boolean> {
  const anchor = issue.bimAnchor;
  const guidA = anchor?.ifcGuid?.trim();
  const guidB = anchor?.ifcGuidB?.trim();
  if (!guidA || !guidB || guidA === VIEWPORT_MARKUP_GUID) return false;

  const deadline = Date.now() + retryMs;
  let attempt = 0;
  do {
    await engine.presentClashPartners({
      a: { guid: guidA, fileVersionId: anchor?.fileVersionId ?? issue.fileVersionId },
      b: { guid: guidB, fileVersionId: anchor?.fileVersionIdB ?? undefined },
      point: anchor?.position ?? null,
      context: "ghost",
      refocusCamera: attempt === 0 || Date.now() + 400 > deadline,
    });
    // Require both partners — green-only used to short-circuit before model B loaded.
    if (engine.hasBothClashPartnerColors()) return true;
    attempt += 1;
    if (retryMs > 0) await sleep(350);
  } while (Date.now() < deadline);

  return engine.hasBothClashPartnerColors();
}

/** Fly the camera to an issue's markups, clash pair, element, or world position. */
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

  const retryMs = opts?.retryMs ?? 0;

  // Clash-promoted issues: both guids are on bimAnchor — present ghost + pair colors.
  // Do not fall through to single-guid select (that clears the pair and leaves only green).
  if (issue.bimAnchor?.ifcGuidB?.trim()) {
    const ok = await presentStoredClashPair(engine, issue, retryMs || 8_000);
    if (ok) return true;
    if (engine.hasClashPairColors()) {
      // Partner model may still be streaming — keep partial paint and signal retry.
      return false;
    }
    const clashPos = issue.bimAnchor.position;
    if (clashPos) {
      await engine.zoomToWorldPoints([clashPos]);
    }
    return false;
  }

  const guid = issue.bimAnchor?.ifcGuid?.trim();
  const pos = issue.bimAnchor?.position;

  if (guid && guid !== VIEWPORT_MARKUP_GUID) {
    const deadline = Date.now() + retryMs;
    do {
      await engine.selectByGuids([guid], false);
      if (engine.getSelectedGuids().includes(guid)) {
        await engine.zoomToSelection();
        return true;
      }
      if (retryMs > 0) await sleep(350);
    } while (Date.now() < deadline);
  }

  if (pos) {
    await engine.zoomToWorldPoints([pos]);
    return true;
  }

  await engine.fitToView();
  return false;
}
