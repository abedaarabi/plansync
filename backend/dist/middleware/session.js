import { prisma } from "../lib/prisma.js";
/** Better Auth instance from createAuth — keep loose to avoid generic depth issues */
export function sessionMiddleware(auth, opts) {
    const requireEmailVerified = opts?.requireEmailVerified !== false;
    return async (c, next) => {
        const session = (await auth.api.getSession({
            headers: c.req.raw.headers,
        }));
        if (!session?.user) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        let user = session.user;
        if (requireEmailVerified && user.emailVerified !== true) {
            const fresh = (await auth.api.getSession({
                headers: c.req.raw.headers,
                query: { disableCookieCache: true },
            }));
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
                }
                else {
                    return c.json({ error: "Email verification required" }, 403);
                }
            }
        }
        c.set("user", user);
        c.set("session", session.session);
        await next();
    };
}
