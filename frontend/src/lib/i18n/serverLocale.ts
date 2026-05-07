import { cookies, headers } from "next/headers";
import type { AppLocale } from "./config";
import { DEFAULT_LOCALE, LOCALE_COOKIE, coerceLocale, isAppLocale } from "./config";
import { MW_LOCALE } from "./resolveInitialLocale";

/**
 * Resolve locale for RSC.
 * Prefer `NEXT_LOCALE` cookie (explicit user choice via `/api/locale`) over the proxy header
 * so the UI never sticks on a stale `x-plansync-locale` value.
 */
export async function getAppLocale(): Promise<AppLocale> {
  const raw = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (raw) {
    const c = coerceLocale(raw);
    if (isAppLocale(c)) return c;
  }
  const h = await headers();
  const fromMw = h.get(MW_LOCALE);
  if (fromMw && isAppLocale(fromMw)) return fromMw;
  return DEFAULT_LOCALE;
}
