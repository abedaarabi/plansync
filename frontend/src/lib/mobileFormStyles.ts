/** Shared mobile-first form field classes (16px min, 48px touch height). */
export const MOBILE_FIELD_LABEL =
  "enterprise-field-label mb-1.5 text-sm font-medium leading-snug text-[var(--enterprise-text)]";

export const MOBILE_FIELD_INPUT =
  "enterprise-field-input mt-0 min-h-12 px-4 py-3 text-base leading-normal";

export const MOBILE_FIELD_TEXTAREA = `${MOBILE_FIELD_INPUT} min-h-[7rem] resize-y`;

export const MOBILE_FIELD_SELECT = MOBILE_FIELD_INPUT;

export const MOBILE_FORM_SECTION =
  "space-y-4 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]/50 p-4";
