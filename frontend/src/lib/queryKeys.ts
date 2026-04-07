/** Central TanStack Query keys — invalidate related caches after mutations. */
export const qk = {
  me: () => ["me"] as const,
  meNotifications: () => ["meNotifications"] as const,
  projects: (workspaceId: string) => ["projects", workspaceId] as const,
  folderStructureTemplates: (workspaceId: string) =>
    ["folderStructureTemplates", workspaceId] as const,
  project: (projectId: string) => ["project", projectId] as const,
  /** RBAC + module toggles for sidebar and shells */
  projectSession: (projectId: string) => ["projectSession", projectId] as const,
  projectTeam: (projectId: string) => ["projectTeam", projectId] as const,
  projectRfis: (projectId: string) => ["projectRfis", projectId] as const,
  projectRfi: (projectId: string, rfiId: string) => ["projectRfi", projectId, rfiId] as const,
  rfiActivity: (projectId: string, rfiId: string) => ["rfiActivity", projectId, rfiId] as const,
  rfiMessages: (projectId: string, rfiId: string) => ["rfiMessages", projectId, rfiId] as const,
  /** Short-lived S3 GET URL for RFI attachment preview / open. */
  rfiAttachmentReadUrl: (projectId: string, rfiId: string, attachmentId: string) =>
    ["rfiAttachmentReadUrl", projectId, rfiId, attachmentId] as const,
  projectPunch: (projectId: string) => ["projectPunch", projectId] as const,
  projectPunchTemplates: (projectId: string) => ["projectPunchTemplates", projectId] as const,
  projectFieldReports: (projectId: string) => ["projectFieldReports", projectId] as const,
  /** Project audit log (opens, uploads, deletes, …) */
  projectAudit: (projectId: string) => ["project-audit", projectId] as const,
  projectDashboard: (projectId: string) => ["projectDashboard", projectId] as const,
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
  materialTemplate: (workspaceId: string) => ["materialTemplate", workspaceId] as const,
  issuesForFileVersion: (fileVersionId: string, issueKind?: string | null) =>
    ["issues", "fileVersion", fileVersionId, issueKind ?? "all"] as const,
  issuesForProject: (
    projectId: string,
    fileVersionId?: string,
    issueKind?: string,
    assetId?: string,
  ) =>
    [
      "issues",
      "project",
      projectId,
      fileVersionId ?? "all",
      issueKind ?? "all",
      assetId ?? "all",
    ] as const,
  omHandover: (projectId: string) => ["om", "handover", projectId] as const,
  omFmDashboard: (projectId: string) => ["om", "fmDashboard", projectId] as const,
  omAssets: (projectId: string, searchQ?: string) =>
    ["om", "assets", projectId, searchQ ?? ""] as const,
  omAssetDocuments: (projectId: string, assetId: string) =>
    ["om", "assetDocuments", projectId, assetId] as const,
  /** Short-lived S3 GET URL for asset document preview / open. */
  omAssetDocumentReadUrl: (projectId: string, assetId: string, documentId: string) =>
    ["om", "assetDocumentReadUrl", projectId, assetId, documentId] as const,
  omMaintenance: (projectId: string) => ["om", "maintenance", projectId] as const,
  omInspectionTemplates: (projectId: string) => ["om", "inspectionTemplates", projectId] as const,
  omInspectionRuns: (projectId: string) => ["om", "inspectionRuns", projectId] as const,
  occupantTokens: (projectId: string) => ["om", "occupantTokens", projectId] as const,
  /** Persisted Sheet AI smart sheet + chat (GET cache; invalidate after POST summary/chat). */
  sheetAiSheetCache: (fileVersionId: string, pageIndex0: number) =>
    ["sheetAi", "sheetCache", fileVersionId, pageIndex0] as const,
  takeoffForFileVersion: (fileVersionId: string) =>
    ["takeoff", "fileVersion", fileVersionId] as const,
  takeoffForProject: (projectId: string) => ["takeoff", "project", projectId] as const,
  proposalTakeoffVersions: (projectId: string) =>
    ["proposals", "takeoffVersions", projectId] as const,
  projectProposals: (projectId: string) => ["proposals", "list", projectId] as const,
  projectProposal: (projectId: string, proposalId: string) =>
    ["proposals", "detail", projectId, proposalId] as const,
  proposalTemplates: (workspaceId: string) => ["proposals", "templates", workspaceId] as const,
  projectProposalAnalytics: (projectId: string) => ["proposals", "analytics", projectId] as const,
  projectProposalRevisions: (projectId: string, proposalId: string) =>
    ["proposals", "revisions", projectId, proposalId] as const,
  projectProposalPortalMessages: (projectId: string, proposalId: string) =>
    ["proposals", "portalMessages", projectId, proposalId] as const,
  proposalRateHints: (workspaceId: string, q: string) =>
    ["proposals", "rateHints", workspaceId, q] as const,
};
