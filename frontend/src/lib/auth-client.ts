import { createAuthClient } from "better-auth/react";
import { getPublicApiBaseUrl } from "@/lib/api-url";

/**
 * In the browser, always use the **page** origin for `/api/auth/*` so session cookies are set for
 * `plansync.dev` (full-page navigations like `/dashboard` send them). If `NEXT_PUBLIC_API_URL` points
 * at another host, REST calls still use `apiUrl()` — set `BETTER_AUTH_COOKIE_DOMAIN` to the parent
 * domain so those requests include the session cookie.
 */
function resolveAuthBaseURL(): string {
  if (typeof window !== "undefined") return window.location.origin;
  const api = getPublicApiBaseUrl();
  if (api) return api;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseURL(),
});
