/** Keep in sync with `backend/src/lib/projectSettings.ts` — accepted API values. */
const PROJECT_CURRENCY_CODES = [
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

export function normalizeProjectCurrency(code: unknown): ProjectCurrencyCode {
  if (typeof code === "string") {
    const normalized = code.trim().toUpperCase();
    if ((PROJECT_CURRENCY_CODES as readonly string[]).includes(normalized)) {
      return normalized as ProjectCurrencyCode;
    }
  }
  return "USD";
}

/** Display metadata for the currency picker (symbols are typical; formatting uses project locale elsewhere). */
export const PROJECT_CURRENCIES: {
  code: ProjectCurrencyCode;
  label: string;
  symbol: string;
  /** Slightly larger tiles first */
  popular?: boolean;
}[] = [
  { code: "USD", label: "US dollar", symbol: "$", popular: true },
  { code: "EUR", label: "Euro", symbol: "€", popular: true },
  { code: "GBP", label: "Pound sterling", symbol: "£", popular: true },
  { code: "DKK", label: "Danish krone", symbol: "kr.", popular: true },
  { code: "SEK", label: "Swedish krona", symbol: "kr", popular: true },
  { code: "NOK", label: "Norwegian krone", symbol: "kr", popular: true },
  { code: "CHF", label: "Swiss franc", symbol: "CHF" },
  { code: "PLN", label: "Polish złoty", symbol: "zł" },
  { code: "CZK", label: "Czech koruna", symbol: "Kč" },
  { code: "CAD", label: "Canadian dollar", symbol: "$" },
  { code: "AUD", label: "Australian dollar", symbol: "$" },
  { code: "NZD", label: "NZ dollar", symbol: "$" },
  { code: "JPY", label: "Japanese yen", symbol: "¥" },
  { code: "CNY", label: "Chinese yuan", symbol: "¥" },
  { code: "HKD", label: "Hong Kong dollar", symbol: "$" },
  { code: "SGD", label: "Singapore dollar", symbol: "$" },
  { code: "INR", label: "Indian rupee", symbol: "₹" },
  { code: "AED", label: "UAE dirham", symbol: "د.إ" },
  { code: "SAR", label: "Saudi riyal", symbol: "﷼" },
  { code: "BRL", label: "Brazilian real", symbol: "R$" },
  { code: "MXN", label: "Mexican peso", symbol: "$" },
  { code: "ZAR", label: "South African rand", symbol: "R" },
  { code: "TRY", label: "Turkish lira", symbol: "₺" },
  { code: "KRW", label: "Korean won", symbol: "₩" },
];

export function formatProjectCurrencyLabel(code: string): string {
  const row = PROJECT_CURRENCIES.find((c) => c.code === code);
  return row ? `${row.code} · ${row.label}` : code;
}

/** Shared money display for proposals, takeoffs, dashboards (display-only; no FX). */
export function formatProjectMoney(
  amount: string | number | null | undefined,
  currency: string,
): string {
  if (amount == null) return "—";
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return typeof amount === "string" ? amount : "—";
  const code = normalizeProjectCurrency(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
}
