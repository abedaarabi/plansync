import { createHash, randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";

const WINDOW_MS = 60_000;
/** Max submissions per portal token + IP per window. */
const MAX_SUBMITS = 12;

function hashValue(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function currentWindowStart(): Date {
  return new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);
}

/**
 * Distributed rate limit for unauthenticated occupant POST.
 * Buckets are persisted per workspace + portal token hash + client IP hash + minute window.
 */
export async function occupantSubmitRateLimited(
  workspaceId: string,
  portalToken: string,
  clientIp: string | undefined,
): Promise<boolean> {
  const ip = (clientIp && clientIp.trim()) || "unknown";
  const portalTokenHash = hashValue(portalToken);
  const clientIpHash = hashValue(ip);
  const windowStart = currentWindowStart();

  const rowId = randomUUID();
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "OccupantSubmitRateLimit"
      ("id", "workspaceId", "portalTokenHash", "clientIpHash", "windowStart", "count", "createdAt", "updatedAt")
    VALUES
      (${rowId}, ${workspaceId}, ${portalTokenHash}, ${clientIpHash}, ${windowStart}, 1, now(), now())
    ON CONFLICT ("workspaceId", "portalTokenHash", "clientIpHash", "windowStart")
    DO UPDATE SET
      "count" = "OccupantSubmitRateLimit"."count" + 1,
      "updatedAt" = now()
    RETURNING "count";
  `;

  const count = rows[0]?.count ?? 0;
  return count > MAX_SUBMITS;
}
