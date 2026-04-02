export type SocialProviderId = "google" | "github" | "slack";

/**
 * Which OAuth buttons to show. Defaults to all three so the sign-in page shows Google, GitHub, and Slack
 * without extra env (the API must still have matching OAuth credentials).
 * Set `NEXT_PUBLIC_SOCIAL_AUTH=none` to hide. Use `google,github` etc. to restrict.
 */
export function getEnabledSocialProviders(): SocialProviderId[] {
  const raw = process.env.NEXT_PUBLIC_SOCIAL_AUTH?.trim().toLowerCase();
  if (raw === "none" || raw === "false" || raw === "0") return [];
  if (!raw) return ["google", "github", "slack"];
  const allowed = new Set<SocialProviderId>(["google", "github", "slack"]);
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SocialProviderId => allowed.has(s as SocialProviderId));
}
