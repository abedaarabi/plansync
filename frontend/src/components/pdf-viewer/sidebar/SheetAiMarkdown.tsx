"use client";

import ReactMarkdown from "react-markdown";

const proseAssistantCompact =
  "prose prose-sm max-w-none prose-invert " +
  "prose-headings:mb-1 prose-headings:mt-1 prose-headings:text-[10px] prose-headings:leading-tight prose-headings:first:mt-0 " +
  "prose-p:my-1 prose-p:text-[10px] prose-p:leading-snug prose-p:text-slate-200 " +
  "prose-a:text-sky-400 prose-a:underline-offset-2 hover:prose-a:text-sky-300 " +
  "prose-strong:text-slate-50 prose-em:text-slate-300 " +
  "prose-code:rounded prose-code:bg-slate-950/90 prose-code:px-1 prose-code:py-px prose-code:text-[9px] prose-code:font-normal prose-code:text-violet-200 " +
  "prose-code:before:content-none prose-code:after:content-none " +
  "prose-pre:my-1 prose-pre:rounded prose-pre:border prose-pre:border-slate-700 prose-pre:bg-slate-950 prose-pre:text-[9px] prose-pre:text-slate-200 " +
  "prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:text-[10px] prose-li:text-slate-200 " +
  "prose-blockquote:border-l-slate-600 prose-blockquote:text-slate-300 prose-blockquote:not-italic " +
  "prose-hr:border-slate-600";

const proseUserCompact =
  "prose prose-sm max-w-none " +
  "prose-headings:mb-1 prose-headings:mt-1 prose-headings:text-[10px] prose-headings:leading-tight prose-headings:first:mt-0 " +
  "prose-p:my-1 prose-p:text-[10px] prose-p:leading-snug prose-p:text-sky-100 " +
  "prose-a:text-sky-300 prose-a:underline-offset-2 hover:prose-a:text-sky-200 " +
  "prose-strong:text-white prose-em:text-sky-200/90 " +
  "prose-code:rounded prose-code:bg-sky-950/70 prose-code:px-1 prose-code:py-px prose-code:text-[9px] prose-code:font-normal prose-code:text-sky-200 " +
  "prose-code:before:content-none prose-code:after:content-none " +
  "prose-pre:my-1 prose-pre:rounded prose-pre:border prose-pre:border-sky-800/60 prose-pre:bg-sky-950/80 prose-pre:text-[9px] prose-pre:text-sky-100 " +
  "prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:text-[10px] prose-li:text-sky-100 " +
  "prose-blockquote:border-l-sky-600 prose-blockquote:text-sky-200/90 prose-blockquote:not-italic " +
  "prose-hr:border-sky-700/80";

const proseAssistant =
  "prose prose-sm max-w-none prose-invert " +
  "prose-headings:mb-1.5 prose-headings:mt-2 prose-headings:font-semibold prose-headings:text-slate-100 prose-headings:first:mt-0 " +
  "prose-p:my-1.5 prose-p:text-slate-200 prose-p:leading-relaxed " +
  "prose-a:text-sky-400 prose-a:underline-offset-2 hover:prose-a:text-sky-300 " +
  "prose-strong:text-slate-50 prose-em:text-slate-300 " +
  "prose-code:rounded prose-code:bg-slate-950/90 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:text-violet-200 " +
  "prose-code:before:content-none prose-code:after:content-none " +
  "prose-pre:my-2 prose-pre:rounded-lg prose-pre:border prose-pre:border-slate-700 prose-pre:bg-slate-950 prose-pre:text-slate-200 " +
  "prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-li:text-slate-200 " +
  "prose-blockquote:border-l-slate-600 prose-blockquote:text-slate-300 prose-blockquote:not-italic " +
  "prose-hr:border-slate-600";

const proseUser =
  "prose prose-sm max-w-none " +
  "prose-headings:mb-1.5 prose-headings:mt-2 prose-headings:font-semibold prose-headings:text-sky-50 prose-headings:first:mt-0 " +
  "prose-p:my-1.5 prose-p:text-sky-100 prose-p:leading-relaxed " +
  "prose-a:text-sky-300 prose-a:underline-offset-2 hover:prose-a:text-sky-200 " +
  "prose-strong:text-white prose-em:text-sky-200/90 " +
  "prose-code:rounded prose-code:bg-sky-950/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:text-sky-200 " +
  "prose-code:before:content-none prose-code:after:content-none " +
  "prose-pre:my-2 prose-pre:rounded-lg prose-pre:border prose-pre:border-sky-800/60 prose-pre:bg-sky-950/80 prose-pre:text-sky-100 " +
  "prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-li:text-sky-100 " +
  "prose-blockquote:border-l-sky-600 prose-blockquote:text-sky-200/90 prose-blockquote:not-italic " +
  "prose-hr:border-sky-700/80";

type Variant = "assistant" | "user";

export function SheetAiMarkdown({
  content,
  variant = "assistant",
  compact = false,
}: {
  content: string;
  variant?: Variant;
  compact?: boolean;
}) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const cls = compact
    ? variant === "user"
      ? proseUserCompact
      : proseAssistantCompact
    : variant === "user"
      ? proseUser
      : proseAssistant;
  return (
    <div className={cls}>
      <ReactMarkdown>{trimmed}</ReactMarkdown>
    </div>
  );
}
