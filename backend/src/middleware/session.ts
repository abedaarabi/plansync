import type { Context, Next } from "hono";

/** Better Auth instance from createAuth — keep loose to avoid generic depth issues */
export function sessionMiddleware(auth: {
  api: { getSession: (o: { headers: Headers }) => Promise<unknown> };
}) {
  return async (c: Context, next: Next) => {
    const session = (await auth.api.getSession({
      headers: c.req.raw.headers,
    })) as {
      user: { id: string; email: string; name: string; image?: string | null };
      session: { id: string; userId: string; expiresAt: Date };
    } | null;
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("user", session.user);
    c.set("session", session.session);
    await next();
  };
}

declare module "hono" {
  interface ContextVariableMap {
    user: { id: string; email: string; name: string; image?: string | null };
    session: { id: string; userId: string; expiresAt: Date };
    /** Set by viewer-collab WebSocket guard middleware */
    viewerCollabWs?: { fileVersionId: string; listInPresence: boolean };
  }
}
