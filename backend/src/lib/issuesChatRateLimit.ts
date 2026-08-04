/** In-memory limiter for authenticated project Issues chat (per process). */
const WINDOW_MS = 10 * 60_000;
const MAX_REQUESTS = 40;

const hitsByUser = new Map<string, number[]>();

function prune(now: number, stamps: number[]): number[] {
  return stamps.filter((t) => now - t < WINDOW_MS);
}

export function issuesChatRateLimited(userId: string): boolean {
  const key = userId?.trim() || "unknown";
  const now = Date.now();
  const prev = prune(now, hitsByUser.get(key) ?? []);
  if (prev.length >= MAX_REQUESTS) {
    hitsByUser.set(key, prev);
    return true;
  }
  prev.push(now);
  hitsByUser.set(key, prev);
  return false;
}
