import { WorkspaceRole } from "@prisma/client";
// fallow-ignore-next-line code-duplication
import { prisma } from "./prisma.js";
import { isWorkspaceOmBilling } from "./subscription.js";
import { parseProjectSettingsJson } from "./projectSettings.js";
import { buildTransactionalEmailHtml, escapeHtml } from "./transactionalEmailLayout.js";
import { createOmDigestResend, emptyDigestCounters, filterItemsForMemberAccess, formatDigestPreviewBody, isWorkspaceManagerRole, loadScopedProjectsByUser, sendDigestResendEmail, summarizeOverdueDueSoon, tryNotify, } from "./omReminderDigestShared.js";
function inspectionsAppHref(projectId) {
    return `/projects/${projectId}/om/inspections`;
}
function notificationBody(items) {
    const sorted = [...items].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
    return formatDigestPreviewBody(sorted.map((it) => `${it.projectName}: ${it.name}`));
}
function buildDigestTableHtml(items, appOrigin) {
    const sorted = [...items].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
    const rowsHtml = sorted
        .map((it) => {
        const due = it.nextDueAt.toISOString().slice(0, 10);
        const status = it.overdue ? "Overdue" : "Due soon";
        const href = `${appOrigin}${inspectionsAppHref(it.projectId)}`;
        return `<tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(it.projectName)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(it.name)}</td>
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
        <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Template</th>
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
    const actionUrl = `${opts.appOrigin}${inspectionsAppHref(lead.projectId)}`;
    const subject = `PlanSync O&M: ${sorted.length} inspection reminder(s) — ${opts.workspaceName}`;
    const html = buildTransactionalEmailHtml(env, {
        eyebrow: "Inspections",
        title: `Inspection digest — ${opts.workspaceName}`,
        bodyLines: [
            `Your workspace has ${sorted.length} inspection template(s) overdue or due within the next 7 days (UTC).`,
            statusSummary ? `Status: ${statusSummary}.` : "",
        ].filter(Boolean),
        extraHtml: buildDigestTableHtml(sorted, opts.appOrigin),
        primaryAction: { url: actionUrl, label: "Open inspections" },
        fallbackUrl: actionUrl,
        footerNote: "Automated daily reminder from PlanSync O&M. Dates are UTC.",
    });
    const text = [
        `Inspection reminders — ${opts.workspaceName}`,
        "",
        `${sorted.length} template(s) overdue or due within 7 days (UTC):`,
        ...sorted.map((it) => `- ${it.projectName}: ${it.name} — due ${it.nextDueAt.toISOString().slice(0, 10)} (${it.overdue ? "overdue" : "due soon"})`),
        "",
        `Open: ${actionUrl}`,
    ].join("\n");
    return { html, text, subject };
}
/**
 * Daily digest: inspection templates overdue or due within the next 7 days (UTC).
 *
 * Recipients: workspace managers (SUPER_ADMIN / ADMIN) with accessible projects.
 *
 * At most one email + notification per manager per workspace per UTC day
 * (idempotent via OmInspectionReminderDigest).
 *
 * Ops: call POST /api/v1/internal/om-inspection-reminders daily with
 * header x-plansync-cron-secret = INTERNAL_CRON_SECRET.
 */
// fallow-ignore-next-line complexity
export async function runOmInspectionReminders(env) {
    const { resend, from, configured, dayKey, startToday, dueSoonEnd, appOrigin } = createOmDigestResend(env);
    const templates = await prisma.inspectionTemplate.findMany({
        where: {
            nextDueAt: { not: null, lte: dueSoonEnd },
            project: { operationsMode: true },
        },
        include: {
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
    });
    const byWorkspace = new Map();
    for (const t of templates) {
        const ws = t.project.workspace;
        if (!isWorkspaceOmBilling(ws))
            continue;
        const settings = parseProjectSettingsJson(t.project.settingsJson);
        if (!settings.modules.omInspections)
            continue;
        const nd = t.nextDueAt;
        const overdue = nd < startToday;
        // fallow-ignore-next-line code-duplication
        const row = {
            templateId: t.id,
            projectId: t.project.id,
            projectName: t.project.name,
            name: t.name.trim() || "Inspection",
            nextDueAt: nd,
            overdue,
        };
        const list = byWorkspace.get(ws.id) ?? [];
        list.push(row);
        byWorkspace.set(ws.id, list);
    }
    const counters = emptyDigestCounters();
    for (const [workspaceId, items] of byWorkspace) {
        if (items.length === 0)
            continue;
        const existing = await prisma.omInspectionReminderDigest.findUnique({
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
            where: {
                workspaceId,
                isExternal: false,
                role: { in: [WorkspaceRole.SUPER_ADMIN, WorkspaceRole.ADMIN] },
            },
            include: { user: { select: { id: true, email: true } } },
        });
        if (members.length === 0) {
            // fallow-ignore-next-line code-duplication
            await prisma.omInspectionReminderDigest.create({
                data: { workspaceId, digestDate: dayKey },
            });
            counters.workspacesSkipped += 1;
            continue;
        }
        const scopedByUser = await loadScopedProjectsByUser(members.map((m) => m.userId), workspaceId);
        let workspaceHadEmail = false;
        let workspaceHadNotification = false;
        for (const member of members) {
            if (!isWorkspaceManagerRole(member.role))
                continue;
            const scoped = scopedByUser.get(member.userId);
            const accessible = filterItemsForMemberAccess(items, member, scoped);
            if (accessible.length === 0)
                continue;
            const sorted = [...accessible].sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
            const lead = sorted[0];
            const { titleParts } = summarizeOverdueDueSoon(sorted);
            const notifTitle = `Inspections: ${titleParts.join(", ")}`;
            const notified = await tryNotify({
                workspaceId,
                projectId: lead.projectId,
                recipientUserIds: [member.userId],
                kind: "INSPECTION_DUE",
                title: notifTitle,
                body: notificationBody(sorted),
                href: inspectionsAppHref(lead.projectId),
            }, "[om-inspection-reminders]");
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
            });
            const sent = await sendDigestResendEmail({
                resend,
                from,
                to: email,
                subject,
                html,
                text,
                logPrefix: "[om-inspection-reminders]",
            });
            if (sent) {
                counters.membersEmailed += 1;
                workspaceHadEmail = true;
            }
        }
        await prisma.omInspectionReminderDigest.create({
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
