import { WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hashProjectApiKey } from "../lib/projectApiKeys.js";
/** Better Auth instance from createAuth — keep loose to avoid generic depth issues */
export function sessionMiddleware(auth, opts) {
    const requireEmailVerified = opts?.requireEmailVerified !== false;
    const allowProjectApiKey = opts?.allowProjectApiKey !== false;
    return async (c, next) => {
        let session = (await auth.api.getSession({
            headers: c.req.raw.headers,
        }));
        if (!session?.user && allowProjectApiKey) {
            const apiKeySession = await resolveProjectApiKeySession(c);
            if (apiKeySession) {
                session = apiKeySession;
            }
        }
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
async function resolveProjectApiKeySession(c) {
    const rawApiKey = c.req.header("x-api-key")?.trim();
    if (!rawApiKey)
        return null;
    let projectId;
    try {
        projectId = c.req.param("projectId")?.trim();
    }
    catch {
        projectId = undefined;
    }
    if (!projectId)
        return null;
    const keyHash = hashProjectApiKey(rawApiKey);
    const key = await prisma.projectApiKey.findUnique({
        where: { keyHash },
        include: {
            project: { select: { id: true, workspaceId: true } },
            createdBy: {
                select: { id: true, email: true, name: true, image: true, emailVerified: true },
            },
        },
    });
    if (!key || key.revokedAt || key.projectId !== projectId)
        return null;
    const member = await prisma.workspaceMember.findUnique({
        where: {
            workspaceId_userId: { workspaceId: key.project.workspaceId, userId: key.createdById },
        },
        select: { role: true, isExternal: true },
    });
    if (!member || member.isExternal)
        return null;
    if (member.role !== WorkspaceRole.SUPER_ADMIN && member.role !== WorkspaceRole.ADMIN)
        return null;
    // Non-blocking usage update to avoid slowing request path.
    void prisma.projectApiKey
        .update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
    })
        .catch(() => undefined);
    return {
        user: {
            id: key.createdBy.id,
            email: key.createdBy.email,
            name: key.createdBy.name,
            image: key.createdBy.image,
            emailVerified: key.createdBy.emailVerified ?? true,
        },
        session: {
            id: `api_key:${key.id}`,
            userId: key.createdBy.id,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
    };
}
