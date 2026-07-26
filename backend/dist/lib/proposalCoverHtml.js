import { marked } from "marked";
import { sanitizeProposalCoverHtml } from "./proposalSanitize.js";
marked.use({ gfm: true, breaks: true });
/** Same heuristic as the app preview / client portal (ProposalLetterPreviewBlock). */
export function looksLikeProposalCoverHtml(raw) {
    const t = raw.trim();
    return /^\s*</.test(t) && /<[a-z]/i.test(t);
}
/** Convert AI/plain-text or Markdown cover letter content into sanitized HTML for TipTap / storage. */
export function proposalCoverTextToHtml(raw) {
    const input = raw.trim();
    if (!input)
        return "";
    const html = looksLikeProposalCoverHtml(input) ? input : marked.parse(input);
    return sanitizeProposalCoverHtml(html);
}
