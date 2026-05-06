/**
 * Shared tuning values for the single-page PDF viewer (measure drafts, print bitmap, etc.).
 * Keep magic numbers here so behavior stays consistent when tuning interaction feel.
 */

/** PDF bitmap scale for print only — independent of on-screen zoom. */
export const PRINT_PDF_SCALE = 1;

/** Hit targets for dragging line-measure drafts (CSS px). */
export const MEASURE_LINE_POINT_HIT_PX = 14;
export const MEASURE_LINE_SEGMENT_HIT_PX = 10;
