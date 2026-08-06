/** Wrap plain `{{field}}` tokens as TipTap mention nodes for chip rendering. */
export function wrapProposalMergeFieldsAsMentions(html: string): string {
  const input = html.trim() ? html : "<p></p>";
  return input.replace(
    /\{\{([a-zA-Z0-9_.]+)\}\}/g,
    (_m, key: string) =>
      `<span data-type="mention" data-id="${key}" data-label="${key}" class="proposal-merge-chip">{{${key}}}</span>`,
  );
}

/** Resolve `{{field}}` tokens for an edit-time preview (does not mutate storage). */
export function resolveProposalMergePreview(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_m, key: string) => {
    const v = values[key];
    if (v == null || v === "") {
      return `<span class="proposal-merge-missing">{{${key}}}</span>`;
    }
    return escapeHtml(v);
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
