import type { Env } from "./env.js";
import { buildTransactionalEmailHtml } from "./transactionalEmailLayout.js";

export type PunchAssignedEmailContentInput = {
  assignerName: string;
  projectName: string;
  punchListUrl: string;
  punchNumber?: number;
  punchTitle?: string;
  bulkCount?: number;
};

/** In-app link (path + query only) for notifications / client navigation. */
export function buildPunchListPath(projectId: string, punchId?: string | null): string {
  const base = `/projects/${projectId}/punch`;
  if (!punchId) return base;
  return `${base}?punch=${encodeURIComponent(punchId)}`;
}

export function buildPunchListUrl(env: Env, projectId: string, punchId?: string | null): string {
  const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}${buildPunchListPath(projectId, punchId)}`;
}

export function buildPunchAssignedEmailHtml(
  env: Env,
  input: PunchAssignedEmailContentInput,
): string {
  const bulk = typeof input.bulkCount === "number" && input.bulkCount > 1;
  const title = bulk ? "Punch items assigned to you" : "You were assigned a punch item";
  const bodyLines = bulk
    ? [
        `${input.assignerName} assigned you ${input.bulkCount} punch items in ${input.projectName}.`,
        "Open the punch list to review details.",
      ]
    : [
        `${input.assignerName} assigned you a punch item in ${input.projectName}.`,
        input.punchTitle
          ? `#${input.punchNumber ?? "?"} — ${input.punchTitle}`
          : `Item #${input.punchNumber ?? "?"}`,
      ];
  return buildTransactionalEmailHtml(env, {
    eyebrow: "Punch list",
    title,
    bodyLines,
    primaryAction: { url: input.punchListUrl, label: "Open punch list" },
    fallbackUrl: input.punchListUrl,
  });
}

export function buildPunchAssignedEmailText(input: PunchAssignedEmailContentInput): string {
  const bulk = typeof input.bulkCount === "number" && input.bulkCount > 1;
  if (bulk) {
    return `${input.assignerName} assigned you ${input.bulkCount} punch items on PlanSync

Project: ${input.projectName}

Open punch list:
${input.punchListUrl}
`;
  }
  const line =
    input.punchTitle && input.punchNumber != null
      ? `#${input.punchNumber} — ${input.punchTitle}`
      : input.punchTitle || `Punch #${input.punchNumber ?? "?"}`;
  return `${input.assignerName} assigned you a punch item on PlanSync

Project: ${input.projectName}
${line}

Open punch list:
${input.punchListUrl}
`;
}
