import { IssueKind, IssueStatus, WorkspaceRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { Env } from "./env.js";
import { isWorkspaceOmBilling } from "./subscription.js";
import { parseProjectSettingsJson } from "./projectSettings.js";
import { buildTransactionalEmailHtml, escapeHtml } from "./transactionalEmailLayout.js";
import {
  createOmDigestResend,
  emptyDigestCounters,
  sendDigestResendEmail,
  tryNotify,
  type OmDigestRunStats,
} from "./omReminderDigestShared.js";

type AgingWorkspaceRow = {
  workspaceId: string;
  workspaceName: string;
  over7: number;
  over30: number;
  leadProjectId: string;
};

function workOrdersAppHref(projectId: string): string {
  return `/projects/${projectId}/om/work-orders`;
}

/**
 * Daily digest: open/in-progress work orders older than 7 and 30 days.
 * Managers only; one email + notification per workspace per UTC day
 * (idempotent via OmWorkOrderAgingDigest).
 *
 * Ops: POST /api/v1/internal/om-work-order-aging-reminders with
 * header x-plansync-cron-secret = INTERNAL_CRON_SECRET.
 */
// fallow-ignore-next-line complexity
export async function runOmWorkOrderAgingReminders(env: Env): Promise<OmDigestRunStats> {
  const { resend, from, configured, dayKey, appOrigin } = createOmDigestResend(env);

  // fallow-ignore-next-line code-duplication
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const openStatuses = [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] as const;

  const issues = await prisma.issue.findMany({
    where: {
      issueKind: IssueKind.WORK_ORDER,
      status: { in: [...openStatuses] },
      createdAt: { lt: sevenDaysAgo },
      project: { operationsMode: true },
    },
    select: {
      id: true,
      projectId: true,
      createdAt: true,
      project: {
        select: {
          id: true,
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
  });

  const byWorkspace = new Map<
    string,
    { name: string; over7: number; over30: number; leadProjectId: string }
  >();

  for (const issue of issues) {
    const ws = issue.project.workspace;
    if (!isWorkspaceOmBilling(ws)) continue;
    const settings = parseProjectSettingsJson(issue.project.settingsJson);
    if (!settings.modules.omMaintenance && !settings.modules.issues) continue;

    const bucket = byWorkspace.get(ws.id) ?? {
      name: ws.name,
      over7: 0,
      over30: 0,
      leadProjectId: issue.projectId,
    };
    bucket.over7 += 1;
    if (issue.createdAt < thirtyDaysAgo) bucket.over30 += 1;
    byWorkspace.set(ws.id, bucket);
  }

  const counters = emptyDigestCounters();

  for (const [workspaceId, counts] of byWorkspace) {
    if (counts.over7 === 0) continue;

    const existing = await prisma.omWorkOrderAgingDigest.findUnique({
      where: { workspaceId_digestDate: { workspaceId, digestDate: dayKey } },
    });
    if (existing) {
      counters.workspacesSkipped += 1;
      continue;
    }

    const row: AgingWorkspaceRow = {
      workspaceId,
      workspaceName: counts.name,
      over7: counts.over7,
      over30: counts.over30,
      leadProjectId: counts.leadProjectId,
    };

    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        isExternal: false,
        role: { in: [WorkspaceRole.SUPER_ADMIN, WorkspaceRole.ADMIN] },
      },
      include: { user: { select: { id: true, email: true } } },
    });
    if (members.length === 0) {
      await prisma.omWorkOrderAgingDigest.create({
        data: { workspaceId, digestDate: dayKey },
      });
      counters.workspacesSkipped += 1;
      continue;
    }

    let workspaceHadEmail = false;
    let workspaceHadNotification = false;
    const href = workOrdersAppHref(row.leadProjectId);
    const actionUrl = `${appOrigin}${href}`;
    const notifTitle =
      `Work orders aging: ${row.over7} over 7d` +
      (row.over30 > 0 ? `, ${row.over30} over 30d` : "");
    const notifBody =
      `${row.workspaceName}: ${row.over7} open/in-progress work order(s) older than 7 days (UTC)` +
      (row.over30 > 0 ? `; ${row.over30} older than 30 days.` : ".");

    for (const member of members) {
      const notified = await tryNotify(
        {
          workspaceId,
          projectId: row.leadProjectId,
          recipientUserIds: [member.userId],
          kind: "WORK_ORDER_AGING",
          title: notifTitle,
          body: notifBody,
          href,
        },
        "[om-work-order-aging-reminders]",
      );
      if (notified) {
        counters.membersNotified += 1;
        workspaceHadNotification = true;
      }

      const email = member.user.email?.trim();
      if (!resend || !from || !email) continue;

      const subject = `PlanSync O&M: work order aging — ${row.workspaceName}`;
      const html = buildTransactionalEmailHtml(env, {
        eyebrow: "Work orders",
        title: `Aging work orders — ${row.workspaceName}`,
        bodyLines: [
          `${row.over7} open or in-progress work order(s) are older than 7 days (UTC).`,
          row.over30 > 0
            ? `${row.over30} of those are older than 30 days.`
            : "None are older than 30 days yet.",
        ],
        extraHtml: `<table style="border-collapse:collapse;width:100%;max-width:480px;font-size:14px;">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Older than 7 days</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${row.over7}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Older than 30 days</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${row.over30}</td></tr>
        </table><p style="margin-top:12px;"><a href="${escapeHtml(actionUrl)}">Open work orders</a></p>`,
        primaryAction: { url: actionUrl, label: "Open work orders" },
        fallbackUrl: actionUrl,
        footerNote: "Automated daily reminder from PlanSync O&M. Dates are UTC.",
      });
      const text = [
        `Aging work orders — ${row.workspaceName}`,
        "",
        `Older than 7 days: ${row.over7}`,
        `Older than 30 days: ${row.over30}`,
        "",
        `Open: ${actionUrl}`,
      ].join("\n");

      const sent = await sendDigestResendEmail({
        resend,
        from,
        to: email,
        subject,
        html,
        text,
        logPrefix: "[om-work-order-aging-reminders]",
      });
      if (sent) {
        counters.membersEmailed += 1;
        workspaceHadEmail = true;
      }
    }

    await prisma.omWorkOrderAgingDigest.create({
      data: { workspaceId, digestDate: dayKey },
    });

    if (workspaceHadEmail) counters.workspacesEmailed += 1;
    if (workspaceHadNotification) counters.workspacesNotified += 1;
    if (!workspaceHadEmail && !workspaceHadNotification) counters.workspacesSkipped += 1;
  }

  return {
    dayKey,
    ...counters,
    skippedNoResend: !configured,
  };
}
