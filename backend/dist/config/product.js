/** Hard cap on workspace members (all rows) for abuse prevention. */
export const MAX_WORKSPACE_MEMBERS = 250;
/** null = no project cap (unlimited projects per workspace). */
export const MAX_WORKSPACE_PROJECTS = null;
export const DEFAULT_STORAGE_QUOTA_BYTES = 10n * 1024n ** 3n; // 10 GiB
export const STORAGE_WARN_80 = 0.8;
export const STORAGE_WARN_95 = 0.95;
const INCLUDED_SEATS = {
    team: 5,
    pro: 5,
    enterprise: 10,
};
const EXTRA_SEAT_USD = {
    team: 15,
    pro: 19,
    enterprise: 25,
};
function normalizePaidBillingPlan(plan) {
    if (plan === "team" || plan === "pro" || plan === "enterprise")
        return plan;
    return null;
}
export function includedSeatsForBillingPlan(plan) {
    const p = normalizePaidBillingPlan(plan);
    if (p)
        return INCLUDED_SEATS[p];
    return INCLUDED_SEATS.pro;
}
export function extraSeatMonthlyUsdForBillingPlan(plan) {
    const p = normalizePaidBillingPlan(plan);
    if (p)
        return EXTRA_SEAT_USD[p];
    return EXTRA_SEAT_USD.team;
}
