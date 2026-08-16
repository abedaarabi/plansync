import { buildTransactionalEmailHtml, escapeHtml } from "./transactionalEmailLayout.js";
function priorityLabel(priority) {
    const p = priority?.trim().toUpperCase();
    if (!p)
        return null;
    if (p === "CRITICAL")
        return "Critical";
    if (p === "HIGH")
        return "High";
    if (p === "MEDIUM")
        return "Medium";
    if (p === "LOW")
        return "Low";
    return p.charAt(0) + p.slice(1).toLowerCase();
}
export function truncatePlain(text, max) {
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length <= max)
        return t;
    return `${t.slice(0, Math.max(0, max - 1))}…`;
}
function previewImageHtml(url) {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px">
  <tr>
    <td style="border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;background:#0f172a">
      <img src="${escapeHtml(url)}" alt="Issue snapshot" width="464" style="display:block;width:100%;max-width:464px;height:auto;border:0" />
    </td>
  </tr>
  <tr>
    <td style="padding:8px 2px 0;font-size:11px;line-height:1.4;color:#94a3b8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
      Snapshot from the viewer — open the issue to review full detail and markups.
    </td>
  </tr>
</table>`;
}
export function buildIssueAssignedEmailHtml(env, input) {
    const context = input.contextKind === "model" ? "a 3D model" : "a drawing";
    const pri = priorityLabel(input.priority);
    const desc = input.description?.trim() ? truncatePlain(input.description, 280) : null;
    const bodyLines = [
        `${input.assignerName} assigned you an issue on ${context}.`,
        input.issueTitle,
        pri ? `Priority: ${pri}` : "",
        `File: ${input.fileName}`,
        desc ? desc : "",
    ].filter((l) => l.trim().length > 0);
    return buildTransactionalEmailHtml(env, {
        eyebrow: input.contextKind === "model" ? "BIM viewer" : "Plan viewer",
        title: "You were assigned an issue",
        bodyLines,
        extraHtml: input.previewImageUrl?.trim()
            ? previewImageHtml(input.previewImageUrl.trim())
            : undefined,
        primaryAction: {
            url: input.viewerUrl,
            label: input.contextKind === "model" ? "Open in BIM viewer" : "Open in viewer",
        },
        fallbackUrl: input.viewerUrl,
    });
}
export function buildIssueAssignedEmailText(input) {
    const context = input.contextKind === "model" ? "a 3D model" : "a drawing";
    const pri = priorityLabel(input.priority);
    const desc = input.description?.trim() ? truncatePlain(input.description, 400) : null;
    const lines = [
        `${input.assignerName} assigned you an issue on PlanSync (${context}).`,
        "",
        `Title: ${input.issueTitle}`,
        pri ? `Priority: ${pri}` : null,
        `File: ${input.fileName}`,
        desc ? "" : null,
        desc,
        "",
        input.contextKind === "model" ? "Open in BIM viewer:" : "Open in viewer:",
        input.viewerUrl,
    ];
    return lines.filter((l) => l != null).join("\n");
}
function bimGuidFromAnchor(bimAnchor) {
    if (!bimAnchor || typeof bimAnchor !== "object")
        return null;
    const guid = bimAnchor.ifcGuid;
    if (typeof guid !== "string")
        return null;
    const t = guid.trim();
    return t.length > 0 ? t : null;
}
/** In-app link (path + query only) for notifications / client navigation. */
export function buildViewerIssuePath(input) {
    const bimGuid = input.bimGuid?.trim() || bimGuidFromAnchor(input.bimAnchor);
    const q = new URLSearchParams();
    q.set("fileId", input.fileId);
    q.set("name", input.fileName);
    q.set("projectId", input.projectId);
    q.set("fileVersionId", input.fileVersionId);
    q.set("version", String(input.version));
    q.set("issueId", input.issueId);
    if (bimGuid)
        q.set("guid", bimGuid);
    const path = bimGuid ? "/bim-viewer" : "/viewer";
    return `${path}?${q.toString()}`;
}
export function buildViewerIssueUrl(env, input) {
    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    return `${base}${buildViewerIssuePath(input)}`;
}
