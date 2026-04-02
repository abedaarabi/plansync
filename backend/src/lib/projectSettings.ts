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
] as const;

export type ProjectCurrencyCode = (typeof PROJECT_CURRENCY_CODES)[number];

export function parseProjectCurrency(raw: unknown): ProjectCurrencyCode | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return (PROJECT_CURRENCY_CODES as readonly string[]).includes(c)
    ? (c as ProjectCurrencyCode)
    : null;
}
