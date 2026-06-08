/** Shared mobile-first form field classes (16px min, 48px touch height). */
export const MOBILE_FIELD_LABEL =
  "mb-1.5 block text-sm font-medium leading-snug text-[var(--enterprise-text)]";

export const MOBILE_FIELD_INPUT =
  "mt-0 w-full min-h-12 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3 text-base leading-normal text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition-all duration-150 placeholder:text-[var(--enterprise-text-muted)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20";

export const MOBILE_FIELD_TEXTAREA = `${MOBILE_FIELD_INPUT} min-h-[7rem] resize-y`;

export const MOBILE_FIELD_SELECT = MOBILE_FIELD_INPUT;

export const MOBILE_FORM_SECTION =
  "space-y-4 rounded-2xl border border-[var(--enterprise-border)]/80 bg-[var(--enterprise-hover-surface)]/40 p-4";
