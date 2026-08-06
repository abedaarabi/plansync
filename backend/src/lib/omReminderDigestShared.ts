import { Resend } from "resend";
import { WorkspaceRole, type WorkspaceMember } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { Env } from "./env.js";
import { inviteFromAddress } from "./inviteEmail.js";
import { createUserNotifications } from "./userNotifications.js";

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function memberCanAccessProject(
  member: Pick<WorkspaceMember, "role" | "isExternal">,
  scopedProjectIds: Set<string> | undefined,
  projectId: string,
): boolean {
  if (member.isExternal) return false;
  const isManager =
    member.role === WorkspaceRole.SUPER_ADMIN || member.role === WorkspaceRole.ADMIN;
  if (isManager || !scopedProjectIds || scopedProjectIds.size === 0) return true;
  return scopedProjectIds.has(projectId);
}

export function filterItemsForMemberAccess<T extends { projectId: string }>(
  items: T[],
  member: Pick<WorkspaceMember, "role" | "isExternal">,
  scopedProjectIds: Set<string> | undefined,
): T[] {
  return items.filter((it) => memberCanAccessProject(member, scopedProjectIds, it.projectId));
}

export function isWorkspaceManagerRole(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.SUPER_ADMIN || role === WorkspaceRole.ADMIN;
}

export function createOmDigestResend(env: Env): {
  resend: Resend | null;
  from: string | null;
  configured: boolean;
  dayKey: string;
  startToday: Date;
  dueSoonEnd: Date;
  appOrigin: string;
} {
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);

  const resendKey = env.RESEND_API_KEY?.trim();
  const from = inviteFromAddress(env);
  const configured = Boolean(resendKey && from);
  const resend = configured ? new Resend(resendKey!) : null;

  const startToday = new Date(now);
  startToday.setUTCHours(0, 0, 0, 0);
  const dueSoonEnd = addUtcDays(startToday, 7);
  dueSoonEnd.setUTCHours(23, 59, 59, 999);

  const appOrigin = env.PUBLIC_APP_URL.replace(/\/$/, "");

  return { resend, from, configured, dayKey, startToday, dueSoonEnd, appOrigin };
}

export async function loadScopedProjectsByUser(
  userIds: string[],
  workspaceId: string,
): Promise<Map<string, Set<string>>> {
  const scopedRows = await prisma.projectMember.findMany({
    where: {
      userId: { in: userIds },
      project: { workspaceId },
    },
    select: { userId: true, projectId: true },
  });
  const scopedByUser = new Map<string, Set<string>>();
  for (const row of scopedRows) {
    const set = scopedByUser.get(row.userId) ?? new Set<string>();
    set.add(row.projectId);
    scopedByUser.set(row.userId, set);
  }
  return scopedByUser;
}

export function summarizeOverdueDueSoon(items: { overdue: boolean }[]): {
  overdueCount: number;
  dueSoonCount: number;
  titleParts: string[];
  statusSummary: string;
} {
  const overdueCount = items.filter((it) => it.overdue).length;
  const dueSoonCount = items.length - overdueCount;
  const titleParts: string[] = [];
  if (overdueCount > 0) titleParts.push(`${overdueCount} overdue`);
  if (dueSoonCount > 0) titleParts.push(`${dueSoonCount} due soon`);
  const statusSummary = titleParts.join(", ");
  return { overdueCount, dueSoonCount, titleParts, statusSummary };
}

export function formatDigestPreviewBody(labels: string[]): string {
  const preview = labels.slice(0, 3).join(" · ");
  if (labels.length > 3) return `${preview} · +${labels.length - 3} more`;
  return preview;
}

export type OmDigestRunStats = {
  dayKey: string;
  workspacesEmailed: number;
  workspacesNotified: number;
  membersEmailed: number;
  membersNotified: number;
  workspacesSkipped: number;
  skippedNoResend: boolean;
};

export function emptyDigestCounters(): Pick<
  OmDigestRunStats,
  | "workspacesEmailed"
  | "workspacesNotified"
  | "membersEmailed"
  | "membersNotified"
  | "workspacesSkipped"
> {
  return {
    workspacesEmailed: 0,
    workspacesNotified: 0,
    membersEmailed: 0,
    membersNotified: 0,
    workspacesSkipped: 0,
  };
}

export async function sendDigestResendEmail(opts: {
  resend: Resend;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  logPrefix: string;
}): Promise<boolean> {
  try {
    const sent = await opts.resend.emails.send({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (sent.error) {
      console.error(`${opts.logPrefix} resend send_failed`, sent.error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`${opts.logPrefix} resend exception`, err);
    return false;
  }
}

export async function tryNotify(
  opts: Parameters<typeof createUserNotifications>[0],
  logPrefix: string,
): Promise<boolean> {
  try {
    await createUserNotifications(opts);
    return true;
  } catch (err) {
    console.error(`${logPrefix} notification exception`, err);
    return false;
  }
}
