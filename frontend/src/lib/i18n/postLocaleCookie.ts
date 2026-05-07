import { NextResponse } from "next/server";
import { LOCALE_COOKIE, APP_LOCALES, coerceLocale, isAppLocale } from "./config";

/** Shared handler: set `NEXT_LOCALE` from JSON `{ locale }`. */
export async function postLocaleCookie(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const loc =
    typeof body === "object" && body && "locale" in body
      ? (body as { locale?: string }).locale
      : undefined;
  if (!loc) return NextResponse.json({ error: "missing_locale" }, { status: 400 });
  const normalized = coerceLocale(loc);
  if (!isAppLocale(normalized) || !(APP_LOCALES as readonly string[]).includes(normalized)) {
    return NextResponse.json({ error: "unsupported_locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale: normalized });
  res.cookies.set(LOCALE_COOKIE, normalized, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
