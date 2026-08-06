"use client";

import DOMPurify from "isomorphic-dompurify";

/** Matches TipTap document / proposal cover allowlist used for RFI discussion. */
const PURIFY_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
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
    "span",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
    "div",
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
  ALLOWED_ATTR: [
    "href",
    "target",
    "rel",
    "style",
    "class",
    "src",
    "alt",
    "title",
    "width",
    "height",
    "colspan",
    "rowspan",
    "colwidth",
    "border",
    "cellpadding",
    "cellspacing",
    "type",
    "checked",
    "disabled",
    "data-type",
    "data-id",
    "data-label",
    "data-checked",
    "data-indent",
    "data-color",
    "data-text-align",
    "data-mention-suggestion-char",
  ],
};

type Props = {
  html: string;
  className?: string;
};

/** Renders stored RFI message body: legacy plain text or sanitized HTML. */
export function RfiMessageHtmlBody({ html, className = "" }: Props) {
  const top = /\bmt-0\b/.test(className) ? "" : "mt-1";
  const looksRich = /<\/?[a-z][\s\S]*>/i.test(html);
  if (!looksRich) {
    return (
      <p
        className={`${top} whitespace-pre-wrap text-sm leading-relaxed text-[var(--enterprise-text)] ${className}`}
      >
        {html}
      </p>
    );
  }
  const clean = DOMPurify.sanitize(html, PURIFY_CONFIG);
  return (
    <div
      className={`rfi-rich-body ${top} prose prose-sm max-w-none text-sm leading-relaxed text-[var(--enterprise-text)] dark:prose-invert prose-p:my-1 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-strong:text-[var(--enterprise-text)] prose-table:my-2 prose-th:border prose-td:border prose-img:max-w-full prose-img:rounded [&_a]:text-[var(--enterprise-primary)] [&_[data-type=mention]]:rounded [&_[data-type=mention]]:bg-[var(--enterprise-primary)]/12 [&_[data-type=mention]]:px-1 [&_[data-type=mention]]:font-medium [&_[data-type=mention]]:text-[var(--enterprise-primary)] ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
