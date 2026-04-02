/** Pro cloud APIs require active subscription (or trialing) */
export function isWorkspacePro(ws: { subscriptionStatus: string | null }): boolean {
  const s = ws.subscriptionStatus;
  return s === "active" || s === "trialing";
}
