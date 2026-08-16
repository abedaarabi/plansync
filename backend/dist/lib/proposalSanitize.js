import sanitizeHtml from "sanitize-html";
/**
 * Allowlist for TipTap Simple / Word-style cover letters.
 * Must stay in sync with frontend proposal cover extensions
 * (tables, marks, images, task lists, text-style attrs).
 */
const COLOR_STYLE = [
    /^#[0-9a-f]{3,8}$/i,
    /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
    /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)$/i,
    /^var\(--[\w-]+\)$/i,
];
const SIZE_STYLE = [/^\d+(\.\d+)?(px|em|rem|%)$/i];
const proposalCoverOptions = {
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
        "del",
        "sub",
        "sup",
        "mark",
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
        "h4",
        "hr",
        "img",
        "table",
        "thead",
        "tbody",
        "tfoot",
        "tr",
        "th",
        "td",
        "colgroup",
        "col",
        "input",
        "label",
    ],
    allowedAttributes: {
        a: ["href", "target", "rel", "class", "style"],
        span: ["class", "style", "data-type", "data-id", "data-label", "data-mention-suggestion-char"],
        p: ["class", "style", "textalign", "data-text-align"],
        div: ["class", "style", "data-type"],
        h1: ["class", "style", "data-text-align"],
        h2: ["class", "style", "data-text-align"],
        h3: ["class", "style", "data-text-align"],
        h4: ["class", "style", "data-text-align"],
        blockquote: ["class", "style"],
        ul: ["class", "style", "data-type"],
        ol: ["class", "style", "data-type", "start"],
        li: ["class", "style", "data-type", "data-checked", "data-text-align"],
        mark: ["class", "style", "data-color"],
        img: ["src", "alt", "title", "class", "style", "width", "height"],
        table: ["class", "style", "border", "cellpadding", "cellspacing", "width"],
        thead: ["class", "style"],
        tbody: ["class", "style"],
        tfoot: ["class", "style"],
        tr: ["class", "style"],
        th: ["class", "style", "colspan", "rowspan", "colwidth", "width"],
        td: ["class", "style", "colspan", "rowspan", "colwidth", "width"],
        col: ["style", "span", "width"],
        colgroup: ["span"],
        input: ["type", "checked", "disabled"],
        label: ["class", "contenteditable"],
        "*": ["class", "style"],
    },
    allowedStyles: {
        "*": {
            color: COLOR_STYLE,
            "background-color": COLOR_STYLE,
            "font-size": SIZE_STYLE,
            "font-family": [/^[\w\s"',.-]+$/i],
            "font-weight": [/^(normal|bold|[1-9]00)$/i],
            "font-style": [/^(normal|italic)$/i],
            "text-align": [/^(left|right|center|justify)$/i],
            "line-height": [/^\d+(\.\d+)?(px|em|rem|%)?$/i],
            "text-decoration": [/^[\w\s-]+$/i],
            width: SIZE_STYLE,
            "min-width": SIZE_STYLE,
            "max-width": SIZE_STYLE,
            height: SIZE_STYLE,
            border: [/^[\w\s#.(),%-]+$/i],
            "border-color": COLOR_STYLE,
            "border-width": SIZE_STYLE,
            "border-style": [/^(solid|dashed|dotted|none)$/i],
            "vertical-align": [/^(top|middle|bottom|baseline)$/i],
            padding: [/^[\d.\s%pxemrem]+$/i],
            margin: [/^[\d.\s%pxemrem]+$/i],
        },
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedSchemesByTag: {
        img: ["http", "https", "data"],
        a: ["http", "https", "mailto"],
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
        input: (_tagName, attribs) => {
            // Task-list checkboxes only — never allow free-form inputs through.
            if (attribs.type && attribs.type !== "checkbox") {
                return { tagName: "span", attribs: {} };
            }
            return {
                tagName: "input",
                attribs: {
                    type: "checkbox",
                    disabled: "disabled",
                    ...(attribs.checked != null ? { checked: "checked" } : {}),
                },
            };
        },
    },
};
const proposalTableOptions = {
    allowedTags: ["table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "p", "br"],
    allowedAttributes: {
        table: ["class", "style", "border", "cellpadding", "cellspacing", "width"],
        th: ["class", "style", "colspan", "rowspan", "colwidth", "width"],
        td: ["class", "style", "colspan", "rowspan", "colwidth", "width"],
        tr: ["class", "style"],
        col: ["style", "span", "width"],
        colgroup: ["span"],
        p: ["class", "style"],
    },
};
/** Keep cover letters usable with TipTap tables/images; still bounded for DB/API. */
const MAX_CHARS = 500_000;
/** Cap embedded data-URI images so a single paste cannot blow the payload. */
const MAX_DATA_IMAGE_CHARS = 120_000;
function stripOversizedDataImages(html) {
    return html.replace(/<img\b[^>]*\bsrc\s*=\s*(["'])(data:image\/[^"']+)\1[^>]*>/gi, (full, _q, src) => {
        if (src.length > MAX_DATA_IMAGE_CHARS) {
            return "<!-- image omitted: too large -->";
        }
        return full;
    });
}
export function sanitizeProposalCoverHtml(raw) {
    const trimmed = raw.trim();
    if (trimmed.length > MAX_CHARS) {
        throw new Error("Cover note too long (max 500KB). Use smaller images or less content.");
    }
    const prepared = stripOversizedDataImages(trimmed);
    const out = sanitizeHtml(prepared, proposalCoverOptions).trim();
    if (out.length > MAX_CHARS) {
        throw new Error("Cover note too long after sanitization");
    }
    return out;
}
export function sanitizeProposalTableHtml(raw) {
    const out = sanitizeHtml(raw.trim(), proposalTableOptions).trim();
    if (out.length > MAX_CHARS)
        throw new Error("Table HTML too long after sanitization");
    return out;
}
