import { z } from "zod";
import { CloudStorageProvider } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { signCloudOAuthState, verifyCloudOAuthState, newOAuthNonce, } from "../../lib/cloudOAuthState.js";
import { buildDropboxAuthorizeUrl, buildGoogleAuthorizeUrl, buildMicrosoftAuthorizeUrl, downloadDropboxFile, downloadGoogleDriveFile, downloadMicrosoftDriveFile, getDropboxOpenUrl, getGoogleDriveWebViewUrl, getMicrosoftDriveWebUrl, exchangeDropboxCode, exchangeGoogleCode, exchangeMicrosoftCode, fetchDropboxAccountLabel, fetchGoogleAccountLabel, fetchMicrosoftAccountLabel, listDropboxFolder, listGoogleDriveChildren, listMicrosoftDriveChildren, oauthRedirectBase, } from "../../lib/cloudProviders.js";
import { ensureFreshCloudAccessToken } from "../../lib/cloudTokens.js";
import { commitProjectFileImportFromBuffer } from "../../lib/projectFileImport.js";
import { loadProjectForMember } from "../../lib/projectAccess.js";
import { isWorkspacePro } from "../../lib/subscription.js";
import { resolvedMimeType } from "../../lib/mime.js";
function requirePro(workspace) {
    if (!isWorkspacePro(workspace)) {
        return { error: "Pro subscription required", status: 402 };
    }
    return null;
}
function redirectWithError(c, env, message) {
    const u = new URL(env.PUBLIC_APP_URL.replace(/\/$/, ""));
    u.searchParams.set("cloud_import_error", message.slice(0, 500));
    return c.redirect(u.toString(), 302);
}
function redirectSuccess(c, env, returnTo) {
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        const u = new URL(env.PUBLIC_APP_URL.replace(/\/$/, "") + returnTo);
        u.searchParams.set("cloud_import", "connected");
        return c.redirect(u.toString(), 302);
    }
    const u = new URL(env.PUBLIC_APP_URL.replace(/\/$/, ""));
    u.searchParams.set("cloud_import", "connected");
    return c.redirect(u.toString(), 302);
}
export function registerCloudRoutes(r, needUser, env, auth) {
    r.get("/cloud/connections", needUser, async (c) => {
        const userId = c.get("user").id;
        const rows = await prisma.cloudStorageConnection.findMany({
            where: { userId },
            select: { provider: true, accountLabel: true, updatedAt: true },
        });
        const base = oauthRedirectBase(env);
        return c.json({
            connections: rows.map((row) => ({
                provider: row.provider === CloudStorageProvider.GOOGLE_DRIVE
                    ? "google"
                    : row.provider === CloudStorageProvider.ONEDRIVE
                        ? "microsoft"
                        : "dropbox",
                accountLabel: row.accountLabel,
                updatedAt: row.updatedAt.toISOString(),
            })),
            configured: {
                google: Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()),
                microsoft: Boolean(env.MICROSOFT_CLIENT_ID?.trim() && env.MICROSOFT_CLIENT_SECRET?.trim()),
                dropbox: Boolean(env.DROPBOX_APP_KEY?.trim() && env.DROPBOX_APP_SECRET?.trim()),
            },
            /** Same host as `BETTER_AUTH_URL` — register OAuth redirect URIs under this origin. */
            oauthBase: base,
            redirectUris: {
                google: `${base}/api/v1/cloud/google/callback`,
                microsoft: `${base}/api/v1/cloud/microsoft/callback`,
                dropbox: `${base}/api/v1/cloud/dropbox/callback`,
            },
        });
    });
    r.get("/cloud/google/authorize", needUser, async (c) => {
        const returnTo = c.req.query("returnTo")?.trim() ?? null;
        if (returnTo && (!returnTo.startsWith("/") || returnTo.startsWith("//"))) {
            return c.json({ error: "Invalid returnTo" }, 400);
        }
        const url = buildGoogleAuthorizeUrl(env, signCloudOAuthState(env, {
            userId: c.get("user").id,
            ts: Date.now(),
            nonce: newOAuthNonce(),
            provider: "google",
            returnTo,
        }));
        if (!url)
            return c.json({ error: "Google Drive import is not configured (GOOGLE_CLIENT_ID/SECRET)" }, 503);
        return c.redirect(url, 302);
    });
    r.get("/cloud/microsoft/authorize", needUser, async (c) => {
        const returnTo = c.req.query("returnTo")?.trim() ?? null;
        if (returnTo && (!returnTo.startsWith("/") || returnTo.startsWith("//"))) {
            return c.json({ error: "Invalid returnTo" }, 400);
        }
        const url = buildMicrosoftAuthorizeUrl(env, signCloudOAuthState(env, {
            userId: c.get("user").id,
            ts: Date.now(),
            nonce: newOAuthNonce(),
            provider: "microsoft",
            returnTo,
        }));
        if (!url) {
            return c.json({ error: "OneDrive import is not configured (MICROSOFT_CLIENT_ID/SECRET)" }, 503);
        }
        return c.redirect(url, 302);
    });
    r.get("/cloud/dropbox/authorize", needUser, async (c) => {
        const returnTo = c.req.query("returnTo")?.trim() ?? null;
        if (returnTo && (!returnTo.startsWith("/") || returnTo.startsWith("//"))) {
            return c.json({ error: "Invalid returnTo" }, 400);
        }
        const url = buildDropboxAuthorizeUrl(env, signCloudOAuthState(env, {
            userId: c.get("user").id,
            ts: Date.now(),
            nonce: newOAuthNonce(),
            provider: "dropbox",
            returnTo,
        }));
        if (!url)
            return c.json({ error: "Dropbox import is not configured (DROPBOX_APP_KEY/SECRET)" }, 503);
        return c.redirect(url, 302);
    });
    async function handleOAuthCallback(c, provider) {
        const code = c.req.query("code");
        const state = c.req.query("state");
        const err = c.req.query("error");
        if (err) {
            return redirectWithError(c, env, String(err));
        }
        if (!code || !state) {
            return redirectWithError(c, env, "Missing OAuth parameters");
        }
        const payload = verifyCloudOAuthState(env, state);
        if (!payload || payload.provider !== provider) {
            return redirectWithError(c, env, "Invalid or expired OAuth state");
        }
        const session = (await auth.api.getSession({
            headers: c.req.raw.headers,
        }));
        if (!session?.user?.id || session.user.id !== payload.userId) {
            return redirectWithError(c, env, "Sign in to PlanSync and try connecting again.");
        }
        const prismaProvider = provider === "google"
            ? CloudStorageProvider.GOOGLE_DRIVE
            : provider === "microsoft"
                ? CloudStorageProvider.ONEDRIVE
                : CloudStorageProvider.DROPBOX;
        let accessToken;
        let refreshToken;
        let expiresIn;
        let scope;
        if (provider === "google") {
            const ex = await exchangeGoogleCode(env, code);
            if ("error" in ex)
                return redirectWithError(c, env, ex.error);
            accessToken = ex.access_token;
            refreshToken = ex.refresh_token;
            expiresIn = ex.expires_in;
            scope = ex.scope;
        }
        else if (provider === "microsoft") {
            const ex = await exchangeMicrosoftCode(env, code);
            if ("error" in ex)
                return redirectWithError(c, env, ex.error);
            accessToken = ex.access_token;
            refreshToken = ex.refresh_token;
            expiresIn = ex.expires_in;
            scope = ex.scope;
        }
        else {
            const ex = await exchangeDropboxCode(env, code);
            if ("error" in ex)
                return redirectWithError(c, env, ex.error);
            accessToken = ex.access_token;
            refreshToken = ex.refresh_token;
            expiresIn = ex.expires_in;
        }
        let accountLabel = null;
        if (provider === "google")
            accountLabel = await fetchGoogleAccountLabel(accessToken);
        else if (provider === "microsoft")
            accountLabel = await fetchMicrosoftAccountLabel(accessToken);
        else
            accountLabel = await fetchDropboxAccountLabel(accessToken);
        const expiresAt = new Date(Date.now() + expiresIn * 1000);
        await prisma.cloudStorageConnection.upsert({
            where: { userId_provider: { userId: payload.userId, provider: prismaProvider } },
            create: {
                userId: payload.userId,
                provider: prismaProvider,
                accessToken,
                refreshToken: refreshToken ?? null,
                expiresAt,
                scope: scope ?? null,
                accountLabel,
            },
            update: {
                accessToken,
                refreshToken: refreshToken ?? null,
                expiresAt,
                scope: scope ?? null,
                accountLabel,
            },
        });
        return redirectSuccess(c, env, payload.returnTo);
    }
    r.get("/cloud/google/callback", (c) => handleOAuthCallback(c, "google"));
    r.get("/cloud/microsoft/callback", (c) => handleOAuthCallback(c, "microsoft"));
    r.get("/cloud/dropbox/callback", (c) => handleOAuthCallback(c, "dropbox"));
    r.delete("/cloud/google", needUser, async (c) => {
        await prisma.cloudStorageConnection.deleteMany({
            where: { userId: c.get("user").id, provider: CloudStorageProvider.GOOGLE_DRIVE },
        });
        return c.json({ ok: true });
    });
    r.delete("/cloud/microsoft", needUser, async (c) => {
        await prisma.cloudStorageConnection.deleteMany({
            where: { userId: c.get("user").id, provider: CloudStorageProvider.ONEDRIVE },
        });
        return c.json({ ok: true });
    });
    r.delete("/cloud/dropbox", needUser, async (c) => {
        await prisma.cloudStorageConnection.deleteMany({
            where: { userId: c.get("user").id, provider: CloudStorageProvider.DROPBOX },
        });
        return c.json({ ok: true });
    });
    r.post("/cloud/google/browse", needUser, async (c) => {
        const body = z
            .object({ parentId: z.string().default("root") })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const tok = await ensureFreshCloudAccessToken(env, c.get("user").id, CloudStorageProvider.GOOGLE_DRIVE);
        if ("error" in tok)
            return c.json({ error: tok.error }, tok.status);
        const items = await listGoogleDriveChildren(tok.accessToken, body.data.parentId);
        if ("error" in items)
            return c.json({ error: items.error }, 502);
        return c.json({ parentId: body.data.parentId, items });
    });
    r.post("/cloud/microsoft/browse", needUser, async (c) => {
        const body = z
            .object({
            parentId: z.union([z.string(), z.null()]).optional(),
        })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const tok = await ensureFreshCloudAccessToken(env, c.get("user").id, CloudStorageProvider.ONEDRIVE);
        if ("error" in tok)
            return c.json({ error: tok.error }, tok.status);
        const raw = body.data.parentId;
        const pid = raw === undefined || raw === null || raw === "root" ? null : raw;
        const items = await listMicrosoftDriveChildren(tok.accessToken, pid);
        if ("error" in items)
            return c.json({ error: items.error }, 502);
        return c.json({ parentId: pid ?? "root", items });
    });
    r.post("/cloud/dropbox/browse", needUser, async (c) => {
        const body = z
            .object({ path: z.string().default("") })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const tok = await ensureFreshCloudAccessToken(env, c.get("user").id, CloudStorageProvider.DROPBOX);
        if ("error" in tok)
            return c.json({ error: tok.error }, tok.status);
        const items = await listDropboxFolder(tok.accessToken, body.data.path);
        if ("error" in items)
            return c.json({ error: items.error }, 502);
        return c.json({ path: body.data.path, items });
    });
    r.post("/cloud/google/open-link", needUser, async (c) => {
        const body = z
            .object({ fileId: z.string().min(1) })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const tok = await ensureFreshCloudAccessToken(env, c.get("user").id, CloudStorageProvider.GOOGLE_DRIVE);
        if ("error" in tok)
            return c.json({ error: tok.error }, tok.status);
        const link = await getGoogleDriveWebViewUrl(tok.accessToken, body.data.fileId);
        if ("error" in link)
            return c.json({ error: link.error }, 400);
        return c.json({ url: link.url });
    });
    r.post("/cloud/microsoft/open-link", needUser, async (c) => {
        const body = z
            .object({ itemId: z.string().min(1) })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const tok = await ensureFreshCloudAccessToken(env, c.get("user").id, CloudStorageProvider.ONEDRIVE);
        if ("error" in tok)
            return c.json({ error: tok.error }, tok.status);
        const link = await getMicrosoftDriveWebUrl(tok.accessToken, body.data.itemId);
        if ("error" in link)
            return c.json({ error: link.error }, 400);
        return c.json({ url: link.url });
    });
    r.post("/cloud/dropbox/open-link", needUser, async (c) => {
        const body = z
            .object({ path: z.string().min(1) })
            .safeParse(await c.req.json().catch(() => ({})));
        if (!body.success)
            return c.json({ error: body.error.flatten() }, 400);
        const tok = await ensureFreshCloudAccessToken(env, c.get("user").id, CloudStorageProvider.DROPBOX);
        if ("error" in tok)
            return c.json({ error: tok.error }, tok.status);
        const link = await getDropboxOpenUrl(tok.accessToken, body.data.path);
        if ("error" in link)
            return c.json({ error: link.error }, 400);
        return c.json({ url: link.url });
    });
    const importBody = z.object({
        workspaceId: z.string(),
        projectId: z.string(),
        folderId: z.string().optional(),
        fileName: z.string().min(1),
        mimeType: z.string().optional(),
        externalRef: z.string().min(1),
    });
    r.post("/cloud/google/import", needUser, async (c) => {
        const parsed = importBody.safeParse(await c.req.json());
        if (!parsed.success)
            return c.json({ error: parsed.error.flatten() }, 400);
        const { workspaceId, projectId, folderId, fileName, mimeType, externalRef } = parsed.data;
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (access.project.workspaceId !== workspaceId)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const tok = await ensureFreshCloudAccessToken(env, c.get("user").id, CloudStorageProvider.GOOGLE_DRIVE);
        if ("error" in tok)
            return c.json({ error: tok.error }, tok.status);
        const buf = await downloadGoogleDriveFile(tok.accessToken, externalRef);
        if ("error" in buf)
            return c.json({ error: buf.error }, 400);
        const hint = mimeType ?? resolvedMimeType(undefined, fileName);
        const result = await commitProjectFileImportFromBuffer({
            env,
            userId: c.get("user").id,
            workspaceId,
            projectId,
            folderId,
            fileName,
            buffer: buf,
            contentTypeHint: hint,
        });
        if (!result.ok)
            return c.json({ error: result.error }, result.status);
        return c.json({ file: result.file, fileVersion: result.fileVersionJson });
    });
    r.post("/cloud/microsoft/import", needUser, async (c) => {
        const parsed = importBody.safeParse(await c.req.json());
        if (!parsed.success)
            return c.json({ error: parsed.error.flatten() }, 400);
        const { workspaceId, projectId, folderId, fileName, mimeType, externalRef } = parsed.data;
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (access.project.workspaceId !== workspaceId)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const tok = await ensureFreshCloudAccessToken(env, c.get("user").id, CloudStorageProvider.ONEDRIVE);
        if ("error" in tok)
            return c.json({ error: tok.error }, tok.status);
        const buf = await downloadMicrosoftDriveFile(tok.accessToken, externalRef);
        if ("error" in buf)
            return c.json({ error: buf.error }, 400);
        const hint = mimeType ?? resolvedMimeType(undefined, fileName);
        const result = await commitProjectFileImportFromBuffer({
            env,
            userId: c.get("user").id,
            workspaceId,
            projectId,
            folderId,
            fileName,
            buffer: buf,
            contentTypeHint: hint,
        });
        if (!result.ok)
            return c.json({ error: result.error }, result.status);
        return c.json({ file: result.file, fileVersion: result.fileVersionJson });
    });
    r.post("/cloud/dropbox/import", needUser, async (c) => {
        const parsed = importBody.safeParse(await c.req.json());
        if (!parsed.success)
            return c.json({ error: parsed.error.flatten() }, 400);
        const { workspaceId, projectId, folderId, fileName, mimeType, externalRef } = parsed.data;
        const access = await loadProjectForMember(projectId, c.get("user").id);
        if ("error" in access)
            return c.json({ error: access.error }, access.status);
        if (access.project.workspaceId !== workspaceId)
            return c.json({ error: "Forbidden" }, 403);
        const gate = requirePro(access.project.workspace);
        if (gate)
            return c.json({ error: gate.error }, gate.status);
        const tok = await ensureFreshCloudAccessToken(env, c.get("user").id, CloudStorageProvider.DROPBOX);
        if ("error" in tok)
            return c.json({ error: tok.error }, tok.status);
        const buf = await downloadDropboxFile(tok.accessToken, externalRef);
        if ("error" in buf)
            return c.json({ error: buf.error }, 400);
        const hint = mimeType ?? resolvedMimeType(undefined, fileName);
        const result = await commitProjectFileImportFromBuffer({
            env,
            userId: c.get("user").id,
            workspaceId,
            projectId,
            folderId,
            fileName,
            buffer: buf,
            contentTypeHint: hint,
        });
        if (!result.ok)
            return c.json({ error: result.error }, result.status);
        return c.json({ file: result.file, fileVersion: result.fileVersionJson });
    });
}
