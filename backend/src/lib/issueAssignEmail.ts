import type { Env } from "./env.js";
import { buildTransactionalEmailHtml } from "./transactionalEmailLayout.js";

export type IssueAssignedEmailInput = {
  to: string;
  assignerName: string;
  issueTitle: string;
  fileName: string;
  viewerUrl: string;
};

export function buildIssueAssignedEmailHtml(env: Env, input: IssueAssignedEmailInput): string {
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

export function buildIssueAssignedEmailText(input: IssueAssignedEmailInput): string {
  return `${input.assignerName} assigned you an issue on PlanSync

Title: ${input.issueTitle}
File: ${input.fileName}

Open in viewer:
${input.viewerUrl}
`;
}

/** In-app link (path + query only) for notifications / client navigation. */
export function buildViewerIssuePath(input: {
  issueId: string;
  fileId: string;
  fileVersionId: string;
  projectId: string;
  fileName: string;
  version: number;
}): string {
  const q = new URLSearchParams();
  q.set("fileId", input.fileId);
  q.set("name", input.fileName);
  q.set("projectId", input.projectId);
  q.set("fileVersionId", input.fileVersionId);
  q.set("version", String(input.version));
  q.set("issueId", input.issueId);
  return `/viewer?${q.toString()}`;
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
  return `${base}${buildViewerIssuePath(input)}`;
}
