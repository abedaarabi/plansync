import sanitizeHtml from "sanitize-html";
const proposalCoverOptions = {
    allowedTags: [
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "ul",
        "ol",
        "li",
        "a",
        "blockquote",
        "div",
        "span",
        "h1",
        "h2",
        "h3",
    ],
    allowedAttributes: {
        a: ["href", "target", "rel"],
        span: ["class", "style"],
        p: ["class", "style"],
        div: ["class", "style"],
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
const proposalTableOptions = {
    allowedTags: ["table", "thead", "tbody", "tr", "th", "td", "colgroup", "col"],
    allowedAttributes: {
        table: ["class", "style", "border", "cellpadding", "cellspacing"],
        th: ["class", "style", "colspan", "rowspan"],
        td: ["class", "style", "colspan", "rowspan"],
        tr: ["class", "style"],
        col: ["style", "span"],
        colgroup: ["span"],
    },
};
const MAX_CHARS = 200_000;
export function sanitizeProposalCoverHtml(raw) {
    const out = sanitizeHtml(raw.trim(), proposalCoverOptions).trim();
    if (out.length > MAX_CHARS)
        throw new Error("Cover note too long after sanitization");
    return out;
}
export function sanitizeProposalTableHtml(raw) {
    const out = sanitizeHtml(raw.trim(), proposalTableOptions).trim();
    if (out.length > MAX_CHARS)
        throw new Error("Table HTML too long after sanitization");
    return out;
}
