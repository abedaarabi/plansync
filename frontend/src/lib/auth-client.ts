import { createAuthClient } from "better-auth/react";
import { getPublicApiBaseUrl } from "@/lib/api-url";

/**
 * Must match `apiUrl()` / `NEXT_PUBLIC_API_URL`: if the app calls `https://api.example.com/api/v1/...`,
 * Better Auth must hit the same host so session cookies are stored and sent with those requests.
 */
function resolveAuthBaseURL(): string {
  const api = getPublicApiBaseUrl();
  if (api) return api;
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseURL(),
});
