import type { Context, Next } from "hono";
import { prisma } from "../lib/prisma.js";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified?: boolean;
};

type SessionPayload = {
  user: SessionUser;
  session: { id: string; userId: string; expiresAt: Date };
};

/** Better Auth instance from createAuth — keep loose to avoid generic depth issues */
export function sessionMiddleware(
  auth: {
    api: {
      getSession: (o: {
        headers: Headers;
        query?: { disableCookieCache?: boolean };
      }) => Promise<unknown>;
    };
  },
  opts?: { requireEmailVerified?: boolean },
) {
  const requireEmailVerified = opts?.requireEmailVerified !== false;

  return async (c: Context, next: Next) => {
    const session = (await auth.api.getSession({
      headers: c.req.raw.headers,
    })) as SessionPayload | null;

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let user = session.user;

    if (requireEmailVerified && user.emailVerified !== true) {
      const fresh = (await auth.api.getSession({
        headers: c.req.raw.headers,
        query: { disableCookieCache: true },
      })) as SessionPayload | null;
      if (fresh?.user) {
        user = fresh.user;
      }
      if (user.emailVerified !== true) {
        const row = await prisma.user.findUnique({
          where: { id: user.id },
          select: { emailVerified: true },
        });
        if (row?.emailVerified === true) {
          user = { ...user, emailVerified: true };
        } else {
          return c.json({ error: "Email verification required" }, 403);
        }
      }
    }

    c.set("user", user);
    c.set("session", session.session);
    await next();
  };
}

declare module "hono" {
  interface ContextVariableMap {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      emailVerified?: boolean;
    };
    session: { id: string; userId: string; expiresAt: Date };
    /** Set by viewer-collab WebSocket guard middleware */
    viewerCollabWs?: { fileVersionId: string; listInPresence: boolean };
  }
}
