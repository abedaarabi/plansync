import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Env } from "./env.js";

export type CloudOAuthProvider = "google" | "microsoft" | "dropbox";

export type CloudOAuthStatePayload = {
  userId: string;
  ts: number;
  nonce: string;
  provider: CloudOAuthProvider;
  /** Safe in-app path only (e.g. /dashboard/...). */
  returnTo: string | null;
};

const MAX_AGE_MS = 15 * 60 * 1000;

function hmac(env: Env, data: Buffer): Buffer {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(data).digest();
}

export function signCloudOAuthState(env: Env, payload: CloudOAuthStatePayload): string {
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const sig = hmac(env, raw);
  return `${raw.toString("base64url")}.${sig.toString("base64url")}`;
}

export function verifyCloudOAuthState(env: Env, token: string): CloudOAuthStatePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [rawB64, sigB64] = parts;
  if (!rawB64 || !sigB64) return null;
  let raw: Buffer;
  let sig: Buffer;
  try {
    raw = Buffer.from(rawB64, "base64url");
    sig = Buffer.from(sigB64, "base64url");
  } catch {
    return null;
  }
  const expect = hmac(env, raw);
  if (expect.length !== sig.length || !timingSafeEqual(expect, sig)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (
    typeof o.userId !== "string" ||
    typeof o.ts !== "number" ||
    typeof o.nonce !== "string" ||
    typeof o.provider !== "string"
  ) {
    return null;
  }
  if (!["google", "microsoft", "dropbox"].includes(o.provider)) return null;
  if (Date.now() - o.ts > MAX_AGE_MS) return null;
  const returnTo =
    o.returnTo === null || o.returnTo === undefined
      ? null
      : typeof o.returnTo === "string"
        ? o.returnTo
        : null;
  if (returnTo != null) {
    if (!returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.length > 2048) {
      return null;
    }
  }
  return {
    userId: o.userId,
    ts: o.ts,
    nonce: o.nonce,
    provider: o.provider as CloudOAuthProvider,
    returnTo,
  };
}

export function newOAuthNonce(): string {
  return randomBytes(16).toString("base64url");
}
