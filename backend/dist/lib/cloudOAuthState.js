import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const MAX_AGE_MS = 15 * 60 * 1000;
function hmac(env, data) {
    return createHmac("sha256", env.BETTER_AUTH_SECRET).update(data).digest();
}
export function signCloudOAuthState(env, payload) {
    const raw = Buffer.from(JSON.stringify(payload), "utf8");
    const sig = hmac(env, raw);
    return `${raw.toString("base64url")}.${sig.toString("base64url")}`;
}
export function verifyCloudOAuthState(env, token) {
    const parts = token.split(".");
    if (parts.length !== 2)
        return null;
    const [rawB64, sigB64] = parts;
    if (!rawB64 || !sigB64)
        return null;
    let raw;
    let sig;
    try {
        raw = Buffer.from(rawB64, "base64url");
        sig = Buffer.from(sigB64, "base64url");
    }
    catch {
        return null;
    }
    const expect = hmac(env, raw);
    if (expect.length !== sig.length || !timingSafeEqual(expect, sig))
        return null;
    let parsed;
    try {
        parsed = JSON.parse(raw.toString("utf8"));
    }
    catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object")
        return null;
    const o = parsed;
    if (typeof o.userId !== "string" ||
        typeof o.ts !== "number" ||
        typeof o.nonce !== "string" ||
        typeof o.provider !== "string") {
        return null;
    }
    if (!["google", "microsoft", "dropbox"].includes(o.provider))
        return null;
    if (Date.now() - o.ts > MAX_AGE_MS)
        return null;
    const returnTo = o.returnTo === null || o.returnTo === undefined
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
        provider: o.provider,
        returnTo,
    };
}
export function newOAuthNonce() {
    return randomBytes(16).toString("base64url");
}
