/**
 * Autodesk-viewer-style chrome for the ThatOpen measurement tools.
 *
 * The library builds dimension labels and endpoint markers as bare `div`s with
 * inline styles, so appearance can only be changed from the outside: endpoints
 * through the public `linesEndpointElement` setter, labels by tagging the CSS2D
 * nodes as they mount so `globals.css` can restyle them.
 */

const LABEL_CLASS = "bim-measure-label";

/** Added to a label chip while its measurement is click-selected. */
export const MEASURE_LABEL_SELECTED_CLASS = "bim-measure-label--selected";

/**
 * App chrome blue (`--bim-accent` / `#2563EB`). Kept separate from
 * `BIM_ACCENT` (`#3B82F6`) so measure lines match UI buttons and rails.
 */
export const MEASURE_ACCENT = "#2563EB";

/** Screen-pixel width for fat measurement lines. */
export const MEASURE_LINE_WIDTH = 3.5;

/** Round endpoint dot; the tools tint its border with the measurement color. */
export function createMeasureEndpointElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "bim-measure-endpoint";
  return el;
}

/** Library labels are the only unclassed, text-bearing divs in the CSS2D layer. */
function tagIfMeasureLabel(el: HTMLElement): void {
  if (el.tagName !== "DIV" || el.className !== "") return;
  if (!el.textContent?.trim()) return;
  el.classList.add(LABEL_CLASS);
}

function tagMeasureLabels(root: HTMLElement): void {
  tagIfMeasureLabel(root);
  for (const el of root.querySelectorAll<HTMLElement>("div:not([class])")) {
    tagIfMeasureLabel(el);
  }
}

/** Tags measurement labels as they mount into the CSS2D layer. Returns a disposer. */
export function observeMeasurementLabels(css2dRoot: HTMLElement): () => void {
  tagMeasureLabels(css2dRoot);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement) tagMeasureLabels(node);
      }
    }
  });
  observer.observe(css2dRoot, { childList: true, subtree: true });
  return () => observer.disconnect();
}
