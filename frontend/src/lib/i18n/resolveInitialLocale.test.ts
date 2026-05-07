import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE } from "./config";
import { readResolvedLocaleFromRequest, resolveInitialLocale } from "./resolveInitialLocale";

function makeRequest(opts: {
  cookieLocale?: string;
  acceptLanguage?: string | null;
  country?: string | null;
}): NextRequest {
  return {
    headers: {
      get(name: string) {
        if (name === "accept-language") return opts.acceptLanguage ?? null;
        if (name === "x-vercel-ip-country") return opts.country ?? null;
        return null;
      },
    },
    cookies: {
      get(name: string) {
        if (name === LOCALE_COOKIE && opts.cookieLocale)
          return { name: LOCALE_COOKIE, value: opts.cookieLocale };
        return undefined;
      },
    },
  } as unknown as NextRequest;
}

describe("readResolvedLocaleFromRequest", () => {
  it("prefers saved cookie over Accept-Language", () => {
    const r = makeRequest({
      cookieLocale: "fr",
      acceptLanguage: "da,en;q=0.8",
    });
    expect(readResolvedLocaleFromRequest(r)).toBe("fr");
  });

  it("uses Accept-Language when cookie absent", () => {
    const r = makeRequest({ acceptLanguage: "da-DK,en;q=0.5" });
    expect(readResolvedLocaleFromRequest(r)).toBe("da");
  });

  it("uses geo only as fallback", () => {
    const r = makeRequest({ country: "DK" });
    expect(readResolvedLocaleFromRequest(r)).toBe("da");
  });
});

describe("resolveInitialLocale", () => {
  it("defaults without hints", () => {
    const r = makeRequest({});
    expect(resolveInitialLocale(r)).toBe("en");
  });
});
