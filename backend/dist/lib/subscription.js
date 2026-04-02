/** Pro cloud APIs require active subscription (or trialing) */
export function isWorkspacePro(ws) {
    const s = ws.subscriptionStatus;
    return s === "active" || s === "trialing";
}
