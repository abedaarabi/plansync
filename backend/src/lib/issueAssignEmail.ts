import type { Env } from "./env.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type IssueAssignedEmailInput = {
  to: string;
  assignerName: string;
  issueTitle: string;
  fileName: string;
  viewerUrl: string;
};

export function buildIssueAssignedEmailHtml(input: IssueAssignedEmailInput): string {
  const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:${FF};color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">PlanSync</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:700">You were assigned an issue</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5"><strong>${escapeHtml(input.assignerName)}</strong> assigned you:</p>
    <p style="margin:0 0 8px;font-size:16px;font-weight:600">${escapeHtml(input.issueTitle)}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b">File: ${escapeHtml(input.fileName)}</p>
    <a href="${escapeHtml(input.viewerUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">Open in viewer</a>
  </div>
</body>
</html>`;
}

export function buildIssueAssignedEmailText(input: IssueAssignedEmailInput): string {
  return `${input.assignerName} assigned you an issue on PlanSync

Title: ${input.issueTitle}
File: ${input.fileName}

Open in viewer:
${input.viewerUrl}
`;
}

export function buildViewerIssueUrl(
  env: Env,
  input: {
    issueId: string;
    fileId: string;
    fileVersionId: string;
    projectId: string;
    fileName: string;
    version: number;
  },
): string {
  const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
  const q = new URLSearchParams();
  q.set("fileId", input.fileId);
  q.set("name", input.fileName);
  q.set("projectId", input.projectId);
  q.set("fileVersionId", input.fileVersionId);
  q.set("version", String(input.version));
  q.set("issueId", input.issueId);
  return `${base}/viewer?${q.toString()}`;
}
