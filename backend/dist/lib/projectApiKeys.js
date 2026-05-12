import { createHash, randomBytes } from "node:crypto";
const KEY_PREFIX = "psk";
function toHash(raw) {
    return createHash("sha256").update(raw).digest("hex");
}
export function hashProjectApiKey(raw) {
    return toHash(raw.trim());
}
export function buildProjectApiKeyPrefix(raw) {
    const t = raw.trim();
    return t.slice(0, Math.min(18, t.length));
}
/** Create a new plaintext API key and the hash/prefix to persist. */
export function newProjectApiKey() {
    const idPart = randomBytes(6).toString("hex");
    const secretPart = randomBytes(24).toString("base64url");
    const plainText = `${KEY_PREFIX}_${idPart}_${secretPart}`;
    return {
        plainText,
        keyHash: toHash(plainText),
        keyPrefix: buildProjectApiKeyPrefix(plainText),
    };
}
