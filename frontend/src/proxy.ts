import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Enterprise app routes — require a valid Better Auth session (see `app/api/[[...path]]/route.ts` → Hono). */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/account",
  "/organization",
  "/projects",
  "/workspaces",
  "/client",
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
  const client = pathname.match(/^\/client\/([^/]+)/);
  if (client) return client[1] ?? null;
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

type SessionPayload = { user?: unknown } | null;
type AuthSessionPayload = { user?: unknown; session?: unknown } | null;

function authCheckBase(request: NextRequest): string {
  const internal = process.env.API_PROXY_TARGET?.trim();
  if (internal) return internal.replace(/\/$/, "");
  return request.nextUrl.origin.replace(/\/$/, "");
}

function authCheckHeaders(request: NextRequest): HeadersInit {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) headers.set("x-forwarded-host", host);
  const proto =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  if (proto) headers.set("x-forwarded-proto", proto);
  return headers;
}

async function canAccessProject(request: NextRequest, projectId: string): Promise<boolean> {
  const base = authCheckBase(request);
  const url = `${base}/api/v1/projects/${encodeURIComponent(projectId)}`;
  try {
    const res = await fetch(url, {
      headers: authCheckHeaders(request),
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

  const base = authCheckBase(request);
  const meUrl = `${base}/api/v1/me`;
  const headers = authCheckHeaders(request);
  let res: Response;
  try {
    res = await fetch(meUrl, {
      headers,
      cache: "no-store",
    });
  } catch {
    return redirectToSignIn(request);
  }

  if (!res.ok) {
    // Fallback: if Better Auth session endpoint is healthy, allow navigation.
    // This prevents false login loops when `/api/v1/me` fails for non-auth reasons.
    const authSessionUrl = `${base}/api/auth/get-session`;
    let authRes: Response;
    try {
      authRes = await fetch(authSessionUrl, {
        headers,
        cache: "no-store",
      });
    } catch {
      return redirectToSignIn(request);
    }
    if (!authRes.ok) {
      return redirectToSignIn(request);
    }
    let authData: AuthSessionPayload;
    try {
      authData = (await authRes.json()) as AuthSessionPayload;
    } catch {
      return redirectToSignIn(request);
    }
    if (authData && authData.user && authData.session) {
      return NextResponse.next();
    }
    return redirectToSignIn(request);
  }

  let data: SessionPayload;
  try {
    data = (await res.json()) as SessionPayload;
  } catch {
    return redirectToSignIn(request);
  }

  if (data && data.user) {
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
    "/client",
    "/client/:path*",
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
