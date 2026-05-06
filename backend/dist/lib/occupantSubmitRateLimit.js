/** Simple in-memory rate limit for unauthenticated occupant POST (per process). */
const buckets = new Map();
const WINDOW_MS = 60_000;
/** Max submissions per portal token + IP per window. */
const MAX_SUBMITS = 12;
export function occupantSubmitRateLimited(portalToken, clientIp) {
    const ip = (clientIp && clientIp.trim()) || "unknown";
    const key = `${portalToken.slice(0, 16)}:${ip}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
        b = { count: 0, resetAt: now + WINDOW_MS };
        buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > MAX_SUBMITS)
        return true;
    return false;
}
