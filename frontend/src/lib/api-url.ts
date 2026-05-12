/**
 * When `NEXT_PUBLIC_API_URL` is set (e.g. `https://api.plansync.dev`), browser calls hit the
 * API host directly. Leave unset to use same-origin `/api/*` (Next rewrites to Hono).
 */
export function getPublicApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
}

function preferSameOriginApiInBrowser(base: string): boolean {
  if (typeof window === "undefined") return false;
  const forceDirect = (process.env.NEXT_PUBLIC_FORCE_DIRECT_API ?? "").trim().toLowerCase();
  if (forceDirect === "1" || forceDirect === "true" || forceDirect === "yes") return false;
  if (!base) return true;
  try {
    const apiHost = new URL(base).hostname.toLowerCase();
    const pageHost = window.location.hostname.toLowerCase();
    const normalize = (host: string) => host.replace(/^www\./, "").replace(/^api\./, "");
    return normalize(apiHost) === normalize(pageHost);
  } catch {
    return true;
  }
}

/** Prefix `/api/...` with the public API origin when configured. */
export function apiUrl(path: string): string {
  if (!path.startsWith("/api/")) {
    throw new Error(`apiUrl: path must start with /api/, got: ${path}`);
  }
  const base = getPublicApiBaseUrl();
  if (preferSameOriginApiInBrowser(base)) return path;
  return base ? `${base}${path}` : path;
}

/** Default Hono port in dev (`frontend` API proxy target). */
const DEFAULT_DEV_API_PORT = "8787";

/**
 * WebSocket cannot use the Next.js `/api/[[...path]]` proxy (it uses `fetch`, not an upgrade).
 * When the app is opened on localhost, connect straight to Hono on the same hostname + API port
 * so session cookies (same-site) still attach to the upgrade request.
 */
function websocketOriginInBrowser(): string | null {
  if (typeof window === "undefined") return null;

  const explicit = process.env.NEXT_PUBLIC_WS_ORIGIN?.trim();
  if (explicit) {
    try {
      const u = new URL(explicit.includes("://") ? explicit : `http://${explicit}`);
      return `${u.protocol === "https:" ? "wss:" : "ws:"}//${u.host}`;
    } catch {
      /* ignore */
    }
  }

  const { hostname, protocol } = window.location;
  const wsProto = protocol === "https:" ? "wss:" : "ws:";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const port = process.env.NEXT_PUBLIC_API_PROXY_PORT?.trim() || DEFAULT_DEV_API_PORT;
    return `${wsProto}//${hostname}:${port}`;
  }
  return null;
}

/** WebSocket URL for viewer collaboration and other WS routes. */
export function wsApiUrl(path: string): string {
  if (!path.startsWith("/api/")) {
    throw new Error(`wsApiUrl: path must start with /api/, got: ${path}`);
  }
  const base = getPublicApiBaseUrl();
  if (preferSameOriginApiInBrowser(base) && typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${path}`;
  }
  if (base) {
    const u = new URL(base);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return `${u.origin}${path}`;
  }

  const direct = websocketOriginInBrowser();
  if (direct) {
    return `${direct}${path}`;
  }

  if (typeof window === "undefined") {
    return `ws://127.0.0.1:${DEFAULT_DEV_API_PORT}${path}`;
  }

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}
