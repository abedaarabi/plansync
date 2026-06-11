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

export function extractProjectIdFromPath(pathname: string): string | null {
  const match =
    pathname.match(/^\/projects\/([^/]+)/) ??
    pathname.match(/^\/workspaces\/[^/]+\/projects\/([^/]+)/);
  if (!match) return null;
  const segment = match[1];
  if (segment === "new") return null;
  return segment;
}

/** Build a project-scoped href with optional workspace prefix. */
export function projectScopedHref(
  projectId: string,
  subpath: string,
  workspaceId?: string | null,
): string {
  const base = workspaceId
    ? `/workspaces/${workspaceId}/projects/${projectId}`
    : `/projects/${projectId}`;
  return `${base}${subpath.startsWith("/") ? subpath : `/${subpath}`}`;
}
