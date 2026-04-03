import type { Project, Workspace } from "@prisma/client";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "./prisma.js";

export type ProjectForMember =
  | { project: Project & { workspace: Workspace } }
  | { error: string; status: 403 | 404 };

/** Workspace member + optional project scope (403 if limited user lacks project). */
export async function loadProjectForMember(
  projectId: string,
  userId: string,
): Promise<ProjectForMember> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true },
  });
  if (!project) return { error: "Not found", status: 404 };
  const m = await prisma.workspaceMember.findFirst({
    where: { workspaceId: project.workspaceId, userId },
  });
  if (!m) return { error: "Forbidden", status: 403 };

  const limited = await prisma.projectMember.findMany({
    where: { userId, project: { workspaceId: project.workspaceId } },
    select: { projectId: true },
  });
  if (limited.length > 0 && !limited.some((r) => r.projectId === projectId)) {
    return { error: "Forbidden", status: 403 };
  }
  return { project };
}

/** True if the user is restricted to a subset of projects in this workspace. */
export async function isProjectScopedMember(userId: string, workspaceId: string): Promise<boolean> {
  const n = await prisma.projectMember.count({
    where: { userId, project: { workspaceId } },
  });
  return n > 0;
}

/** Workspace member with email, and project access if they are project-scoped in this workspace. */
export async function assertUserAssignableToProject(
  assigneeId: string,
  projectId: string,
  workspaceId: string,
): Promise<{ ok: true } | { error: string; status: 400 }> {
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: assigneeId },
    include: { user: { select: { email: true } } },
  });
  if (!member) return { error: "Assignee is not a workspace member", status: 400 };
  if (!member.user.email?.trim()) return { error: "Assignee has no email", status: 400 };

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
  if (!project) return { error: "Project not found", status: 400 };

  const limited = await prisma.projectMember.findMany({
    where: { userId: assigneeId, project: { workspaceId } },
    select: { projectId: true },
  });
  if (limited.length > 0 && !limited.some((x) => x.projectId === projectId)) {
    return { error: "Assignee does not have access to this project", status: 400 };
  }
  return { ok: true };
}

export async function isWorkspaceAdmin(workspaceId: string, userId: string): Promise<boolean> {
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  return m?.role === WorkspaceRole.ADMIN;
}
