import { ProjectMemberRole, WorkspaceRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import { parseProjectSettingsJson } from "./projectSettings.js";
function normalizeTrade(t) {
    const s = t?.trim();
    return s ? s : null;
}
function tradeMatches(userTrade, fileDisciplines) {
    if (!userTrade || fileDisciplines.length === 0)
        return false;
    const u = userTrade.toLowerCase();
    return fileDisciplines.some((d) => d.toLowerCase() === u);
}
export function resolveUiMode(isExternal, projectRole) {
    if (!isExternal)
        return "internal";
    switch (projectRole) {
        case ProjectMemberRole.CLIENT:
            return "client";
        case ProjectMemberRole.CONTRACTOR:
            return "contractor";
        case ProjectMemberRole.SUBCONTRACTOR:
            return "sub";
        default:
            return "internal";
    }
}
export function isInternalWorkspaceRole(role) {
    return (role === WorkspaceRole.SUPER_ADMIN ||
        role === WorkspaceRole.ADMIN ||
        role === WorkspaceRole.MEMBER);
}
export function canManageBilling(role) {
    return role === WorkspaceRole.SUPER_ADMIN;
}
export function canEditWorkspaceOrg(role) {
    return role === WorkspaceRole.SUPER_ADMIN;
}
export function canEditProjectFeatureToggles(role) {
    return role === WorkspaceRole.SUPER_ADMIN;
}
/** Internal users who may invite others (Admin or Super Admin). */
export function canInviteInternal(role) {
    return role === WorkspaceRole.SUPER_ADMIN || role === WorkspaceRole.ADMIN;
}
export function canManageWorkspaceMembers(role) {
    return role === WorkspaceRole.SUPER_ADMIN || role === WorkspaceRole.ADMIN;
}
/** Proposals: create/send — Members cannot. */
export function canCreateProposals(ctx) {
    if (ctx.workspaceMember.isExternal)
        return false;
    const r = ctx.workspaceMember.role;
    return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN;
}
export function canViewProposalsInternal(ctx) {
    if (ctx.workspaceMember.isExternal)
        return false;
    const r = ctx.workspaceMember.role;
    return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN;
}
export function canUploadDrawings(ctx) {
    if (ctx.workspaceMember.isExternal)
        return false;
    const r = ctx.workspaceMember.role;
    return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN;
}
export function canCreateIssues(ctx) {
    if (ctx.uiMode === "client")
        return false;
    if (ctx.uiMode === "sub")
        return false;
    if (ctx.uiMode === "contractor")
        return true;
    if (ctx.workspaceMember.isExternal)
        return false;
    return (ctx.workspaceMember.role === WorkspaceRole.SUPER_ADMIN ||
        ctx.workspaceMember.role === WorkspaceRole.ADMIN ||
        ctx.workspaceMember.role === WorkspaceRole.MEMBER);
}
export function canCloseIssues(ctx) {
    if (ctx.uiMode === "client")
        return false;
    if (ctx.uiMode === "sub") {
        return true; /* assigned-only list; closing own assigned handled in route */
    }
    if (ctx.uiMode === "contractor")
        return true;
    if (ctx.workspaceMember.isExternal)
        return false;
    return true;
}
export function canCreateRfis(ctx) {
    if (!ctx.settings.modules.rfis)
        return false;
    if (ctx.uiMode !== "internal")
        return false;
    const r = ctx.workspaceMember.role;
    return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN || r === WorkspaceRole.MEMBER;
}
export function canEditTakeoff(ctx) {
    if (ctx.uiMode !== "internal")
        return false;
    const r = ctx.workspaceMember.role;
    return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN;
}
export function canViewTakeoff(ctx) {
    if (!ctx.settings.modules.takeoff)
        return false;
    return ctx.uiMode === "internal";
}
export function canViewFieldReports(ctx) {
    if (!ctx.settings.modules.fieldReports)
        return false;
    if (ctx.uiMode === "client")
        return ctx.settings.clientVisibility.showFieldReports;
    if (ctx.uiMode === "contractor" || ctx.uiMode === "sub")
        return false;
    return ctx.uiMode === "internal";
}
export function canViewPunch(ctx) {
    if (!ctx.settings.modules.punch)
        return false;
    if (ctx.uiMode === "client")
        return ctx.settings.clientVisibility.showPunchList;
    return true;
}
export function canViewIssuesForClient(ctx) {
    return ctx.settings.clientVisibility.showIssues;
}
export function canViewRfisForClient(ctx) {
    return ctx.settings.clientVisibility.showRfis;
}
/** List/detail RFI API access (internal team, or client when module + visibility allow). */
export function canAccessRfisList(ctx) {
    if (!ctx.settings.modules.rfis)
        return false;
    if (ctx.uiMode === "internal")
        return true;
    if (ctx.uiMode === "client")
        return ctx.settings.clientVisibility.showRfis;
    return false;
}
/** Contractor/sub: file visible if disciplines match user trade (strict). */
export function canViewFileForExternal(ctx, fileDisciplines) {
    if (ctx.uiMode === "client")
        return true;
    const tr = normalizeTrade(ctx.projectMember?.trade ?? null);
    if (!tr)
        return false;
    return tradeMatches(tr, fileDisciplines);
}
/**
 * Load project + authorization context (replaces loadProjectForMember).
 */
export async function loadProjectWithAuth(projectId, userId) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { workspace: true },
    });
    if (!project)
        return { error: "Not found", status: 404 };
    const wm = await prisma.workspaceMember.findFirst({
        where: { workspaceId: project.workspaceId, userId },
    });
    if (!wm)
        return { error: "Forbidden", status: 403 };
    const limited = await prisma.projectMember.findMany({
        where: { userId, project: { workspaceId: project.workspaceId } },
        select: { projectId: true },
    });
    if (limited.length > 0 && !limited.some((r) => r.projectId === projectId)) {
        return { error: "Forbidden", status: 403 };
    }
    const pm = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
    });
    const settings = parseProjectSettingsJson(project.settingsJson);
    if (wm.isExternal) {
        if (!pm || pm.projectRole === ProjectMemberRole.INTERNAL) {
            return { error: "Forbidden", status: 403 };
        }
        const uiMode = resolveUiMode(true, pm.projectRole);
        return {
            ok: true,
            ctx: {
                project,
                workspaceMember: { role: wm.role, isExternal: true },
                projectMember: { projectRole: pm.projectRole, trade: pm.trade },
                settings,
                uiMode,
            },
        };
    }
    const effectivePm = pm
        ? { projectRole: pm.projectRole, trade: pm.trade }
        : { projectRole: ProjectMemberRole.INTERNAL, trade: null };
    return {
        ok: true,
        ctx: {
            project,
            workspaceMember: { role: wm.role, isExternal: false },
            projectMember: effectivePm,
            settings,
            uiMode: "internal",
        },
    };
}
/** Backwards-compatible wrapper returning only project or error. */
export async function loadProjectForMember(projectId, userId) {
    const r = await loadProjectWithAuth(projectId, userId);
    if ("error" in r)
        return r;
    return { project: r.ctx.project };
}
export async function isWorkspaceSuperAdmin(workspaceId, userId) {
    const m = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true },
    });
    return m?.role === WorkspaceRole.SUPER_ADMIN;
}
/** Admin or Super Admin (internal management). */
export async function isWorkspaceAdminOrSuper(workspaceId, userId) {
    const m = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true, isExternal: true },
    });
    if (!m || m.isExternal)
        return false;
    return m.role === WorkspaceRole.SUPER_ADMIN || m.role === WorkspaceRole.ADMIN;
}
/** Extra `where` clauses for issue list/detail by UI mode. */
export function issuesWhereForAuth(ctx, userId) {
    if (ctx.uiMode === "internal")
        return {};
    if (ctx.uiMode === "client") {
        return ctx.settings.clientVisibility.showIssues ? {} : { id: { in: [] } };
    }
    if (ctx.uiMode === "contractor") {
        return { OR: [{ assigneeId: userId }] };
    }
    if (ctx.uiMode === "sub") {
        return { assigneeId: userId };
    }
    return {};
}
export async function isWorkspaceAdmin(workspaceId, userId) {
    return isWorkspaceAdminOrSuper(workspaceId, userId);
}
