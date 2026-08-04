import type { Prisma, Project, Workspace } from "@prisma/client";
import { FolderAccessMode, ProjectMemberRole, WorkspaceRole } from "@prisma/client";
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

function resolveUiMode(isExternal: boolean, projectRole: ProjectMemberRole): UiMode {
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

export function canUploadDrawings(ctx: ProjectAuthContext): boolean {
  if (ctx.workspaceMember.isExternal) return false;
  const r = ctx.workspaceMember.role;
  return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN;
}

export function canManageFiles(ctx: ProjectAuthContext): boolean {
  return canUploadDrawings(ctx);
}

function canViewDrawingsForClient(ctx: ProjectAuthContext): boolean {
  return ctx.settings.clientVisibility.showDrawings;
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

export function canCreateRfis(ctx: ProjectAuthContext): boolean {
  if (!ctx.settings.modules.rfis) return false;
  if (ctx.uiMode !== "internal") return false;
  const r = ctx.workspaceMember.role;
  return r === WorkspaceRole.SUPER_ADMIN || r === WorkspaceRole.ADMIN || r === WorkspaceRole.MEMBER;
}

/** List/detail RFI API access (internal team, or client when module + visibility allow). */
export function canAccessRfisList(ctx: ProjectAuthContext): boolean {
  if (!ctx.settings.modules.rfis) return false;
  if (ctx.uiMode === "internal") return true;
  if (ctx.uiMode === "client") return ctx.settings.clientVisibility.showRfis;
  return false;
}

/** Contractor/sub: file visible if disciplines match user trade (strict). */
function canViewFileForExternal(ctx: ProjectAuthContext, fileDisciplines: string[]): boolean {
  if (ctx.uiMode === "client") return canViewDrawingsForClient(ctx);
  const tr = normalizeTrade(ctx.projectMember?.trade ?? null);
  if (!tr) return false;
  return tradeMatches(tr, fileDisciplines);
}

export function canViewFile(ctx: ProjectAuthContext, fileDisciplines: string[]): boolean {
  if (ctx.uiMode === "internal") return true;
  return canViewFileForExternal(ctx, fileDisciplines);
}

export function canCommentOnFiles(ctx: ProjectAuthContext): boolean {
  if (ctx.uiMode === "internal") return true;
  if (ctx.uiMode === "client") return canViewDrawingsForClient(ctx);
  return false;
}

export function canViewFolderForUser(
  ctx: ProjectAuthContext,
  folder: { accessMode: FolderAccessMode; allowedUserIds: string[] },
  userId: string,
): boolean {
  if (canManageFiles(ctx)) return true;
  if (folder.accessMode === FolderAccessMode.ALL) return true;
  return folder.allowedUserIds.includes(userId);
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
  /** Internal admins may have `ProjectMember` rows for scoped UI while still managing the whole workspace. */
  const canAccessAnyProjectInWorkspace =
    !wm.isExternal && (wm.role === WorkspaceRole.SUPER_ADMIN || wm.role === WorkspaceRole.ADMIN);
  if (
    limited.length > 0 &&
    !limited.some((r) => r.projectId === projectId) &&
    !canAccessAnyProjectInWorkspace
  ) {
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

export type ProjectMemberAccess =
  | { project: Project & { workspace: Workspace } }
  | { error: string; status: 403 | 404 };

/**
 * Discriminator for {@link loadProjectForMember} results.
 * Never use `if (!access)` — denied access is still a truthy `{ error }` object.
 */
export function isProjectAccessError(
  access: ProjectMemberAccess,
): access is { error: string; status: 403 | 404 } {
  return "error" in access;
}

/** Backwards-compatible wrapper returning only project or error. */
export async function loadProjectForMember(
  projectId: string,
  userId: string,
): Promise<ProjectMemberAccess> {
  const r = await loadProjectWithAuth(projectId, userId);
  if ("error" in r) return r;
  return { project: r.ctx.project };
}

/** Admin or Super Admin (internal management). */
async function isWorkspaceAdminOrSuper(workspaceId: string, userId: string): Promise<boolean> {
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
