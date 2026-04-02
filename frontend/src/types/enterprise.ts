export type MeWorkspace = {
  workspaceId: string;
  role: "ADMIN" | "MEMBER";
  workspace: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    description?: string | null;
    website?: string | null;
    storageQuotaBytes: string;
    storageUsedBytes: string;
    subscriptionStatus?: string | null;
  };
  /** Workspace projects in use (Pro plan cap). */
  projectCount?: number;
  maxProjects?: number;
};

export type MeResponse = {
  user: { id: string; name: string; email: string; image?: string | null };
  workspaces: MeWorkspace[];
};
