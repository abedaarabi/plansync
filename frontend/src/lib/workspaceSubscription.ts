/** Matches backend `isWorkspacePro` — Pro APIs allow `active` or `trialing`. */
export function isWorkspaceProClient(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}
