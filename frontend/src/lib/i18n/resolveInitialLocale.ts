import type { NextRequest } from "next/server";
import type { AppLocale } from "./config";
import { DEFAULT_LOCALE, LOCALE_COOKIE, coerceLocale, isAppLocale } from "./config";

const MW_LOCALE = "x-plansync-locale";

function fromLanguageTag(tag: string): AppLocale | null {
  const base = tag.split("-")[0]?.toLowerCase();
  if (!base) return null;
  if (base === "zh") return "zh-CN";
  if (base === "da") return "da";
  if (base === "ar") return "ar";
  if (base === "fr") return "fr";
  if (base === "es") return "es";
  if (base === "en") return "en";
  return null;
}

function fromCountry(country: string | null | undefined): AppLocale | null {
  if (!country) return null;
  const c = country.toUpperCase();
  if (c === "DK") return "da";
  if (c === "FR" || c === "BE" || c === "CH") return "fr";
  if (c === "ES" || c === "MX" || c === "AR" || c === "CO" || c === "CL") return "es";
  if (
    c === "SA" ||
    c === "AE" ||
    c === "EG" ||
    c === "MA" ||
    c === "DZ" ||
    c === "IQ" ||
    c === "JO" ||
    c === "LB"
  )
    return "ar";
  if (c === "CN" || c === "SG") return "zh-CN";
  return null;
}

export function resolveInitialLocale(request: NextRequest): AppLocale {
  const accept = request.headers.get("accept-language");
  if (accept) {
    const parts = accept.split(",").map((p) => p.trim().split(";")[0]?.trim() ?? "");
    for (const raw of parts) {
      const loc = fromLanguageTag(raw);
      if (loc) return loc;
    }
  }

  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-geo-country");
  const geo = fromCountry(country);
  if (geo) return geo;

  return DEFAULT_LOCALE;
}

/** Locale for this request: saved cookie wins; else Accept-Language + optional geo. */
export function readResolvedLocaleFromRequest(request: NextRequest): AppLocale {
  const raw = request.cookies.get(LOCALE_COOKIE)?.value;
  if (raw) {
    const c = coerceLocale(raw);
    if (isAppLocale(c)) return c;
  }
  return resolveInitialLocale(request);
}

export { MW_LOCALE };
