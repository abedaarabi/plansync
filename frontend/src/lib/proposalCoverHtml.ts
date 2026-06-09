/** Same heuristic as backend proposalCoverHtml.ts / ProposalLetterPreviewBlock. */
export function looksLikeProposalCoverHtml(raw: string): boolean {
  const t = raw.trim();
  return /^\s*</.test(t) && /<[a-z]/i.test(t);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Best-effort plain text → HTML when the API returns unformatted text (defensive fallback).
 * Prefer server-side conversion; this only handles paragraph / line-break structure.
 */
export function proposalCoverTextToHtml(raw: string): string {
  const input = raw.trim();
  if (!input) return "";
  if (looksLikeProposalCoverHtml(input)) return input;

  const blocks = input.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  if (blocks.length === 0) return "";

  return blocks
    .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
