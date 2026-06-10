function looksLikeStripeApiKey(id: string): boolean {
  const lower = id.slice(0, 3).toLowerCase();
  return lower === "sk_" || lower === "rk_" || id.startsWith("pk_");
}

function stripePriceIdErrorMessage(
  envVarName: string,
  autoCreateHint: string,
  isApiKey: boolean,
): string {
  if (isApiKey) {
    return `${envVarName} must be a Price id (price_… from Stripe Dashboard), not an API key. Put sk_test_… / sk_live_… only in STRIPE_SECRET_KEY. Or remove ${envVarName} to ${autoCreateHint}.`;
  }
  return `${envVarName} should look like price_xxxxxxxx (Product catalog → your price). Remove it to ${autoCreateHint}.`;
}

export function assertLooksLikeStripePriceId(
  id: string,
  envVarName: string,
  autoCreateHint: string,
): void {
  if (id.startsWith("price_")) return;
  throw new Error(stripePriceIdErrorMessage(envVarName, autoCreateHint, looksLikeStripeApiKey(id)));
}
