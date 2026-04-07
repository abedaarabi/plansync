import { Resend } from "resend";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { Env } from "./env.js";
import { inviteFromAddress } from "./inviteEmail.js";
import { isWorkspacePro } from "./subscription.js";
import { parseProjectSettingsJson } from "./projectSettings.js";

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

/**
 * Daily digest: maintenance schedules overdue or due within the next 7 days (UTC).
 * Sends at most one email per workspace per UTC calendar day (idempotent via OmMaintenanceReminderDigest).
 */
export async function runOmMaintenanceReminders(env: Env): Promise<{
  dayKey: string;
  workspacesEmailed: number;
  workspacesSkipped: number;
  skippedNoResend: boolean;
}> {
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);

  const key = env.RESEND_API_KEY?.trim();
  const from = inviteFromAddress(env);
  if (!key || !from) {
    return { dayKey, workspacesEmailed: 0, workspacesSkipped: 0, skippedNoResend: true };
  }

  const startToday = new Date(now);
  startToday.setUTCHours(0, 0, 0, 0);
  const dueSoonEnd = addDays(startToday, 7);
  dueSoonEnd.setUTCHours(23, 59, 59, 999);

  const resend = new Resend(key);

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
                select: { id: true, name: true, subscriptionStatus: true },
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
    if (!isWorkspacePro(ws)) continue;
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

    const admins = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        isExternal: false,
        role: { in: [WorkspaceRole.SUPER_ADMIN, WorkspaceRole.ADMIN] },
      },
      include: { user: { select: { email: true } } },
    });
    const emails = [...new Set(admins.map((a) => a.user.email).filter(Boolean))];
    if (emails.length === 0) {
      await prisma.omMaintenanceReminderDigest.create({
        data: { workspaceId, digestDate: dayKey },
      });
      workspacesSkipped += 1;
      continue;
    }

    const rowsHtml = items
      .sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime())
      .map((it) => {
        const due = it.nextDueAt.toISOString().slice(0, 10);
        const status = it.overdue ? "Overdue" : "Due soon";
        const href = `${appOrigin}/projects/${it.projectId}/om/maintenance`;
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
  <p style="margin:0 0 16px;color:#64748b;font-size:14px;">You have <strong>${items.length}</strong> preventive maintenance item(s) that are overdue or due within the next 7 days (UTC).</p>
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
      `${items.length} item(s) overdue or due within 7 days (UTC):`,
      ...items.map(
        (it) =>
          `- ${it.projectName} / ${it.assetTag}: ${it.title} — due ${it.nextDueAt.toISOString().slice(0, 10)} (${it.overdue ? "overdue" : "due soon"})`,
      ),
      "",
      `Open: ${appOrigin}/projects/${items[0]!.projectId}/om/maintenance`,
    ].join("\n");

    await resend.emails.send({
      from,
      to: emails,
      subject: `PlanSync O&M: ${items.length} maintenance reminder(s) — ${workspaceName}`,
      html,
      text,
    });

    await prisma.omMaintenanceReminderDigest.create({
      data: { workspaceId, digestDate: dayKey },
    });
    workspacesEmailed += 1;
  }

  return {
    dayKey,
    workspacesEmailed,
    workspacesSkipped,
    skippedNoResend: false,
  };
}
