import { buildTransactionalEmailHtml } from "./transactionalEmailLayout.js";
export function buildIssueAssignedEmailHtml(env, input) {
    return buildTransactionalEmailHtml(env, {
        eyebrow: "Plan viewer",
        title: "You were assigned an issue",
        bodyLines: [
            `${input.assignerName} assigned you to review an issue on a drawing.`,
            input.issueTitle,
            `File: ${input.fileName}`,
        ],
        primaryAction: { url: input.viewerUrl, label: "Open in viewer" },
        fallbackUrl: input.viewerUrl,
    });
}
export function buildIssueAssignedEmailText(input) {
    return `${input.assignerName} assigned you an issue on PlanSync

Title: ${input.issueTitle}
File: ${input.fileName}

Open in viewer:
${input.viewerUrl}
`;
}
/** In-app link (path + query only) for notifications / client navigation. */
export function buildViewerIssuePath(input) {
    const q = new URLSearchParams();
    q.set("fileId", input.fileId);
    q.set("name", input.fileName);
    q.set("projectId", input.projectId);
    q.set("fileVersionId", input.fileVersionId);
    q.set("version", String(input.version));
    q.set("issueId", input.issueId);
    return `/viewer?${q.toString()}`;
}
export function buildViewerIssueUrl(env, input) {
    const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
    return `${base}${buildViewerIssuePath(input)}`;
}
