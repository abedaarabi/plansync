/**
 * Shared HTTP helpers for the API client.
 *
 * Keep this file intentionally small: helpers here must stay generic and
 * side-effect free so every domain endpoint can reuse them safely.
 */
export const jsonHeaders = { "Content-Type": "application/json" };

export async function readJsonOrEmpty(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export function readJsonErrorBody(
  j: Record<string, unknown>,
  res: Response,
  fallback: string,
): string {
  const err = j.error;
  if (typeof err === "string" && err.trim()) return err;
  const msg = j.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  return `${fallback} (HTTP ${res.status})`;
}
