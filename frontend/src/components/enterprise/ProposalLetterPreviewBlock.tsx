"use client";

import ReactMarkdown from "react-markdown";

const proseLetter =
  "prose prose-sm max-w-none text-slate-800 " +
  "prose-headings:font-semibold prose-headings:text-[#0F172A] " +
  "prose-p:text-slate-700 prose-a:text-[#2563EB] prose-a:underline-offset-2 hover:prose-a:underline " +
  "prose-strong:text-[#0F172A] prose-li:text-slate-700 prose-blockquote:text-slate-600 " +
  "prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-px prose-code:text-sm " +
  "prose-code:before:content-none prose-code:after:content-none " +
  "prose-pre:bg-slate-100 prose-pre:text-slate-800";

export function ProposalLetterPreviewBlock({
  letterMarkdown,
  letterHtml,
  takeoffTableHtml,
}: {
  letterMarkdown: string;
  letterHtml: string | null;
  takeoffTableHtml: string;
}) {
  return (
    <>
      {letterHtml ? (
        <div className={proseLetter} dangerouslySetInnerHTML={{ __html: letterHtml }} />
      ) : (
        <div className={proseLetter}>
          <ReactMarkdown>{letterMarkdown || ""}</ReactMarkdown>
        </div>
      )}
      {takeoffTableHtml ? (
        <div
          className="prose prose-sm mt-8 max-w-none overflow-x-auto text-slate-800"
          dangerouslySetInnerHTML={{ __html: takeoffTableHtml }}
        />
      ) : null}
    </>
  );
}
