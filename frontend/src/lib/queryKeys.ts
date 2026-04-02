/** Central TanStack Query keys — invalidate related caches after mutations. */
export const qk = {
  me: () => ["me"] as const,
  projects: (workspaceId: string) => ["projects", workspaceId] as const,
  folderStructureTemplates: (workspaceId: string) =>
    ["folderStructureTemplates", workspaceId] as const,
  project: (projectId: string) => ["project", projectId] as const,
  projectTeam: (projectId: string) => ["projectTeam", projectId] as const,
  projectRfis: (projectId: string) => ["projectRfis", projectId] as const,
  projectPunch: (projectId: string) => ["projectPunch", projectId] as const,
  projectFieldReports: (projectId: string) => ["projectFieldReports", projectId] as const,
  /** Project audit log (opens, uploads, deletes, …) */
  projectAudit: (projectId: string) => ["project-audit", projectId] as const,
  dashboard: (workspaceId: string) => ["dashboard", workspaceId] as const,
  invites: (workspaceId: string) => ["invites", workspaceId] as const,
  emailInvites: (workspaceId: string, forProjectId?: string) =>
    ["emailInvites", workspaceId, forProjectId ?? "all"] as const,
  workspaceMembers: (workspaceId: string) => ["workspaceMembers", workspaceId] as const,
  materials: (workspaceId: string) => ["materials", workspaceId] as const,
  materialsPaged: (
    workspaceId: string,
    page: number,
    pageSize: number,
    q: string,
    categoryId: string,
  ) => ["materialsPaged", workspaceId, page, pageSize, q, categoryId] as const,
  materialCategories: (workspaceId: string) => ["materialCategories", workspaceId] as const,
  issuesForFileVersion: (fileVersionId: string) =>
    ["issues", "fileVersion", fileVersionId] as const,
  issuesForProject: (projectId: string, fileVersionId?: string) =>
    ["issues", "project", projectId, fileVersionId ?? "all"] as const,
  /** Persisted Sheet AI smart sheet + chat (GET cache; invalidate after POST summary/chat). */
  sheetAiSheetCache: (fileVersionId: string, pageIndex0: number) =>
    ["sheetAi", "sheetCache", fileVersionId, pageIndex0] as const,
  takeoffForFileVersion: (fileVersionId: string) =>
    ["takeoff", "fileVersion", fileVersionId] as const,
  takeoffForProject: (projectId: string) => ["takeoff", "project", projectId] as const,
};
