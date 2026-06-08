import { Resend } from "resend";
import { WorkspaceRole, type WorkspaceMember } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { Env } from "./env.js";
import { inviteFromAddress } from "./inviteEmail.js";
import { isWorkspaceOmBilling } from "./subscription.js";
import { parseProjectSettingsJson } from "./projectSettings.js";
import { createUserNotifications } from "./userNotifications.js";

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export type OmMaintenanceReminderRow = {
  scheduleId: string;
  projectId: string;
  projectName: string;
  assetTag: string;
  assetName: string;
  title: string;
  nextDueAt: Date;
  overdue: boolean;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function maintenanceAppHref(projectId: string): string {
  return `/projects/${projectId}/om/maintenance`;
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

function itemsForMember(
  items: OmMaintenanceReminderRow[],
  member: Pick<WorkspaceMember, "role" | "isExternal">,
  scopedProjectIds: Set<string> | undefined,
): OmMaintenanceReminderRow[] {
  return items.filter((it) => memberCanAccessProject(member, scopedProjectIds, it.projectId));
}

function notificationBody(items: OmMaintenanceReminderRow[]): string {
  const sorted = [...items].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
  const preview = sorted
    .slice(0, 3)
    .map((it) => `${it.projectName} · ${it.assetTag}: ${it.title}`)
    .join(" · ");
  if (sorted.length > 3) return `${preview} · +${sorted.length - 3} more`;
  return preview;
}

function buildDigestEmail(
  workspaceName: string,
  items: OmMaintenanceReminderRow[],
  appOrigin: string,
): { html: string; text: string; subject: string } {
  const sorted = [...items].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
  const rowsHtml = sorted
    .map((it) => {
      const due = it.nextDueAt.toISOString().slice(0, 10);
      const status = it.overdue ? "Overdue" : "Due soon";
      const href = `${appOrigin}${maintenanceAppHref(it.projectId)}`;
      return `<tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(it.projectName)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(it.assetTag)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(it.title)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${due}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${status}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;"><a href="${href}">Open</a></td>
    </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
  <h2 style="margin:0 0 12px;">Maintenance reminders — ${escapeHtml(workspaceName)}</h2>
  <p style="margin:0 0 16px;color:#64748b;font-size:14px;">You have <strong>${sorted.length}</strong> preventive maintenance item(s) that are overdue or due within the next 7 days (UTC).</p>
  <table style="border-collapse:collapse;width:100%;max-width:720px;font-size:14px;">
    <thead>
      <tr style="background:#f8fafc;text-align:left;">
        <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Project</th>
        <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Asset</th>
        <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Schedule</th>
        <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Next due</th>
        <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Status</th>
        <th style="padding:8px;border-bottom:1px solid #cbd5e1;"></th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">This is an automated daily digest from PlanSync O&amp;M. Dates are UTC.</p>
</body></html>`;

  const text = [
    `Maintenance reminders — ${workspaceName}`,
    "",
    `${sorted.length} item(s) overdue or due within 7 days (UTC):`,
    ...sorted.map(
      (it) =>
        `- ${it.projectName} / ${it.assetTag}: ${it.title} — due ${it.nextDueAt.toISOString().slice(0, 10)} (${it.overdue ? "overdue" : "due soon"})`,
    ),
    "",
    `Open: ${appOrigin}${maintenanceAppHref(sorted[0]!.projectId)}`,
  ].join("\n");

  return {
    html,
    text,
    subject: `PlanSync O&M: ${sorted.length} maintenance reminder(s) — ${workspaceName}`,
  };
}

/**
 * Daily digest: maintenance schedules overdue or due within the next 7 days (UTC).
 * Sends at most one email + in-app notification per member per workspace per UTC day
 * (idempotent via OmMaintenanceReminderDigest).
 */
export async function runOmMaintenanceReminders(env: Env): Promise<{
  dayKey: string;
  workspacesEmailed: number;
  workspacesNotified: number;
  membersEmailed: number;
  membersNotified: number;
  workspacesSkipped: number;
  skippedNoResend: boolean;
}> {
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);

  const resendKey = env.RESEND_API_KEY?.trim();
  const from = inviteFromAddress(env);
  const resendConfigured = Boolean(resendKey && from);
  const resend = resendConfigured ? new Resend(resendKey!) : null;

  const startToday = new Date(now);
  startToday.setUTCHours(0, 0, 0, 0);
  const dueSoonEnd = addDays(startToday, 7);
  dueSoonEnd.setUTCHours(23, 59, 59, 999);

  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      isActive: true,
      nextDueAt: { not: null, lte: dueSoonEnd },
      asset: {
        project: { operationsMode: true },
      },
    },
    include: {
      asset: {
        select: {
          tag: true,
          name: true,
          project: {
            select: {
              id: true,
              name: true,
              settingsJson: true,
              workspaceId: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                  subscriptionStatus: true,
                  currentPeriodEnd: true,
                  stripeSubscriptionId: true,
                  billingPlan: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const byWorkspace = new Map<string, OmMaintenanceReminderRow[]>();
  for (const s of schedules) {
    const ws = s.asset.project.workspace;
    if (!isWorkspaceOmBilling(ws)) continue;
    const settings = parseProjectSettingsJson(s.asset.project.settingsJson);
    if (!settings.modules.omMaintenance) continue;

    const nd = s.nextDueAt!;
    const overdue = nd < startToday;

    const row: OmMaintenanceReminderRow = {
      scheduleId: s.id,
      projectId: s.asset.project.id,
      projectName: s.asset.project.name,
      assetTag: s.asset.tag,
      assetName: s.asset.name,
      title: s.title.trim() || s.frequency,
      nextDueAt: nd,
      overdue,
    };
    const list = byWorkspace.get(ws.id) ?? [];
    list.push(row);
    byWorkspace.set(ws.id, list);
  }

  let workspacesEmailed = 0;
  let workspacesNotified = 0;
  let membersEmailed = 0;
  let membersNotified = 0;
  let workspacesSkipped = 0;

  const appOrigin = env.PUBLIC_APP_URL.replace(/\/$/, "");

  for (const [workspaceId, items] of byWorkspace) {
    if (items.length === 0) continue;

    const existing = await prisma.omMaintenanceReminderDigest.findUnique({
      where: { workspaceId_digestDate: { workspaceId, digestDate: dayKey } },
    });
    if (existing) {
      workspacesSkipped += 1;
      continue;
    }

    const wsRow = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    const workspaceName = wsRow?.name ?? "Workspace";

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId, isExternal: false },
      include: { user: { select: { id: true, email: true } } },
    });
    if (members.length === 0) {
      await prisma.omMaintenanceReminderDigest.create({
        data: { workspaceId, digestDate: dayKey },
      });
      workspacesSkipped += 1;
      continue;
    }

    const scopedRows = await prisma.projectMember.findMany({
      where: {
        userId: { in: members.map((m) => m.userId) },
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

    let workspaceHadEmail = false;
    let workspaceHadNotification = false;

    for (const member of members) {
      const scoped = scopedByUser.get(member.userId);
      const memberItems = itemsForMember(items, member, scoped);
      if (memberItems.length === 0) continue;

      const sorted = [...memberItems].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
      const lead = sorted[0]!;
      const overdueCount = sorted.filter((it) => it.overdue).length;
      const dueSoonCount = sorted.length - overdueCount;
      const titleParts: string[] = [];
      if (overdueCount > 0) titleParts.push(`${overdueCount} overdue`);
      if (dueSoonCount > 0) titleParts.push(`${dueSoonCount} due soon`);
      const notifTitle = `Maintenance: ${titleParts.join(", ")}`;

      try {
        await createUserNotifications({
          workspaceId,
          projectId: lead.projectId,
          recipientUserIds: [member.userId],
          kind: "MAINTENANCE_DUE",
          title: notifTitle,
          body: notificationBody(sorted),
          href: maintenanceAppHref(lead.projectId),
        });
        membersNotified += 1;
        workspaceHadNotification = true;
      } catch (err) {
        console.error("[om-maintenance-reminders] notification exception", err);
      }

      const email = member.user.email?.trim();
      if (!resend || !email) continue;

      const { html, text, subject } = buildDigestEmail(workspaceName, sorted, appOrigin);
      try {
        const sent = await resend.emails.send({
          from: from!,
          to: [email],
          subject,
          html,
          text,
        });
        if (sent.error) {
          console.error("[om-maintenance-reminders] resend send_failed", sent.error.message);
          continue;
        }
        membersEmailed += 1;
        workspaceHadEmail = true;
      } catch (err) {
        console.error("[om-maintenance-reminders] resend exception", err);
      }
    }

    await prisma.omMaintenanceReminderDigest.create({
      data: { workspaceId, digestDate: dayKey },
    });

    if (workspaceHadEmail) workspacesEmailed += 1;
    if (workspaceHadNotification) workspacesNotified += 1;
    if (!workspaceHadEmail && !workspaceHadNotification) workspacesSkipped += 1;
  }

  return {
    dayKey,
    workspacesEmailed,
    workspacesNotified,
    membersEmailed,
    membersNotified,
    workspacesSkipped,
    skippedNoResend: !resendConfigured,
  };
}
