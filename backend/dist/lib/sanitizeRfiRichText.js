import sanitizeHtml from "sanitize-html";
const RFIMessageSanitizeOptions = {
    allowedTags: [
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "strike",
        "span",
        "ul",
        "ol",
        "li",
        "a",
        "blockquote",
    ],
    allowedAttributes: {
        a: ["href", "target", "rel"],
        span: ["style", "data-type", "data-id", "data-label", "data-mention-suggestion-char", "class"],
        p: ["style"],
        li: ["style"],
    },
    exclusiveFilter(frame) {
        if (frame.tag === "span" && frame.attribs["data-type"] === "mention") {
            return !frame.attribs["data-id"];
        }
        return false;
    },
    allowedStyles: {
        "*": {
            color: [
                /^#[0-9a-f]{3,8}$/i,
                /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
                /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)$/,
            ],
        },
    },
    transformTags: {
        a: (_tagName, attribs) => ({
            tagName: "a",
            attribs: {
                ...attribs,
                href: attribs.href ?? "#",
                rel: "noopener noreferrer",
                target: "_blank",
            },
        }),
    },
};
const MAX_SANITIZED_HTML_CHARS = 50_000;
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
export function sanitizeRfiMessageHtml(raw) {
    const trimmed = raw.trim();
    const out = sanitizeHtml(trimmed, RFIMessageSanitizeOptions).trim();
    if (out.length > MAX_SANITIZED_HTML_CHARS) {
        throw new Error(`Message exceeds ${MAX_SANITIZED_HTML_CHARS} characters after sanitization`);
    }
    return out;
}
