import { prisma } from "./prisma.js";

/** Creator + primary assignee + all assignee links (deduped). */
export function rfiParticipantUserIds(rfi: {
  creatorId: string | null;
  assignedToUserId: string | null;
  assigneeLinks: { userId: string }[];
}): string[] {
  const s = new Set<string>();
  if (rfi.creatorId) s.add(rfi.creatorId);
  if (rfi.assignedToUserId) s.add(rfi.assignedToUserId);
  for (const l of rfi.assigneeLinks) s.add(l.userId);
  return [...s];
}

export function rfiAssigneeUserIds(rfi: {
  assignedToUserId: string | null;
  assigneeLinks: { userId: string }[];
}): string[] {
  const s = new Set<string>();
  if (rfi.assignedToUserId) s.add(rfi.assignedToUserId);
  for (const l of rfi.assigneeLinks) s.add(l.userId);
  return [...s];
}

export async function createUserNotifications(opts: {
  workspaceId: string;
  projectId: string;
  recipientUserIds: string[];
  excludeUserId?: string | null;
  kind: string;
  title: string;
  body: string | null;
  href: string;
  actorUserId?: string | null;
}): Promise<void> {
  const ids = [...new Set(opts.recipientUserIds)].filter(
    (id) => Boolean(id) && id !== opts.excludeUserId,
  );
  if (ids.length === 0) return;
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
