// fallow-ignore-next-line code-duplication
import { prisma } from "./prisma.js";
import { isWorkspaceOmBilling } from "./subscription.js";
import { parseProjectSettingsJson } from "./projectSettings.js";
import { buildTransactionalEmailHtml, escapeHtml } from "./transactionalEmailLayout.js";
import { createOmDigestResend, emptyDigestCounters, filterItemsForMemberAccess, formatDigestPreviewBody, isWorkspaceManagerRole, loadScopedProjectsByUser, sendDigestResendEmail, summarizeOverdueDueSoon, tryNotify, } from "./omReminderDigestShared.js";
function maintenanceAppHref(projectId) {
    return `/projects/${projectId}/om/maintenance`;
}
function notificationBody(items) {
    const sorted = [...items].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
    return formatDigestPreviewBody(sorted.map((it) => `${it.projectName} · ${it.assetTag}: ${it.title}`));
}
function buildDigestTableHtml(items, appOrigin) {
    const sorted = [...items].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
    const rowsHtml = sorted
        .map((it) => {
        const due = it.nextDueAt.toISOString().slice(0, 10);
        const status = it.meterType ? "Meter/calendar" : it.overdue ? "Overdue" : "Due soon";
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
    return `<table style="border-collapse:collapse;width:100%;max-width:720px;font-size:14px;">
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
  </table>`;
}
function buildReminderEmail(env, opts) {
    const sorted = [...opts.items].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
    const lead = sorted[0];
    const { statusSummary } = summarizeOverdueDueSoon(sorted);
    const actionUrl = `${opts.appOrigin}${maintenanceAppHref(lead.projectId)}`;
    const subject = opts.mode === "assignee"
        ? `PlanSync O&M: ${sorted.length} assigned maintenance reminder(s)`
        : `PlanSync O&M: ${sorted.length} maintenance reminder(s) — ${opts.workspaceName}`;
    const bodyLines = opts.mode === "assignee"
        ? [
            `You have ${sorted.length} preventive maintenance item(s) assigned to you that are overdue or due within the next 7 days (UTC).`,
            statusSummary ? `Status: ${statusSummary}.` : "",
            ...sorted
                .slice(0, 5)
                .map((it) => `${it.assetTag}: ${it.title} — due ${it.nextDueAt.toISOString().slice(0, 10)} (${it.overdue ? "overdue" : "due soon"})`),
            sorted.length > 5 ? `…and ${sorted.length - 5} more.` : "",
        ].filter(Boolean)
        : [
            `Your workspace has ${sorted.length} preventive maintenance item(s) overdue or due within the next 7 days (UTC).`,
            statusSummary ? `Status: ${statusSummary}.` : "",
        ].filter(Boolean);
    const html = buildTransactionalEmailHtml(env, {
        eyebrow: "Maintenance",
        title: opts.mode === "assignee"
            ? "Your maintenance reminders"
            : `Maintenance digest — ${opts.workspaceName}`,
        bodyLines,
        extraHtml: opts.mode === "manager" ? buildDigestTableHtml(sorted, opts.appOrigin) : undefined,
        primaryAction: { url: actionUrl, label: "Open maintenance" },
        fallbackUrl: actionUrl,
        footerNote: "Automated daily reminder from PlanSync O&M. Dates are UTC.",
    });
    const text = [
        opts.mode === "assignee"
            ? "Your maintenance reminders"
            : `Maintenance reminders — ${opts.workspaceName}`,
        "",
        `${sorted.length} item(s) overdue or due within 7 days (UTC):`,
        ...sorted.map((it) => `- ${it.projectName} / ${it.assetTag}: ${it.title} — due ${it.nextDueAt.toISOString().slice(0, 10)} (${it.overdue ? "overdue" : "due soon"})`),
        "",
        `Open: ${actionUrl}`,
    ].join("\n");
    return { html, text, subject };
}
/**
 * Daily digest: maintenance schedules overdue or due within the next 7 days (UTC).
 *
 * Recipients:
 * - Assignees: email + in-app/push for schedules assigned to them
 * - Workspace managers (SUPER_ADMIN / ADMIN): full accessible digest
 *
 * At most one email + notification per member per workspace per UTC day
 * (idempotent via OmMaintenanceReminderDigest).
 *
 * Ops: call POST /api/v1/internal/om-maintenance-reminders daily with
 * header x-plansync-cron-secret = INTERNAL_CRON_SECRET.
 */
export async function runOmMaintenanceReminders(env) {
    const { resend, from, configured, dayKey, startToday, dueSoonEnd, appOrigin } = createOmDigestResend(env);
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
    const byWorkspace = new Map();
    for (const s of schedules) {
        const ws = s.asset.project.workspace;
        if (!isWorkspaceOmBilling(ws))
            continue;
        const settings = parseProjectSettingsJson(s.asset.project.settingsJson);
        if (!settings.modules.omMaintenance)
            continue;
        const nd = s.nextDueAt;
        const overdue = nd < startToday;
        // fallow-ignore-next-line code-duplication
        const row = {
            scheduleId: s.id,
            projectId: s.asset.project.id,
            projectName: s.asset.project.name,
            assetTag: s.asset.tag,
            assetName: s.asset.name,
            title: s.title.trim() || s.frequency,
            nextDueAt: nd,
            overdue,
            assignedToUserId: s.assignedToUserId,
            meterType: s.meterType,
        };
        const list = byWorkspace.get(ws.id) ?? [];
        list.push(row);
        byWorkspace.set(ws.id, list);
    }
    const counters = emptyDigestCounters();
    for (const [workspaceId, items] of byWorkspace) {
        if (items.length === 0)
            continue;
        const existing = await prisma.omMaintenanceReminderDigest.findUnique({
            where: { workspaceId_digestDate: { workspaceId, digestDate: dayKey } },
        });
        if (existing) {
            counters.workspacesSkipped += 1;
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
            // fallow-ignore-next-line code-duplication
            await prisma.omMaintenanceReminderDigest.create({
                data: { workspaceId, digestDate: dayKey },
            });
            counters.workspacesSkipped += 1;
            continue;
        }
        const scopedByUser = await loadScopedProjectsByUser(members.map((m) => m.userId), workspaceId);
        let workspaceHadEmail = false;
        let workspaceHadNotification = false;
        for (const member of members) {
            const scoped = scopedByUser.get(member.userId);
            const accessible = filterItemsForMemberAccess(items, member, scoped);
            if (accessible.length === 0)
                continue;
            const manager = isWorkspaceManagerRole(member.role);
            const assignedToMe = accessible.filter((it) => it.assignedToUserId === member.userId);
            let memberItems;
            let mode;
            if (manager) {
                memberItems = accessible;
                mode = "manager";
            }
            else if (assignedToMe.length > 0) {
                memberItems = assignedToMe;
                mode = "assignee";
            }
            else {
                continue;
            }
            const sorted = [...memberItems].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
            const lead = sorted[0];
            const { titleParts } = summarizeOverdueDueSoon(sorted);
            const notifTitle = mode === "assignee"
                ? `Your maintenance: ${titleParts.join(", ")}`
                : `Maintenance: ${titleParts.join(", ")}`;
            const notified = await tryNotify({
                workspaceId,
                projectId: lead.projectId,
                recipientUserIds: [member.userId],
                kind: "MAINTENANCE_DUE",
                title: notifTitle,
                body: notificationBody(sorted),
                href: maintenanceAppHref(lead.projectId),
            }, "[om-maintenance-reminders]");
            if (notified) {
                counters.membersNotified += 1;
                workspaceHadNotification = true;
            }
            const email = member.user.email?.trim();
            if (!resend || !from || !email)
                continue;
            const { html, text, subject } = buildReminderEmail(env, {
                workspaceName,
                items: sorted,
                appOrigin,
                mode,
            });
            const sent = await sendDigestResendEmail({
                resend,
                from,
                to: email,
                subject,
                html,
                text,
                logPrefix: "[om-maintenance-reminders]",
            });
            if (sent) {
                counters.membersEmailed += 1;
                workspaceHadEmail = true;
            }
        }
        await prisma.omMaintenanceReminderDigest.create({
            data: { workspaceId, digestDate: dayKey },
        });
        if (workspaceHadEmail)
            counters.workspacesEmailed += 1;
        if (workspaceHadNotification)
            counters.workspacesNotified += 1;
        if (!workspaceHadEmail && !workspaceHadNotification)
            counters.workspacesSkipped += 1;
    }
    return {
        dayKey,
        ...counters,
        skippedNoResend: !configured,
    };
}
