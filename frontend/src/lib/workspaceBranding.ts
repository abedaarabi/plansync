/** Client-side website validation + favicon preview (must stay aligned with backend `workspaceBranding.ts`). */

export function isGoogleFaviconUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "www.google.com" && u.pathname.includes("/s2/favicons");
  } catch {
    return false;
  }
}

export function faviconUrlFromHostname(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname.toLowerCase())}&sz=128`;
}

export function normalizeWorkspaceWebsite(
  input: string,
): { ok: true; url: string; hostname: string } | { ok: false; message: string } {
  const t = input.trim();
  if (!t) return { ok: false, message: "Enter a website URL" };
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

/** Same-origin path returned by the API for an uploaded workspace logo (not a user override URL). */
export function isWorkspaceHostedLogoPath(url: string | null | undefined): boolean {
  const t = url?.trim() ?? "";
  return t.startsWith("/api/v1/public/workspaces/") && t.endsWith("/logo");
}
