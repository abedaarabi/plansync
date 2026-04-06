import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3.js";
/** Browser-facing API origin for absolute logo URLs (emails, client portal). */
export function apiPublicOrigin(env) {
    const u = env.PUBLIC_API_URL?.trim();
    if (u)
        return u.replace(/\/$/, "");
    return env.PUBLIC_APP_URL.replace(/\/$/, "");
}
/** Absolute URL (emails, server-side fetch). Prefer `workspaceLogoUrlForClients` for browser JSON. */
export function workspaceHostedLogoAbsoluteUrl(env, workspaceId) {
    return `${apiPublicOrigin(env)}/api/v1/public/workspaces/${encodeURIComponent(workspaceId)}/logo`;
}
/**
 * Browser-safe logo URL for API JSON. S3-hosted logos use a same-origin path so `<img src>`
 * works when `PUBLIC_API_URL` is an internal hostname (Docker) while the app is served elsewhere.
 */
export function workspaceLogoUrlForClients(_env, ws) {
    if (ws.logoS3Key) {
        return `/api/v1/public/workspaces/${encodeURIComponent(ws.id)}/logo`;
    }
    const u = ws.logoUrl?.trim();
    return u || null;
}
/**
 * Absolute URL for `<img src>` in outbound email. Resolves same-origin `/api/v1/...` paths
 * against `PUBLIC_API_URL` when set (split app/API deploy).
 */
export function resolveWorkspaceLogoUrlForEmail(env, workspaceLogoUrl) {
    const t = workspaceLogoUrl?.trim();
    if (!t)
        return null;
    if (t.startsWith("https://") || t.startsWith("http://"))
        return t;
    const appBase = env.PUBLIC_APP_URL.replace(/\/$/, "");
    const apiBase = apiPublicOrigin(env);
    if (t.startsWith("/api/"))
        return `${apiBase}${t}`;
    if (t.startsWith("/"))
        return `${appBase}${t}`;
    return `${appBase}/${t}`;
}
const MAX_LOGO_FETCH_BYTES = 2_000_000;
/** PDFKit can embed PNG, JPEG, GIF, WebP — not SVG. */
function isRasterImageBufferForPdf(buf) {
    if (buf.length < 12)
        return false;
    const b0 = buf[0];
    const b1 = buf[1];
    if (b0 === 0x89 && b1 === 0x50)
        return true;
    if (b0 === 0xff && b1 === 0xd8)
        return true;
    if (buf.subarray(0, 3).toString("ascii") === "GIF")
        return true;
    if (buf.subarray(0, 4).toString("ascii") === "RIFF" &&
        buf.subarray(8, 12).toString("ascii") === "WEBP") {
        return true;
    }
    return false;
}
function looksLikeSvgBuffer(buf) {
    const head = buf.subarray(0, Math.min(2048, buf.length)).toString("utf8").trimStart();
    return head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"));
}
/**
 * Returns a buffer PDFKit can embed. Raster logos pass through; SVG is converted to PNG via sharp.
 * On failure (unsupported binary, sharp error), returns null so the PDF can fall back to initials.
 */
export async function prepareWorkspaceLogoBufferForPdf(buf) {
    if (!buf?.length)
        return null;
    if (isRasterImageBufferForPdf(buf))
        return buf;
    if (!looksLikeSvgBuffer(buf))
        return null;
    try {
        const { default: sharp } = await import("sharp");
        return await sharp(buf)
            .png()
            .resize(512, 512, { fit: "inside", withoutEnlargement: true })
            .toBuffer();
    }
    catch {
        return null;
    }
}
export async function fetchWorkspaceLogoImageBuffer(env, ws) {
    const client = s3Client(env);
    const bucket = env.S3_BUCKET;
    if (ws.logoS3Key && client && bucket) {
        try {
            const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: ws.logoS3Key }));
            const body = out.Body;
            if (!body)
                return null;
            const bytes = await body.transformToByteArray();
            if (bytes.length > MAX_LOGO_FETCH_BYTES)
                return null;
            return Buffer.from(bytes);
        }
        catch {
            return null;
        }
    }
    const url = ws.logoUrl?.trim();
    if (!url?.startsWith("http"))
        return null;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok)
            return null;
        const ab = await res.arrayBuffer();
        if (ab.byteLength > MAX_LOGO_FETCH_BYTES)
            return null;
        return Buffer.from(ab);
    }
    catch {
        return null;
    }
}
