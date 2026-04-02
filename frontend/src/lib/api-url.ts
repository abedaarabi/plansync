/**
 * When `NEXT_PUBLIC_API_URL` is set (e.g. `https://api.plansync.dev`), browser calls hit the
 * API host directly. Leave unset to use same-origin `/api/*` (Next rewrites to Hono).
 */
export function getPublicApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
}

/** Prefix `/api/...` with the public API origin when configured. */
export function apiUrl(path: string): string {
  if (!path.startsWith("/api/")) {
    throw new Error(`apiUrl: path must start with /api/, got: ${path}`);
  }
  const base = getPublicApiBaseUrl();
  return base ? `${base}${path}` : path;
}
