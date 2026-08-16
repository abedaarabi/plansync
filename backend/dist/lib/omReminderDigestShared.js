import { Resend } from "resend";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import { inviteFromAddress } from "./inviteEmail.js";
import { createUserNotifications } from "./userNotifications.js";
function addUtcDays(d, n) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
}
function memberCanAccessProject(member, scopedProjectIds, projectId) {
    if (member.isExternal)
        return false;
    const isManager = member.role === WorkspaceRole.SUPER_ADMIN || member.role === WorkspaceRole.ADMIN;
    if (isManager || !scopedProjectIds || scopedProjectIds.size === 0)
        return true;
    return scopedProjectIds.has(projectId);
}
export function filterItemsForMemberAccess(items, member, scopedProjectIds) {
    return items.filter((it) => memberCanAccessProject(member, scopedProjectIds, it.projectId));
}
export function isWorkspaceManagerRole(role) {
    return role === WorkspaceRole.SUPER_ADMIN || role === WorkspaceRole.ADMIN;
}
export function createOmDigestResend(env) {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    const resendKey = env.RESEND_API_KEY?.trim();
    const from = inviteFromAddress(env);
    const configured = Boolean(resendKey && from);
    const resend = configured ? new Resend(resendKey) : null;
    const startToday = new Date(now);
    startToday.setUTCHours(0, 0, 0, 0);
    const dueSoonEnd = addUtcDays(startToday, 7);
    dueSoonEnd.setUTCHours(23, 59, 59, 999);
    const appOrigin = env.PUBLIC_APP_URL.replace(/\/$/, "");
    return { resend, from, configured, dayKey, startToday, dueSoonEnd, appOrigin };
}
export async function loadScopedProjectsByUser(userIds, workspaceId) {
    const scopedRows = await prisma.projectMember.findMany({
        where: {
            userId: { in: userIds },
            project: { workspaceId },
        },
        select: { userId: true, projectId: true },
    });
    const scopedByUser = new Map();
    for (const row of scopedRows) {
        const set = scopedByUser.get(row.userId) ?? new Set();
        set.add(row.projectId);
        scopedByUser.set(row.userId, set);
    }
    return scopedByUser;
}
export function summarizeOverdueDueSoon(items) {
    const overdueCount = items.filter((it) => it.overdue).length;
    const dueSoonCount = items.length - overdueCount;
    const titleParts = [];
    if (overdueCount > 0)
        titleParts.push(`${overdueCount} overdue`);
    if (dueSoonCount > 0)
        titleParts.push(`${dueSoonCount} due soon`);
    const statusSummary = titleParts.join(", ");
    return { overdueCount, dueSoonCount, titleParts, statusSummary };
}
export function formatDigestPreviewBody(labels) {
    const preview = labels.slice(0, 3).join(" · ");
    if (labels.length > 3)
        return `${preview} · +${labels.length - 3} more`;
    return preview;
}
export function emptyDigestCounters() {
    return {
        workspacesEmailed: 0,
        workspacesNotified: 0,
        membersEmailed: 0,
        membersNotified: 0,
        workspacesSkipped: 0,
    };
}
export async function sendDigestResendEmail(opts) {
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
    }
    catch (err) {
        console.error(`${opts.logPrefix} resend exception`, err);
        return false;
    }
}
export async function tryNotify(opts, logPrefix) {
    try {
        await createUserNotifications(opts);
        return true;
    }
    catch (err) {
        console.error(`${logPrefix} notification exception`, err);
        return false;
    }
}
