import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Enterprise app routes — require a valid Better Auth session (see `app/api/[[...path]]/route.ts` → Hono). */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/account",
  "/organization",
  "/projects",
  "/workspaces",
  "/sheets",
  "/rfi",
  "/punch",
  "/reports",
] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * `/viewer` stays public for local mode, but cloud-share links must require auth.
 * We treat these query params as cloud context and gate behind sign-in.
 */
function isCloudViewerRequest(request: NextRequest): boolean {
  if (request.nextUrl.pathname !== "/viewer") return false;
  const sp = request.nextUrl.searchParams;
  return ["fileId", "fileVersionId", "projectId", "version"].some((k) => {
    const v = sp.get(k);
    return v != null && v.trim() !== "";
  });
}

function extractProjectIdFromPath(pathname: string): string | null {
  const legacy = pathname.match(/^\/projects\/([^/]+)/);
  if (legacy) return legacy[1] ?? null;
  const workspaceScoped = pathname.match(/^\/workspaces\/[^/]+\/projects\/([^/]+)/);
  if (workspaceScoped) return workspaceScoped[1] ?? null;
  return null;
}

function redirectToSignIn(request: NextRequest): NextResponse {
  const signIn = request.nextUrl.clone();
  signIn.pathname = "/sign-in";
  signIn.search = "";
  signIn.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signIn);
}

function redirectToNotInvited(request: NextRequest): NextResponse {
  const denied = request.nextUrl.clone();
  denied.pathname = "/not-invited";
  denied.search = "";
  denied.searchParams.set("from", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(denied);
}

type SessionPayload = { user?: unknown; session?: unknown } | null;

async function canAccessProject(request: NextRequest, projectId: string): Promise<boolean> {
  const url = new URL(`/api/v1/projects/${encodeURIComponent(projectId)}`, request.nextUrl.origin);
  try {
    const res = await fetch(url, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname) && !isCloudViewerRequest(request)) {
    return NextResponse.next();
  }

  const sessionUrl = new URL("/api/auth/get-session", request.nextUrl.origin);
  let res: Response;
  try {
    res = await fetch(sessionUrl, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });
  } catch {
    return redirectToSignIn(request);
  }

  if (!res.ok) {
    return redirectToSignIn(request);
  }

  let data: SessionPayload;
  try {
    data = (await res.json()) as SessionPayload;
  } catch {
    return redirectToSignIn(request);
  }

  if (data && data.user && data.session) {
    const pathname = request.nextUrl.pathname;
    const projectIdInPath = extractProjectIdFromPath(pathname);
    if (projectIdInPath) {
      const ok = await canAccessProject(request, projectIdInPath);
      if (!ok) return redirectToNotInvited(request);
    }
    if (isCloudViewerRequest(request)) {
      const viewerProjectId = request.nextUrl.searchParams.get("projectId")?.trim();
      if (viewerProjectId) {
        const ok = await canAccessProject(request, viewerProjectId);
        if (!ok) return redirectToNotInvited(request);
      }
    }
    return NextResponse.next();
  }

  return redirectToSignIn(request);
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/account",
    "/account/:path*",
    "/organization",
    "/organization/:path*",
    "/projects",
    "/projects/:path*",
    "/workspaces",
    "/workspaces/:path*",
    "/sheets",
    "/sheets/:path*",
    "/rfi",
    "/rfi/:path*",
    "/punch",
    "/punch/:path*",
    "/reports",
    "/reports/:path*",
    "/viewer",
  ],
};
