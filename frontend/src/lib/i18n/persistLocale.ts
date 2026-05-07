/** Persist locale via `POST /api/i18n/locale` (sets `NEXT_LOCALE`). Reload after success so the cookie is applied reliably. */
export async function persistAppLocale(locale: string): Promise<boolean> {
  const res = await fetch("/api/i18n/locale", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  return res.ok;
}
