import type { Prisma, Project, Workspace } from "@prisma/client";
import { ProjectMemberRole, WorkspaceRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import { parseProjectSettingsJson, type ProjectSettingsResolved } from "./projectSettings.js";

export type UiMode = "internal" | "client" | "contractor" | "sub";

export type ProjectAuthContext = {
  project: Project & { workspace: Workspace };
  workspaceMember: { role: WorkspaceRole; isExternal: boolean };
  /** Effective project membership; null only for legacy internal users with full workspace access. */
  projectMember: { projectRole: ProjectMemberRole; trade: string | null } | null;
  settings: ProjectSettingsResolved;
  uiMode: UiMode;
};

export type LoadProjectAuthResult =
  | { ok: true; ctx: ProjectAuthContext }
  | { error: string; status: 403 | 404 };

function normalizeTrade(t: string | null | undefined): string | null {
  const s = t?.trim();
  return s ? s : null;
}

function tradeMatches(userTrade: string | null, fileDisciplines: string[]): boolean {
  if (!userTrade || fileDisciplines.length === 0) return false;
  const u = userTrade.toLowerCase();
  return fileDisciplines.some((d) => d.toLowerCase() === u);
}

export function resolveUiMode(isExternal: boolean, projectRole: ProjectMemberRole): UiMode {
  if (!isExternal) return "internal";
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

export function isInternalWorkspaceRole(role: WorkspaceRole): boolean {
  return (
    role === WorkspaceRole.SUPER_ADMIN ||
    role === WorkspaceRole.ADMIN ||
    role === WorkspaceRole.MEMBER
  );
}

export function canManageBilling(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.SUPER_ADMIN;
}

export function canEditWorkspaceOrg(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.SUPER_ADMIN;
}

export function canEditProjectFeatureToggles(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.SUPER_ADMIN;
}

/** Internal users who may invite others (Admin or Super Admin). */
export function canInviteInternal(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.SUPER_ADMIN || role === WorkspaceRole.ADMIN;
}

export function canManageWorkspaceMembers(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.SUPER_ADMIN || role === WorkspaceRole.ADMIN;
}

/** Proposals: create/send — Members cannot. */
export function canCreateProposals(ctx: ProjectAuthContext): boolean {
  if (ctx.workspaceMember.isExternal) return false;
  const r = ctx.workspaceMember.role;
  return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN;
}

export function canViewProposalsInternal(ctx: ProjectAuthContext): boolean {
  if (ctx.workspaceMember.isExternal) return false;
  const r = ctx.workspaceMember.role;
  return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN;
}

export function canUploadDrawings(ctx: ProjectAuthContext): boolean {
  if (ctx.workspaceMember.isExternal) return false;
  const r = ctx.workspaceMember.role;
  return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN;
}

export function canCreateIssues(ctx: ProjectAuthContext): boolean {
  if (ctx.uiMode === "client") return false;
  if (ctx.uiMode === "sub") return false;
  if (ctx.uiMode === "contractor") return true;
  if (ctx.workspaceMember.isExternal) return false;
  return (
    ctx.workspaceMember.role === WorkspaceRole.SUPER_ADMIN ||
    ctx.workspaceMember.role === WorkspaceRole.ADMIN ||
    ctx.workspaceMember.role === WorkspaceRole.MEMBER
  );
}

export function canCloseIssues(ctx: ProjectAuthContext): boolean {
  if (ctx.uiMode === "client") return false;
  if (ctx.uiMode === "sub") {
    return true; /* assigned-only list; closing own assigned handled in route */
  }
  if (ctx.uiMode === "contractor") return true;
  if (ctx.workspaceMember.isExternal) return false;
  return true;
}

export function canCreateRfis(ctx: ProjectAuthContext): boolean {
  if (!ctx.settings.modules.rfis) return false;
  if (ctx.uiMode !== "internal") return false;
  const r = ctx.workspaceMember.role;
  return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN || r === WorkspaceRole.MEMBER;
}

export function canEditTakeoff(ctx: ProjectAuthContext): boolean {
  if (ctx.uiMode !== "internal") return false;
  const r = ctx.workspaceMember.role;
  return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN;
}

export function canViewTakeoff(ctx: ProjectAuthContext): boolean {
  if (!ctx.settings.modules.takeoff) return false;
  return ctx.uiMode === "internal";
}

export function canViewFieldReports(ctx: ProjectAuthContext): boolean {
  if (!ctx.settings.modules.fieldReports) return false;
  if (ctx.uiMode === "client") return ctx.settings.clientVisibility.showFieldReports;
  if (ctx.uiMode === "contractor" || ctx.uiMode === "sub") return false;
  return ctx.uiMode === "internal";
}

export function canViewPunch(ctx: ProjectAuthContext): boolean {
  if (!ctx.settings.modules.punch) return false;
  if (ctx.uiMode === "client") return ctx.settings.clientVisibility.showPunchList;
  return true;
}

export function canViewIssuesForClient(ctx: ProjectAuthContext): boolean {
  return ctx.settings.clientVisibility.showIssues;
}

export function canViewRfisForClient(ctx: ProjectAuthContext): boolean {
  return ctx.settings.clientVisibility.showRfis;
}

/** List/detail RFI API access (internal team, or client when module + visibility allow). */
export function canAccessRfisList(ctx: ProjectAuthContext): boolean {
  if (!ctx.settings.modules.rfis) return false;
  if (ctx.uiMode === "internal") return true;
  if (ctx.uiMode === "client") return ctx.settings.clientVisibility.showRfis;
  return false;
}

/** Contractor/sub: file visible if disciplines match user trade (strict). */
export function canViewFileForExternal(
  ctx: ProjectAuthContext,
  fileDisciplines: string[],
): boolean {
  if (ctx.uiMode === "client") return true;
  const tr = normalizeTrade(ctx.projectMember?.trade ?? null);
  if (!tr) return false;
  return tradeMatches(tr, fileDisciplines);
}

/**
 * Load project + authorization context (replaces loadProjectForMember).
 */
export async function loadProjectWithAuth(
  projectId: string,
  userId: string,
): Promise<LoadProjectAuthResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true },
  });
  if (!project) return { error: "Not found", status: 404 };

  const wm = await prisma.workspaceMember.findFirst({
    where: { workspaceId: project.workspaceId, userId },
  });
  if (!wm) return { error: "Forbidden", status: 403 };

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

  const effectivePm: { projectRole: ProjectMemberRole; trade: string | null } | null = pm
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
export async function loadProjectForMember(
  projectId: string,
  userId: string,
): Promise<{ project: Project & { workspace: Workspace } } | { error: string; status: 403 | 404 }> {
  const r = await loadProjectWithAuth(projectId, userId);
  if ("error" in r) return r;
  return { project: r.ctx.project };
}

export async function isWorkspaceSuperAdmin(workspaceId: string, userId: string): Promise<boolean> {
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  return m?.role === WorkspaceRole.SUPER_ADMIN;
}

/** Admin or Super Admin (internal management). */
export async function isWorkspaceAdminOrSuper(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, isExternal: true },
  });
  if (!m || m.isExternal) return false;
  return m.role === WorkspaceRole.SUPER_ADMIN || m.role === WorkspaceRole.ADMIN;
}

/** Extra `where` clauses for issue list/detail by UI mode. */
export function issuesWhereForAuth(
  ctx: ProjectAuthContext,
  userId: string,
): Prisma.IssueWhereInput {
  if (ctx.uiMode === "internal") return {};
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

export async function isWorkspaceAdmin(workspaceId: string, userId: string): Promise<boolean> {
  return isWorkspaceAdminOrSuper(workspaceId, userId);
}
