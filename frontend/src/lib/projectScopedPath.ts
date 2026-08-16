/**
 * Returns the URL prefix for the current project from the pathname:
 * `/projects/:projectId` or `/workspaces/:workspaceId/projects/:projectId`.
 *
 * Prefer this for dual-mounted routes (O&M, proposals, takeoff, team).
 * For issues / home / files / punch / etc., use `projectPlainHref` — those
 * pages only exist under `/projects/:projectId/...`.
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

/** Build a project-scoped href with optional workspace prefix (dual-mounted routes). */
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

/**
 * Href for pages that only exist under `/projects/:projectId/...`
 * (issues, home, files, locations, schedule, rfi, punch, reports, audit, settings).
 * Never prefix with `/workspaces/...` — that path 404s.
 */
export function projectPlainHref(projectId: string, subpath: string = ""): string {
  if (!subpath) return `/projects/${projectId}`;
  return `/projects/${projectId}${subpath.startsWith("/") ? subpath : `/${subpath}`}`;
}
