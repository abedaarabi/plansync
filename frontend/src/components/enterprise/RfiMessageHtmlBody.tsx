"use client";

import DOMPurify from "isomorphic-dompurify";

let rfiMessagePurifyHooksInstalled = false;

/** Keep only safe `color:` declarations; DOMPurify may drop `style` inconsistently across environments. */
function ensureRfiMessagePurifyStyleHook() {
  if (rfiMessagePurifyHooksInstalled) return;
  rfiMessagePurifyHooksInstalled = true;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName !== "style") return;
    const raw = (data.attrValue || "").trim();
    if (!raw) {
      data.keepAttr = false;
      return;
    }
    const colorOnly =
      /^\s*color:\s*(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\))\s*;?\s*$/i;
    if (!colorOnly.test(raw)) {
      data.keepAttr = false;
    }
  });
}

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
    "span",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
  ],
  ALLOWED_ATTR: [
    "href",
    "target",
    "rel",
    "style",
    "class",
    "data-type",
    "data-id",
    "data-label",
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
  ensureRfiMessagePurifyStyleHook();
  const clean = DOMPurify.sanitize(html, PURIFY_CONFIG);
  return (
    <div
      className={`rfi-rich-body ${top} max-w-none text-sm leading-relaxed text-[var(--enterprise-text)] prose prose-sm dark:prose-invert prose-p:my-1 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-strong:text-[var(--enterprise-text)] [&_a]:text-[var(--enterprise-primary)] [&_span[style*='color']_strong]:text-inherit [&_span[style*='color']_em]:text-inherit [&_span[style*='color']_s]:text-inherit [&_span[style*='color']_u]:text-inherit [&_[data-type=mention]]:rounded [&_[data-type=mention]]:bg-[var(--enterprise-primary)]/12 [&_[data-type=mention]]:px-1 [&_[data-type=mention]]:font-medium [&_[data-type=mention]]:text-[var(--enterprise-primary)] ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
