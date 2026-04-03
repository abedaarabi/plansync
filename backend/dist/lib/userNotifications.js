import { prisma } from "./prisma.js";
/** Creator + primary assignee + all assignee links (deduped). */
export function rfiParticipantUserIds(rfi) {
    const s = new Set();
    if (rfi.creatorId)
        s.add(rfi.creatorId);
    if (rfi.assignedToUserId)
        s.add(rfi.assignedToUserId);
    for (const l of rfi.assigneeLinks)
        s.add(l.userId);
    return [...s];
}
export function rfiAssigneeUserIds(rfi) {
    const s = new Set();
    if (rfi.assignedToUserId)
        s.add(rfi.assignedToUserId);
    for (const l of rfi.assigneeLinks)
        s.add(l.userId);
    return [...s];
}
export async function createUserNotifications(opts) {
    const ids = [...new Set(opts.recipientUserIds)].filter((id) => Boolean(id) && id !== opts.excludeUserId);
    if (ids.length === 0)
        return;
    await prisma.userNotification.createMany({
        data: ids.map((userId) => ({
            userId,
            workspaceId: opts.workspaceId,
            projectId: opts.projectId,
            kind: opts.kind,
            title: opts.title,
            body: opts.body,
            href: opts.href,
            actorUserId: opts.actorUserId ?? null,
        })),
    });
}
