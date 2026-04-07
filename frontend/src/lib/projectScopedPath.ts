/**
 * Returns the URL prefix for the current project from the pathname:
 * `/projects/:projectId` or `/workspaces/:workspaceId/projects/:projectId`.
 */
export function projectScopedBaseFromPathname(pathname: string): string | null {
  const workspaceProject = pathname.match(/^\/workspaces\/([^/]+)\/projects\/([^/]+)/);
  if (workspaceProject) {
    const workspaceId = workspaceProject[1];
    const projectSegment = workspaceProject[2];
    if (projectSegment === "new") return null;
    return `/workspaces/${workspaceId}/projects/${projectSegment}`;
  }
  const plainProject = pathname.match(/^\/projects\/([^/]+)/);
  if (plainProject) {
    const projectSegment = plainProject[1];
    if (projectSegment === "new") return null;
    return `/projects/${projectSegment}`;
  }
  return null;
}
