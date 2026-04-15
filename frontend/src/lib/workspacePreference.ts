import type { MeResponse, MeWorkspace } from "@/types/enterprise";

const STORAGE_KEY = "plansync-preferred-workspace-id-v1";

export function getPreferredWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function setPreferredWorkspaceId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode */
  }
}

export function resolvePrimaryMembership(
  me: MeResponse | null | undefined,
  preferredId: string | null,
): MeWorkspace | null {
  const list = me?.workspaces;
  if (!list?.length) return null;
  if (preferredId) {
    const hit = list.find((w) => w.workspace.id === preferredId);
    if (hit) return hit;
  }
  return list[0] ?? null;
}

/** When `next` already includes `/workspaces/:id/...` and the user is a member, return that id. */
export function workspaceIdFromNextIfMember(
  nextPath: string,
  me: MeResponse | null | undefined,
): string | null {
  const m = nextPath.match(/^\/workspaces\/([^/]+)/);
  if (!m) return null;
  const id = m[1];
  if (!id || id === "new") return null;
  if (me?.workspaces?.some((w) => w.workspace.id === id)) return id;
  return null;
}

/** After switching workspace: keep workspace-scoped URL shape when possible. */
export function pathAfterWorkspaceSwitch(pathname: string, newWorkspaceId: string): string {
  const m = pathname.match(/^\/workspaces\/([^/]+)(\/.*)?$/);
  if (m?.[1] && m[1] !== "new") {
    return pathname.replace(/^\/workspaces\/[^/]+/, `/workspaces/${newWorkspaceId}`);
  }
  return "/projects";
}

export function workspaceGateUrl(nextPath: string): string {
  const p = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `/workspaces?next=${encodeURIComponent(p)}`;
}
