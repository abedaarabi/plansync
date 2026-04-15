/** PlanSync Pro / Enterprise — internal seats included in base monthly price */
export const PRO_INCLUDED_SEATS = 5;
/** USD charged per additional internal seat / month (billing policy; Stripe catalog configured separately). */
export const EXTRA_SEAT_MONTHLY_USD = 9;
/**
 * Hard cap on workspace members (all rows) for abuse prevention.
 * Invites are allowed past `PRO_INCLUDED_SEATS`; overage is billed per `EXTRA_SEAT_MONTHLY_USD`.
 */
export const MAX_WORKSPACE_MEMBERS = 250;
/** null = no project cap (unlimited projects per workspace). */
export const MAX_WORKSPACE_PROJECTS: number | null = null;
export const DEFAULT_STORAGE_QUOTA_BYTES = 10n * 1024n ** 3n; // 10 GiB
export const STORAGE_WARN_80 = 0.8;
export const STORAGE_WARN_95 = 0.95;
export const LOCK_TTL_MS = 5 * 60 * 1000; // 5 min sheet lock
