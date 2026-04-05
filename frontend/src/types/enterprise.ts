export type WorkspaceRole = "SUPER_ADMIN" | "ADMIN" | "MEMBER";

export type MeWorkspace = {
  workspaceId: string;
  role: WorkspaceRole;
  /** External collaborators (client, contractor, etc.) — do not consume paid seats. */
  isExternal?: boolean;
  seatEligible?: boolean;
  workspace: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    description?: string | null;
    website?: string | null;
    primaryColor?: string;
    /** When false, realtime viewer collaboration is disabled for this workspace. */
    viewerCollaborationEnabled?: boolean;
    storageQuotaBytes: string;
    storageUsedBytes: string;
    subscriptionStatus?: string | null;
  };
  /** Workspace projects in use (Pro plan cap). */
  projectCount?: number;
  maxProjects?: number;
};

export type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    hideViewerPresence?: boolean;
  };
  workspaces: MeWorkspace[];
};
