import sanitizeHtml from "sanitize-html";
import { sanitizeProposalCoverHtml } from "./proposalSanitize.js";
const MAX_SANITIZED_HTML_CHARS = 120_000;
/** Strip to plain text (for email / notification excerpts). */
export function rfiRichTextPlainExcerpt(html, maxLen) {
    const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length <= maxLen)
        return t;
    return `${t.slice(0, maxLen)}…`;
}
export function isRfiRichTextEffectivelyEmpty(html) {
    const plain = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
    return plain.length === 0;
}
/**
 * Same TipTap document allowlist as proposal cover letters (tables, images,
 * headings, marks, …) so the shared editor can post discussion HTML safely.
 * Mentions without `data-id` are stripped by a second pass.
 */
export function sanitizeRfiMessageHtml(raw) {
    const trimmed = raw.trim();
    if (trimmed.length > MAX_SANITIZED_HTML_CHARS) {
        throw new Error(`Message exceeds ${MAX_SANITIZED_HTML_CHARS} characters`);
    }
    let out = sanitizeProposalCoverHtml(trimmed);
    // Drop mention chips that have no user/field id (invalid / incomplete).
    out = out.replace(/<span\b[^>]*\bdata-type=(["'])mention\1(?![^>]*\bdata-id=)[^>]*>[\s\S]*?<\/span>/gi, "");
    out = out.trim();
    if (out.length > MAX_SANITIZED_HTML_CHARS) {
        throw new Error(`Message exceeds ${MAX_SANITIZED_HTML_CHARS} characters after sanitization`);
    }
    return out;
}
