/**
 * Pro plan list price (USD / month). Keep in sync with backend `stripeProPrice.ts`
 * (`PRO_PLAN_MONTHLY_USD` / `PRO_PLAN_MONTHLY_UNIT_AMOUNT`).
 */
export const PRO_MONTHLY_PRICE_USD = 49;

/**
 * Internal seats included in base Pro / Enterprise price. Keep in sync with
 * `backend/src/config/product.ts` (`PRO_INCLUDED_SEATS`).
 */
export const PRO_INCLUDED_SEATS = 5;

/**
 * USD per additional internal seat / month after included seats. Keep in sync with
 * `backend/src/config/product.ts` (`EXTRA_SEAT_MONTHLY_USD`).
 */
export const EXTRA_SEAT_MONTHLY_USD = 9;

/**
 * Enterprise plan (USD / month) — includes Operations & Maintenance. Keep in sync with
 * `backend/src/lib/stripeEnterprisePrice.ts`.
 */
export const ENTERPRISE_MONTHLY_PRICE_USD = 99;
