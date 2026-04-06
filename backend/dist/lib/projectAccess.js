import { prisma } from "./prisma.js";
import { isWorkspaceAdmin as isWorkspaceAdminFromPermissions, loadProjectForMember as loadProjectForMemberFromPermissions, } from "./permissions.js";
/** @deprecated Prefer loadProjectWithAuth from permissions.js for full RBAC context. */
export const loadProjectForMember = loadProjectForMemberFromPermissions;
export { isWorkspaceAdminFromPermissions as isWorkspaceAdmin };
/** Workspace member + email, and project access if they are project-scoped in this workspace. */
export async function assertUserAssignableToProject(assigneeId, projectId, workspaceId) {
    const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: assigneeId },
        include: { user: { select: { email: true } } },
    });
    if (!member)
        return { error: "Assignee is not a workspace member", status: 400 };
    if (!member.user.email?.trim())
        return { error: "Assignee has no email", status: 400 };
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
    if (!project)
        return { error: "Project not found", status: 400 };
    const limited = await prisma.projectMember.findMany({
        where: { userId: assigneeId, project: { workspaceId } },
        select: { projectId: true },
    });
    if (limited.length > 0 && !limited.some((x) => x.projectId === projectId)) {
        return { error: "Assignee does not have access to this project", status: 400 };
    }
    return { ok: true };
}
/** True if the user is restricted to a subset of projects in this workspace. */
export async function isProjectScopedMember(userId, workspaceId) {
    const n = await prisma.projectMember.count({
        where: { userId, project: { workspaceId } },
    });
    return n > 0;
}
