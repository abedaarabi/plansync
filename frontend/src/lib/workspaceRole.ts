import type { WorkspaceRole } from "@/types/enterprise";

export function isWorkspaceManager(role: WorkspaceRole | string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdmin(role: WorkspaceRole | string | undefined): boolean {
  return role === "SUPER_ADMIN";
}
