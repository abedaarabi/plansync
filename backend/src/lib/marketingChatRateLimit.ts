/** In-memory limiter for unauthenticated marketing chat (per process). */
const WINDOW_MS = 15 * 60_000;
const MAX_REQUESTS = 24;

const hitsByIp = new Map<string, number[]>();

function prune(now: number, stamps: number[]): number[] {
  return stamps.filter((t) => now - t < WINDOW_MS);
}

export function marketingChatRateLimited(clientIp: string): boolean {
  const key = clientIp?.trim() || "unknown";
  const now = Date.now();
  const prev = prune(now, hitsByIp.get(key) ?? []);
  if (prev.length >= MAX_REQUESTS) {
    hitsByIp.set(key, prev);
    return true;
  }
  prev.push(now);
  hitsByIp.set(key, prev);
  return false;
}
