/** Better Auth instance from createAuth — keep loose to avoid generic depth issues */
export function sessionMiddleware(auth) {
    return async (c, next) => {
        const session = (await auth.api.getSession({
            headers: c.req.raw.headers,
        }));
        if (!session?.user) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        if (session.user.emailVerified === false) {
            return c.json({ error: "Email verification required" }, 403);
        }
        c.set("user", session.user);
        c.set("session", session.session);
        await next();
    };
}
