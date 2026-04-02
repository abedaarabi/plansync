export type SocialProviderId = "google";

/**
 * Which OAuth buttons to show. Defaults to Google only.
 * Set `NEXT_PUBLIC_SOCIAL_AUTH=none` to hide social buttons entirely.
 */
export function getEnabledSocialProviders(): SocialProviderId[] {
  const raw = process.env.NEXT_PUBLIC_SOCIAL_AUTH?.trim().toLowerCase();
  if (raw === "none" || raw === "false" || raw === "0") return [];
  if (!raw) return ["google"];
  const allowed = new Set<SocialProviderId>(["google"]);
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SocialProviderId => allowed.has(s as SocialProviderId));
}
