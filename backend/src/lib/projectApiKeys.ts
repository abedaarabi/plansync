import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "psk";

function toHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function hashProjectApiKey(raw: string): string {
  return toHash(raw.trim());
}

export function buildProjectApiKeyPrefix(raw: string): string {
  const t = raw.trim();
  return t.slice(0, Math.min(18, t.length));
}

/** Create a new plaintext API key and the hash/prefix to persist. */
export function newProjectApiKey(): {
  plainText: string;
  keyHash: string;
  keyPrefix: string;
} {
  const idPart = randomBytes(6).toString("hex");
  const secretPart = randomBytes(24).toString("base64url");
  const plainText = `${KEY_PREFIX}_${idPart}_${secretPart}`;
  return {
    plainText,
    keyHash: toHash(plainText),
    keyPrefix: buildProjectApiKeyPrefix(plainText),
  };
}
