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
