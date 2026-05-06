/**
 * Barrel for the single-page viewer. Implementation lives in `./pdf-page-view/` (split for
 * maintainability — helpers, snap logic, and dimension SVG are separate modules).
 */
export { PdfPageView } from "./pdf-page-view/PdfPageView";
export type { PdfPageViewProps } from "./pdf-page-view/types";
