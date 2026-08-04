"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/** Turn escaped markdown from APIs into real newlines / emphasis markers. */
// fallow-ignore-next-line complexity
export function prepareChatMarkdown(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  // Unwrap accidental JSON reply payloads.
  if (text.startsWith("{") && /"reply"\s*:/.test(text)) {
    try {
      const parsed = JSON.parse(text) as { reply?: unknown };
      if (typeof parsed.reply === "string" && parsed.reply.trim()) {
        text = parsed.reply.trim();
      }
    } catch {
      const m = /"reply"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(text);
      if (m?.[1]) {
        try {
          text = JSON.parse(`"${m[1]}"`) as string;
        } catch {
          text = m[1];
        }
      }
    }
  }

  // If the server left literal escape sequences, decode them.
  if (text.includes("\\n") || text.includes("\\t") || text.includes('\\"')) {
    text = text
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  return text.trim();
}

const assistantComponents: Components = {
  p: ({ children }) => (
    <p className="my-1.5 text-[15px] leading-relaxed text-[var(--enterprise-text)] first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="mt-2 mb-1.5 text-base font-semibold tracking-tight text-[var(--enterprise-text)] first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-2 mb-1.5 text-[15px] font-semibold tracking-tight text-[var(--enterprise-text)] first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2 mb-1 text-sm font-semibold tracking-tight text-[var(--enterprise-text)] first:mt-0">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-[15px] text-[var(--enterprise-text)] marker:text-[var(--enterprise-text-muted)]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-[15px] text-[var(--enterprise-text)] marker:text-[var(--enterprise-text-muted)]">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed text-[var(--enterprise-text)]">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--enterprise-text)]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-[var(--enterprise-text)]">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-[var(--enterprise-primary)] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-xl bg-[var(--enterprise-hover-surface)] px-3 py-2 text-[13px] text-[var(--enterprise-text)]">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md bg-[var(--enterprise-hover-surface)] px-1.5 py-0.5 text-[0.9em] font-medium text-[var(--enterprise-text)]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-xl bg-[var(--enterprise-hover-surface)] p-3 text-[13px] text-[var(--enterprise-text)]">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-[var(--enterprise-border)] pl-3 text-[var(--enterprise-text-muted)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-[var(--enterprise-border)]" />,
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-xs)]">
      <table className="w-full min-w-[18rem] border-collapse text-left text-[13px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--enterprise-hover-surface)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--enterprise-text-muted)]">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-[var(--enterprise-border)]">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="transition-colors even:bg-[color-mix(in_srgb,var(--enterprise-hover-surface)_45%,transparent)]">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-[var(--enterprise-text-muted)]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2.5 align-top text-[var(--enterprise-text)]">{children}</td>
  ),
};

const userComponents: Components = {
  p: ({ children }) => (
    <p className="my-1.5 text-[15px] leading-relaxed text-white first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-[15px] text-white marker:text-white/70">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-[15px] text-white marker:text-white/70">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed text-white">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-white">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-white underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded-md bg-white/20 px-1.5 py-0.5 text-[0.9em] font-medium text-white">
      {children}
    </code>
  ),
};

type IssuesChatMarkdownProps = {
  content: string;
  variant: "assistant" | "user" | "error";
};

export function IssuesChatMarkdown({ content, variant }: IssuesChatMarkdownProps) {
  const body = prepareChatMarkdown(content);
  if (!body) return null;

  if (variant === "error") {
    return (
      <div className="min-w-0 text-[15px] leading-relaxed text-[var(--enterprise-semantic-danger-text)]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={assistantComponents}>
          {body}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={variant === "user" ? userComponents : assistantComponents}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
