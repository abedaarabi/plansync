/** ISO 4217 codes accepted for `Project.currency` (common construction / international). */
export const PROJECT_CURRENCY_CODES = [
    "USD",
    "EUR",
    "GBP",
    "DKK",
    "SEK",
    "NOK",
    "CHF",
    "PLN",
    "CZK",
    "CAD",
    "AUD",
    "NZD",
    "JPY",
    "CNY",
    "HKD",
    "SGD",
    "INR",
    "AED",
    "SAR",
    "BRL",
    "MXN",
    "ZAR",
    "TRY",
    "KRW",
];
export function parseProjectCurrency(raw) {
    if (typeof raw !== "string")
        return null;
    const c = raw.trim().toUpperCase();
    return PROJECT_CURRENCY_CODES.includes(c)
        ? c
        : null;
}
const DEFAULT_MODULES = {
    issues: true,
    rfis: true,
    takeoff: true,
    proposals: true,
    punch: true,
    fieldReports: true,
};
const DEFAULT_CLIENT_VISIBILITY = {
    showIssues: true,
    showRfis: true,
    showFieldReports: true,
    showPunchList: true,
    allowClientComment: false,
};
export function parseProjectSettingsJson(raw) {
    if (raw == null || typeof raw !== "object") {
        return { modules: { ...DEFAULT_MODULES }, clientVisibility: { ...DEFAULT_CLIENT_VISIBILITY } };
    }
    const o = raw;
    const m = o.modules && typeof o.modules === "object" ? o.modules : {};
    const c = o.clientVisibility && typeof o.clientVisibility === "object"
        ? o.clientVisibility
        : {};
    return {
        modules: {
            issues: typeof m.issues === "boolean" ? m.issues : DEFAULT_MODULES.issues,
            rfis: typeof m.rfis === "boolean" ? m.rfis : DEFAULT_MODULES.rfis,
            takeoff: typeof m.takeoff === "boolean" ? m.takeoff : DEFAULT_MODULES.takeoff,
            proposals: typeof m.proposals === "boolean" ? m.proposals : DEFAULT_MODULES.proposals,
            punch: typeof m.punch === "boolean" ? m.punch : DEFAULT_MODULES.punch,
            fieldReports: typeof m.fieldReports === "boolean" ? m.fieldReports : DEFAULT_MODULES.fieldReports,
        },
        clientVisibility: {
            showIssues: typeof c.showIssues === "boolean" ? c.showIssues : DEFAULT_CLIENT_VISIBILITY.showIssues,
            showRfis: typeof c.showRfis === "boolean" ? c.showRfis : DEFAULT_CLIENT_VISIBILITY.showRfis,
            showFieldReports: typeof c.showFieldReports === "boolean"
                ? c.showFieldReports
                : DEFAULT_CLIENT_VISIBILITY.showFieldReports,
            showPunchList: typeof c.showPunchList === "boolean"
                ? c.showPunchList
                : DEFAULT_CLIENT_VISIBILITY.showPunchList,
            allowClientComment: typeof c.allowClientComment === "boolean"
                ? c.allowClientComment
                : DEFAULT_CLIENT_VISIBILITY.allowClientComment,
        },
    };
}
export function mergeProjectSettingsPatch(current, patch) {
    return {
        modules: { ...current.modules, ...patch.modules },
        clientVisibility: { ...current.clientVisibility, ...patch.clientVisibility },
    };
}
