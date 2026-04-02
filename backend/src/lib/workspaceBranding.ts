/** Workspace website + favicon helpers (no outbound fetch — favicon URL uses Google’s public resolver). */

const GOOGLE_FAVICON = "https://www.google.com/s2/favicons";

export function faviconUrlFromHostname(hostname: string): string {
  return `${GOOGLE_FAVICON}?domain=${encodeURIComponent(hostname.toLowerCase())}&sz=128`;
}

export function isGoogleFaviconUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "www.google.com" && u.pathname.includes("/s2/favicons");
  } catch {
    return false;
  }
}

export function normalizeWorkspaceWebsite(
  input: string,
): { ok: true; url: string; hostname: string } | { ok: false; message: string } {
  const t = input.trim();
  if (!t) return { ok: false, message: "Website cannot be empty" };
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    return { ok: false, message: "Enter a valid website URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, message: "Use http or https" };
  }
  const hostname = u.hostname.toLowerCase();
  if (!hostname) return { ok: false, message: "Invalid website" };
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { ok: false, message: "Use a public website address" };
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return { ok: false, message: "Use a domain name, not an IP address" };
  }

  let url = u.href;
  if (u.pathname === "/" && !u.search && !u.hash) {
    url = u.origin;
  }
  return { ok: true, url, hostname };
}
