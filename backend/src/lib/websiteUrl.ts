/**
 * Normalize and validate a user-entered website URL for storage.
 * Returns null if empty or invalid.
 */
export function normalizeWebsiteUrl(input: string | undefined | null): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname) return null;
  return u.href;
}

/** Public favicon URL for a normalized website URL (hostname-based). */
export function logoUrlFromWebsiteUrl(websiteUrl: string | null): string | null {
  if (!websiteUrl) return null;
  try {
    const u = new URL(websiteUrl);
    const host = u.hostname;
    if (!host) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch {
    return null;
  }
}
